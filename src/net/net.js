// ============================================================
// Networking.
//
// One player hosts. The host owns the rules engine and is the
// only writer of game state; everyone else sends intents and
// renders the snapshots that come back.
// ============================================================

import { Peer } from 'peerjs';

const ID_PREFIX = 'dbln-v1-';
// No I, O, 0 or 1 — room codes get read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function randomCode(length = 4) {
  let out = '';
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

export function normaliseCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/O/g, '0')
    .replace(/I/g, '1')
    .slice(0, 6);
}

const peerIdFor = (code) => `${ID_PREFIX}${code}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** PeerJS defaults to its public broker, which is what we want here. */
function makePeer(id) {
  return new Peer(id, {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    },
  });
}

class Emitter {
  constructor() { this.handlers = new Map(); }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }
  emit(event, ...args) {
    for (const fn of this.handlers.get(event) || []) {
      try { fn(...args); } catch (error) { console.error(`[net] handler for ${event}`, error); }
    }
  }
  clearHandlers() { this.handlers.clear(); }
}

// ------------------------------------------------------------
// Host
// ------------------------------------------------------------

export class Host extends Emitter {
  constructor() {
    super();
    this.peer = null;
    this.code = null;
    this.connections = new Map();  // peerId -> DataConnection
    this.destroyed = false;
    this._retryTimer = 0;
    this._retries = 0;
    this._reopenTimer = 0;
    this._reopens = 0;
  }

  /**
   * Claim a room code. Retries on collision.
   *
   * `preferred` is for picking a voyage back up after the host reloaded:
   * the same code has to come back or nobody can rejoin. The broker
   * holds a dropped id for a few seconds, so that case waits and tries
   * again rather than giving up and minting a new room.
   */
  async open(preferred = null, attempts = 6) {
    if (preferred) {
      for (let i = 0; i < 8; i++) {
        try {
          await this._tryOpen(preferred);
          this.code = preferred;
          return preferred;
        } catch (error) {
          if (error?.type !== 'unavailable-id') throw error;
          await sleep(1000 + i * 500);
        }
      }
      throw new Error('That room code is still held by the old table. Try again in a moment.');
    }

    for (let i = 0; i < attempts; i++) {
      const code = randomCode(4);
      try {
        await this._tryOpen(code);
        this.code = code;
        return code;
      } catch (error) {
        if (error?.type === 'unavailable-id' && i < attempts - 1) continue;
        throw error;
      }
    }
    throw new Error('Could not claim a room code.');
  }

  _tryOpen(code) {
    return new Promise((resolve, reject) => {
      const peer = makePeer(peerIdFor(code));
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        peer.destroy();
        reject(new Error('Timed out reaching the matchmaking server.'));
      }, 15000);

      peer.on('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.peer = peer;
        this._wire(peer);
        resolve();
      });

      peer.on('error', (error) => {
        if (settled) {
          this.emit('error', error);
          return;
        }
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(error);
      });
    });
  }

  _wire(peer) {
    peer.on('connection', (conn) => {
      conn.on('open', () => {
        this.connections.set(conn.peer, conn);
        this.emit('connect', conn.peer);
      });
      conn.on('data', (message) => {
        this.emit('message', conn.peer, message);
      });
      conn.on('close', () => {
        this.connections.delete(conn.peer);
        this.emit('disconnect', conn.peer);
      });
      conn.on('error', () => {
        this.connections.delete(conn.peer);
        this.emit('disconnect', conn.peer);
      });
    });

    // Fires again after a successful reconnect, not just the first open.
    peer.on('open', () => {
      this._retries = 0;
      if (!this.destroyed) this.emit('status', 'online');
    });

    peer.on('disconnected', () => {
      if (this.destroyed) return;
      this.emit('status', 'reconnecting');
      // The broker dropped us; the data channels usually survive.
      this._scheduleReconnect(peer);
    });

    /*
     * A destroyed peer forfeits the room id, and a room nobody can
     * reach is a game nobody can rejoin. PeerJS only destroys after a
     * fatal broker error, which is exactly when we most need to come
     * back, so rebuild the peer on the same code instead of giving up.
     * The data channels went with it, but every client is already
     * looping on the same code, so they find the room again.
     */
    peer.on('close', () => {
      if (this.destroyed) return;
      this.emit('status', 'closed');
      this.connections.clear();
      this._scheduleReopen();
    });
  }

  _scheduleReopen() {
    if (this.destroyed || this._reopenTimer || !this.code) return;
    const wait = Math.min(20000, 1500 * 2 ** Math.min(this._reopens, 4));
    this._reopens += 1;
    this._reopenTimer = setTimeout(async () => {
      this._reopenTimer = 0;
      if (this.destroyed) return;
      try {
        await this._tryOpen(this.code);
        this._reopens = 0;
        this.emit('status', 'online');
        this.emit('reopened');
      } catch {
        this._scheduleReopen();
      }
    }, wait);
  }

  /*
   * Backoff matters here. A failed reconnect ends in PeerJS's _abort(),
   * which calls disconnect() again -- straight back into this handler.
   * Reconnecting inline spun the broker in a tight loop and never
   * recovered: the old room id stays registered for a while after the
   * socket drops, so every immediate retry hit 'unavailable-id'.
   */
  _scheduleReconnect(peer) {
    if (this.destroyed || this._retryTimer) return;
    // Never stop trying. Backing off to half a minute is cheap, and a
    // host that quietly stops listening is a room that can never be
    // rejoined for the rest of the game.
    if (this._retries === 8) this.emit('status', 'offline');
    const wait = Math.min(30000, 1000 * 2 ** Math.min(this._retries, 5));
    this._retries += 1;
    this._retryTimer = setTimeout(() => {
      this._retryTimer = 0;
      if (this.destroyed) return;
      if (peer.destroyed) { this._scheduleReopen(); return; }
      if (!peer.disconnected) return;
      try { peer.reconnect(); } catch { this._scheduleReopen(); }
    }, wait);
  }

  send(peerId, message) {
    const conn = this.connections.get(peerId);
    if (conn && conn.open) {
      try { conn.send(message); } catch (error) { console.warn('[net] send failed', error); }
    }
  }

  broadcast(message, except = null) {
    for (const [peerId, conn] of this.connections) {
      if (peerId === except) continue;
      if (conn.open) {
        try { conn.send(message); } catch { /* the close handler will clean up */ }
      }
    }
  }

  kick(peerId) {
    const conn = this.connections.get(peerId);
    if (conn) {
      try { conn.send({ type: 'kicked' }); conn.close(); } catch { /* already gone */ }
    }
    this.connections.delete(peerId);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this._retryTimer);
    clearTimeout(this._reopenTimer);
    this._retryTimer = 0;
    this._reopenTimer = 0;
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch { /* already gone */ }
    }
    this.connections.clear();
    try { this.peer?.destroy(); } catch { /* already gone */ }
    this.peer = null;
    this.clearHandlers();
  }
}

// ------------------------------------------------------------
// Client
// ------------------------------------------------------------

export class Client extends Emitter {
  constructor() {
    super();
    this.peer = null;
    this.conn = null;
    this.code = null;
    this.destroyed = false;
    this._retryTimer = 0;
  }

  connect(code) {
    const target = peerIdFor(code);
    this.code = code;

    return new Promise((resolve, reject) => {
      const peer = makePeer(undefined);
      this.peer = peer;
      let settled = false;

      const fail = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        peer.destroy();
        reject(error);
      };

      const timer = setTimeout(() => {
        fail(new Error('No answer from that room. Check the code and try again.'));
      }, 20000);

      peer.on('open', () => {
        const conn = peer.connect(target, { reliable: true, serialization: 'json' });
        this.conn = conn;

        conn.on('open', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.emit('status', 'connected');
          resolve();
        });

        conn.on('data', (message) => {
          if (message?.type === 'kicked') {
            this.emit('kicked');
            return;
          }
          this.emit('message', message);
        });

        conn.on('close', () => {
          if (!this.destroyed) this.emit('disconnect');
        });

        conn.on('error', (error) => {
          // Before the handshake lands this is a failed join; after it,
          // the channel is gone and somebody has to say so -- fail() is
          // a no-op once settled, so this used to go nowhere.
          if (settled) { if (!this.destroyed) this.emit('disconnect'); return; }
          fail(error);
        });
      });

      peer.on('error', (error) => {
        if (error?.type === 'peer-unavailable') {
          fail(new Error('No room with that code is open right now.'));
        } else {
          fail(error);
        }
      });

      peer.on('disconnected', () => {
        if (this.destroyed) return;
        this.emit('status', 'reconnecting');
        // Same tight-loop hazard as the host; see Host._scheduleReconnect.
        if (this._retryTimer) return;
        this._retryTimer = setTimeout(() => {
          this._retryTimer = 0;
          if (this.destroyed || peer.destroyed || !peer.disconnected) return;
          try { peer.reconnect(); } catch { /* handled by the error event */ }
        }, 1500);
      });
    });
  }

  send(message) {
    if (this.conn && this.conn.open) {
      try { this.conn.send(message); } catch (error) { console.warn('[net] send failed', error); }
    }
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this._retryTimer);
    this._retryTimer = 0;
    try { this.conn?.close(); } catch { /* already gone */ }
    try { this.peer?.destroy(); } catch { /* already gone */ }
    this.conn = null;
    this.peer = null;
    this.clearHandlers();
  }
}

// ------------------------------------------------------------
// Message shapes, kept in one place so both ends agree
// ------------------------------------------------------------

export const MSG = {
  // client -> host
  HELLO: 'hello',      // { name, token? } -- token reclaims a held seat
  RENAME: 'rename',
  ACTION: 'action',
  CHAT: 'chat',
  LEAVE: 'leave',
  PING: 'ping',        // keeps the host's liveness clock happy
  ACK: 'ack',          // { version } -- this snapshot arrived and rendered
  // host -> client
  WELCOME: 'welcome',
  SEATED: 'seated',    // { seatId, token } -- your identity across reconnects
  PONG: 'pong',
  PAUSE: 'pause',      // { waiting: [names], until } -- empty list means resumed
  LOBBY: 'lobby',
  STATE: 'state',
  EFFECTS: 'effects',
  REJECT: 'reject',
  CHAT_ECHO: 'chatEcho',
  KICKED: 'kicked',
};
