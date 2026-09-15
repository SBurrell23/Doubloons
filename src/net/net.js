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
  }

  /** Claim a room code. Retries on collision. */
  async open(attempts = 6) {
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

    peer.on('disconnected', () => {
      if (this.destroyed) return;
      this.emit('status', 'reconnecting');
      // The broker dropped us; the data channels usually survive.
      try { peer.reconnect(); } catch { /* handled by the error event */ }
    });

    peer.on('close', () => {
      if (!this.destroyed) this.emit('status', 'closed');
    });
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

        conn.on('error', (error) => fail(error));
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
        try { peer.reconnect(); } catch { /* handled by the error event */ }
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
  HELLO: 'hello',
  RENAME: 'rename',
  ACTION: 'action',
  CHAT: 'chat',
  LEAVE: 'leave',
  // host -> client
  WELCOME: 'welcome',
  LOBBY: 'lobby',
  STATE: 'state',
  EFFECTS: 'effects',
  REJECT: 'reject',
  CHAT_ECHO: 'chatEcho',
  KICKED: 'kicked',
};
