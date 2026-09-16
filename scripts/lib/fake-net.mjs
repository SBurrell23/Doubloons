// ============================================================
// A switchboard that stands in for PeerJS.
//
// It behaves the way the real transport does in the ways that
// matter to the game: messages are copies (the channel is JSON),
// they arrive later than they were sent, a closed channel tells
// both ends, and -- the interesting one -- a channel can simply
// stop carrying traffic without telling anybody at all.
// ============================================================

let peerSeq = 0;

// Same shape as a real room code, so normaliseCode() leaves it alone.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function fakeCode() {
  let out = '';
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

class Emitter {
  constructor() { this.handlers = new Map(); }
  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event)?.delete(fn);
  }
  emit(event, ...args) {
    for (const fn of [...(this.handlers.get(event) || [])]) {
      try { fn(...args); } catch (error) { console.error(`[fake-net] ${event}`, error); }
    }
  }
  clearHandlers() { this.handlers.clear(); }
}

/**
 * What PeerJS's `serialization: 'json'` does to a message. Anything
 * that will not survive the trip never arrives, which is also what the
 * real channel does with it.
 */
function overTheWire(message) {
  try {
    const text = JSON.stringify(message);
    if (text === undefined) return { dropped: true };
    return { value: JSON.parse(text) };
  } catch { return { dropped: true }; }
}

export class Switchboard {
  constructor({ latency = 1 } = {}) {
    this.rooms = new Map();     // code -> FakeHost
    this.latency = latency;
    this.pending = 0;
  }

  later(fn) {
    this.pending++;
    setTimeout(() => { this.pending--; fn(); }, this.latency);
  }

  host() { return new FakeHost(this); }
  client() { return new FakeClient(this); }
}

class Channel {
  constructor(board, host, client) {
    this.board = board;
    this.host = host;
    this.client = client;
    this.open = true;
    this.silent = false;
  }

  /** Cut the wire without either end noticing. The nastiest failure. */
  goSilent() { this.silent = true; }

  toClient(message) {
    if (!this.open || this.silent) return;
    const wire = overTheWire(message);
    if (wire.dropped) return;
    this.board.later(() => {
      if (!this.open || this.silent) return;
      if (wire.value?.type === 'kicked') { this.client._kicked(); return; }
      this.client.emit('message', wire.value);
    });
  }

  toHost(message) {
    if (!this.open || this.silent) return;
    const wire = overTheWire(message);
    if (wire.dropped) return;
    this.board.later(() => {
      if (!this.open || this.silent) return;
      this.host.emit('message', this.client.id, wire.value);
    });
  }

  close({ tellHost = true, tellClient = true } = {}) {
    if (!this.open) return;
    this.open = false;
    if (this.host.connections.get(this.client.id) === this) {
      this.host.connections.delete(this.client.id);
      if (tellHost && !this.host.destroyed) this.board.later(() => this.host.emit('disconnect', this.client.id));
    }
    if (this.client.channel === this) {
      this.client.channel = null;
      if (tellClient && !this.client.destroyed) this.board.later(() => this.client.emit('disconnect'));
    }
  }
}

export class FakeHost extends Emitter {
  constructor(board) {
    super();
    this.board = board;
    this.connections = new Map();  // client peer id -> Channel
    this.code = null;
    this.destroyed = false;
  }

  async open(preferred = null) {
    const code = preferred || fakeCode();
    const held = this.board.rooms.get(code);
    if (held && held !== this && !held.destroyed) {
      const error = new Error(`ID "${code}" is taken`);
      error.type = 'unavailable-id';
      throw error;
    }
    this.board.rooms.set(code, this);
    this.code = code;
    this.destroyed = false;
    return code;
  }

  send(peerId, message) { this.connections.get(peerId)?.toClient(message); }

  broadcast(message, except = null) {
    for (const [peerId, channel] of this.connections) {
      if (peerId === except) continue;
      channel.toClient(message);
    }
  }

  kick(peerId) {
    const channel = this.connections.get(peerId);
    if (!channel) return;
    channel.toClient({ type: 'kicked' });
    channel.close({ tellHost: false, tellClient: false });
  }

  /** The room falls off the broker, as a fatal PeerJS error would do. */
  collapse() {
    for (const channel of [...this.connections.values()]) channel.close({ tellHost: false });
    this.connections.clear();
    if (this.board.rooms.get(this.code) === this) this.board.rooms.delete(this.code);
    this.emit('status', 'closed');
    // The real Host reopens on the same code from its own 'close'
    // handler; here the test drives that through reopen().
  }

  async reopen() {
    await this.open(this.code);
    this.emit('reopened');
  }

  destroy() {
    this.destroyed = true;
    for (const channel of [...this.connections.values()]) channel.close({ tellHost: false });
    this.connections.clear();
    if (this.board.rooms.get(this.code) === this) this.board.rooms.delete(this.code);
    this.clearHandlers();
  }
}

export class FakeClient extends Emitter {
  constructor(board) {
    super();
    this.board = board;
    this.id = `peer-${++peerSeq}`;
    this.peer = { id: this.id };
    this.channel = null;
    this.destroyed = false;
  }

  async connect(code) {
    const host = this.board.rooms.get(code);
    if (!host || host.destroyed) {
      const error = new Error('No room with that code is open right now.');
      error.type = 'peer-unavailable';
      throw error;
    }
    const channel = new Channel(this.board, host, this);
    host.connections.set(this.id, channel);
    this.channel = channel;
    this.destroyed = false;
    await new Promise((resolve) => this.board.later(resolve));
    host.emit('connect', this.id);
  }

  send(message) { this.channel?.toHost(message); }

  _kicked() { this.emit('kicked'); this.channel?.close({ tellClient: false }); }

  /** Pull the plug: both ends find out, as a clean close would. */
  drop() { this.channel?.close(); }

  /** Freeze: neither end finds out. Only the liveness clock can tell. */
  freeze() { this.channel?.goSilent(); }

  destroy() {
    this.destroyed = true;
    this.channel?.close({ tellClient: false });
    this.clearHandlers();
  }
}

/** sessionStorage for one simulated browser tab. */
export function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}
