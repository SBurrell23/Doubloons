// ============================================================
// Sessions.
//
// HostSession owns the rules engine, the AI captains and the
// turn clock, and broadcasts snapshots. ClientSession just
// forwards intents and renders what comes back. Both present
// the same surface to the UI.
// ============================================================

import { Host, Client, MSG, normaliseCode } from '../net/net.js';
import {
  createGame, validate, apply, viewFor, legalActions, currentPlayer,
  playerById, standings, DEFAULT_OPTIONS, countTokens,
} from './rules.js';
import { chooseAction, aiDelay, AI_LEVELS, AI_NAMES } from './ai.js';
import { MAX_TOKENS_HELD } from './data.js';

// Muted signal-flag colours, and the emblem each seat flies.
const SEAT_COLORS = ['#8c2f27', '#1d4f70', '#2f6a52', '#8a6a1e'];
const SEAT_EMBLEM_NAMES = ['skull', 'anchor', 'cutlasses', 'wheel'];
export const MAX_SEATS = 4;
export const MIN_SEATS = 2;

/**
 * Liveness. A WebRTC channel can go quiet without ever closing -- a
 * frozen background tab, a laptop lid, a phone that lost its radio --
 * and the table would sit there waiting on a player who is not coming.
 * So both ends talk on a timer, and silence is treated as absence.
 *
 * Every value is overridable per session; the netcode simulation winds
 * them right down so a whole disconnect-and-return cycle fits in a few
 * milliseconds.
 */
export const NET_TIMING = {
  pulse: 1000,          // how often each end checks the clock
  heartbeat: 3000,      // client -> host, when it has nothing else to say
  seatTimeout: 12000,   // host: silence this long means the seat is adrift
  hostTimeout: 14000,   // client: silence this long means the channel is gone
  grace: 120000,        // how long the table waits before sailing without them
  rejoinWindow: 180000, // how long a client keeps trying to get back aboard
  rejoinDelay: 1200,    // first pause between attempts to get back in
  aiDelay: null,        // override the crew's thinking time (simulation only)
};

class Emitter {
  constructor() { this._handlers = new Map(); }
  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this._handlers.get(event)?.delete(fn);
  }
  emit(event, ...args) {
    for (const fn of this._handlers.get(event) || []) {
      try { fn(...args); } catch (error) { console.error(`[session] ${event}`, error); }
    }
  }
}

function seatDecor(index) {
  return {
    color: SEAT_COLORS[index % SEAT_COLORS.length],
    emblem: SEAT_EMBLEM_NAMES[index % SEAT_EMBLEM_NAMES.length],
  };
}

/**
 * A seat's claim ticket. Peer ids are minted per connection, so they
 * cannot identify a player who has dropped and come back -- this can.
 */
function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Strip anything that would break the lobby list. */
export function cleanName(name, fallback = 'Captain') {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return trimmed || fallback;
}

// ------------------------------------------------------------
// Host
// ------------------------------------------------------------

export class HostSession extends Emitter {
  constructor({ name, options = {}, timing = {}, transport = null, storage = null } = {}) {
    super();
    this.isHost = true;
    this.myId = 'host';
    this.code = null;
    this.phase = 'lobby';
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.timing = { ...NET_TIMING, ...timing };
    this._store = browserStore(storage);
    this.seats = [
      { id: 'host', name: cleanName(name, 'Captain'), isAI: false, peerId: null, connected: true, isHost: true },
    ];
    this._waiting = [];
    this.state = null;
    this.net = transport || new Host();
    this._aiTimer = 0;
    this._timerHandle = 0;
    this._deadline = 0;
    this._autoplayTimer = 0;
    this._chat = [];
    this._lastHeard = new Map();   // seat id -> when we last heard anything
    this._graceUntil = 0;
    this._pulseTimer = 0;
    this._wire();
  }

  // ---- lobby ----

  /** `preferred` reclaims the room code of a voyage we are resuming. */
  async open(preferred = null) {
    this.code = await this.net.open(preferred);
    this._startPulse();
    this._persist();
    this.emit('lobby', this.lobby);
    return this.code;
  }

  get lobby() {
    return {
      code: this.code,
      phase: this.phase,
      options: { ...this.options },
      seats: this.seats.map((seat, i) => ({
        // The token is a credential -- it stays on the host and with the
        // one client it belongs to, never in the broadcast lobby.
        ...seat, token: undefined, ...seatDecor(i), seat: i,
      })),
      chat: this._chat.slice(-40),
      waiting: this._waiting,
      graceUntil: this._graceUntil,
    };
  }

  _wire() {
    this.net.on('connect', (peerId) => {
      // A seat is only created once they say hello with a name.
      this.net.send(peerId, { type: MSG.WELCOME, code: this.code });
    });

    this.net.on('message', (peerId, message) => this._onMessage(peerId, message));

    this.net.on('disconnect', (peerId) => {
      const seat = this.seats.find((s) => s.peerId === peerId);
      if (!seat) return;
      this._seatLost(seat);
    });

    /*
     * The room had to be rebuilt on the broker, which takes the data
     * channels with it. Everyone still aboard is now adrift until they
     * find their way back to the same code.
     */
    this.net.on('reopened', () => {
      const live = this.net.connections;
      for (const seat of this.seats) {
        if (seat.isAI || seat.isHost || !seat.peerId) continue;
        if (live && live.has(seat.peerId)) continue;
        this._seatLost(seat);
      }
    });

    this.net.on('status', (status) => this.emit('netStatus', status));
    this.net.on('error', (error) => this.emit('error', error));
  }

  /**
   * A seat we can no longer reach. In the lobby the berth just frees
   * up; mid-voyage they keep their seat, their cards and their turn --
   * the whole table holds until they are back, the grace runs out, or
   * the host decides to sail without them.
   */
  _seatLost(seat) {
    if (!seat || seat.isAI || seat.isHost) return;
    // The close event, the kick and the silence check can all land on
    // the same seat; only the first one means anything.
    if (seat.lost) return;
    seat.lost = true;
    if (seat.peerId) this.net.kick(seat.peerId);
    this._lastHeard.delete(seat.id);

    if (this.phase === 'lobby') {
      this.seats = this.seats.filter((s) => s !== seat);
      this.emit('toast', { text: `${seat.name} left the table.`, kind: 'bad' });
      this._pushLobby();
      this.emit('lobby', this.lobby);
      this._persist();
      return;
    }

    seat.connected = false;
    seat.peerId = null;

    if (seat.departed) {
      // They said goodbye rather than dropping. No sense holding the
      // table for someone who is not coming back.
      this._coverSeats([seat], `${seat.name} left the voyage — the crew takes their seat.`);
      return;
    }

    this.emit('toast', { text: `${seat.name} lost their connection. The voyage waits.`, kind: 'bad' });
    this._syncPause();
    this._scheduleTurn();
    this._pushLobby();
    this.emit('lobby', this.lobby);
    this._persist();
  }

  _onMessage(peerId, message) {
    if (!message || typeof message !== 'object') return;
    if (typeof message.type !== 'string') return;

    // Anything at all from a peer counts as a sign of life.
    const speaker = this.seats.find((s) => s.peerId === peerId);
    if (speaker) this._lastHeard.set(speaker.id, Date.now());

    switch (message.type) {
      case MSG.PING: {
        this.net.send(peerId, { type: MSG.PONG, t: message.t });
        return;
      }

      case MSG.ACK: return;  // already counted above

      case MSG.HELLO: {
        const existing = this.seats.find((s) => s.peerId === peerId);
        if (existing) return;

        // A returning player: same seat, same cards, same turn. The peer
        // id is new -- it is minted fresh for every connection -- so the
        // token is what actually identifies them.
        const token = typeof message.token === 'string' ? message.token.slice(0, 64) : null;
        const held = token ? this.seats.find((s) => !s.isAI && s.token === token) : null;
        if (held) {
          const stale = held.peerId;
          held.peerId = peerId;
          held.connected = true;
          held.departed = false;
          held.lost = false;
          this._lastHeard.set(held.id, Date.now());
          if (stale && stale !== peerId) this.net.kick(stale);
          this.net.send(peerId, { type: MSG.SEATED, seatId: held.id, token: held.token });
          this.emit('toast', { text: `${held.name} is back aboard.`, kind: 'good', sound: 'join' });
          this._pushLobby();
          this.emit('lobby', this.lobby);
          this._persist();
          if (this.phase === 'playing' && this.state) {
            this.net.send(peerId, {
              type: MSG.STATE,
              view: viewFor(this.state, held.id),
              effects: [],
              reset: true,
              deadline: this._deadline,
            });
            this._syncPause();
            this.net.send(peerId, { type: MSG.PAUSE, waiting: this._waiting });
            this._scheduleTurn();
          }
          return;
        }

        if (this.phase !== 'lobby') {
          this.net.send(peerId, { type: MSG.REJECT, reason: 'That voyage has already sailed.' });
          this.net.kick(peerId);
          return;
        }
        if (this.seats.length >= MAX_SEATS) {
          this.net.send(peerId, { type: MSG.REJECT, reason: 'The table is full.' });
          this.net.kick(peerId);
          return;
        }
        const name = this._uniqueName(cleanName(message.name, 'Deckhand'));
        const seat = {
          id: peerId, name, isAI: false, peerId, connected: true, isHost: false,
          token: newToken(),
        };
        this.seats.push(seat);
        this._lastHeard.set(seat.id, Date.now());
        this.net.send(peerId, { type: MSG.SEATED, seatId: seat.id, token: seat.token });
        this.emit('toast', { text: `${name} joined the table.`, kind: 'good', sound: 'join' });
        this._pushLobby();
        this.emit('lobby', this.lobby);
        this._persist();
        break;
      }

      case MSG.RENAME: {
        const seat = this.seats.find((s) => s.peerId === peerId);
        if (!seat || this.phase !== 'lobby') return;
        seat.name = this._uniqueName(cleanName(message.name, seat.name), seat);
        this._pushLobby();
        this.emit('lobby', this.lobby);
        break;
      }

      case MSG.CHAT: {
        const seat = this.seats.find((s) => s.peerId === peerId);
        if (!seat) return;
        if (typeof message.text !== 'string') return;
        // A client stuck in a send loop should not be able to push the
        // whole table's chat history out from under everyone.
        const now = Date.now();
        const last = seat._lastChat || 0;
        if (now - last < 400) return;
        seat._lastChat = now;
        this._addChat(seat.name, message.text);
        break;
      }

      case MSG.ACTION: {
        const seat = this.seats.find((s) => s.peerId === peerId);
        if (!seat) return;
        this.submit(message.action, seat.id);
        break;
      }

      case MSG.LEAVE: {
        const seat = this.seats.find((s) => s.peerId === peerId);
        // Mark the intent before the channel closes, so the drop is
        // read as a goodbye rather than as somebody to wait for.
        if (seat) seat.departed = true;
        this.net.kick(peerId);
        if (seat) this._seatLost(seat);
        break;
      }
    }
  }

  _uniqueName(name, exclude = null) {
    const taken = new Set(this.seats.filter((s) => s !== exclude).map((s) => s.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; i < 40; i++) {
      const candidate = `${name} ${i}`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${name} ${Math.floor(Math.random() * 999)}`;
  }

  _addChat(from, text) {
    const clean = String(text || '').slice(0, 160).trim();
    if (!clean) return;
    const entry = { from, text: clean, at: Date.now() };
    this._chat.push(entry);
    if (this._chat.length > 60) this._chat.shift();
    this.net.broadcast({ type: MSG.CHAT_ECHO, entry });
    this.emit('chat', entry);
  }

  sendChat(text) { this._addChat(this.seats[0].name, text); }

  rename(name) {
    this.seats[0].name = this._uniqueName(cleanName(name, 'Captain'), this.seats[0]);
    this._pushLobby();
    this.emit('lobby', this.lobby);
  }

  addAI(level = 'sly') {
    if (this.phase !== 'lobby' || this.seats.length >= MAX_SEATS) return;
    const used = new Set(this.seats.map((s) => s.name));
    const name = AI_NAMES.find((n) => !used.has(n)) || `Captain ${this.seats.length}`;
    this.seats.push({
      id: `ai-${Date.now().toString(36)}-${this.seats.length}`,
      name, isAI: true, aiLevel: level, peerId: null, connected: true, isHost: false,
    });
    this._pushLobby();
    this.emit('lobby', this.lobby);
  }

  setAiLevel(seatId, level) {
    const seat = this.seats.find((s) => s.id === seatId);
    if (seat?.isAI && AI_LEVELS[level]) {
      seat.aiLevel = level;
      this._pushLobby();
      this.emit('lobby', this.lobby);
    }
  }

  removeSeat(seatId) {
    if (this.phase !== 'lobby') return;
    const seat = this.seats.find((s) => s.id === seatId);
    if (!seat || seat.isHost) return;
    if (seat.peerId) this.net.kick(seat.peerId);
    this.seats = this.seats.filter((s) => s.id !== seatId);
    this._pushLobby();
    this.emit('lobby', this.lobby);
  }

  setOptions(partial) {
    Object.assign(this.options, partial);
    this._pushLobby();
    this.emit('lobby', this.lobby);
  }

  canStart() {
    return this.phase === 'lobby' && this.seats.length >= MIN_SEATS && this.seats.length <= MAX_SEATS;
  }

  start() {
    if (!this.canStart()) return false;
    this.phase = 'playing';
    this.state = createGame(
      this.seats.map((s) => ({ id: s.id, name: s.name, isAI: s.isAI, aiLevel: s.aiLevel })),
      this.options,
      Date.now() ^ (Math.random() * 0xffffffff),
    );
    this._waiting = [];
    this._graceUntil = 0;
    this._startPulse();
    this._pushLobby();
    this._broadcastState({ reset: true });
    this._syncPause();
    this._persist();
    this._scheduleTurn();
    return true;
  }

  /** Back to the lobby with the same crew. */
  rematch() {
    if (this.phase !== 'playing') return;
    this._clearTimers();
    this.phase = 'lobby';
    this.state = null;
    this._waiting = [];
    this._graceUntil = 0;
    // Anyone who never made it back does not get a berth in the next
    // game -- otherwise the rematch starts held, waiting on a seat that
    // has nobody behind it.
    const stranded = this.seats.filter((s) => !s.isAI && !s.isHost && !s.connected);
    if (stranded.length) this.seats = this.seats.filter((s) => !stranded.includes(s));
    this._pushLobby();
    this.emit('lobby', this.lobby);
    this.net.broadcast({ type: MSG.LOBBY, lobby: this.lobby });
    this._persist();
  }

  // ---- gameplay ----

  submit(action, playerId = this.myId) {
    if (this.phase !== 'playing' || !this.state) return;
    if (this.paused) {
      if (playerId === this.myId) this.emit('reject', 'The voyage is held until the crew is back aboard.');
      return;
    }

    let result;
    try {
      result = validate(this.state, playerId, action);
    } catch (error) {
      // The rules engine is meant to tolerate any shape at all, but a
      // throw here would take the host's message loop with it and
      // strand everyone. Refuse the move and carry on.
      console.error('[session] validate threw', error);
      this._reject(playerId, 'That move could not be read.');
      return;
    }
    if (!result.ok) {
      this._reject(playerId, result.reason);
      return;
    }

    let effects;
    try {
      effects = apply(this.state, playerId, action);
    } catch (error) {
      console.error('[session] apply threw', error);
      this._reject(playerId, 'That move could not be played.');
      // The state may be half-written, so make sure everyone is looking
      // at whatever it actually is now rather than a stale snapshot.
      this._broadcastState({ reset: true });
      this._scheduleTurn();
      return;
    }

    this._broadcastState({ effects });
    this._persist();
    if (this.state.phase === 'finished') {
      this._clearTimers();
      this.emit('gameOver', standings(this.state));
    } else {
      this._scheduleTurn();
    }
  }

  _reject(playerId, reason) {
    if (playerId === this.myId) { this.emit('reject', reason); return; }
    const seat = this.seats.find((s) => s.id === playerId);
    if (seat?.peerId) this.net.send(seat.peerId, { type: MSG.REJECT, reason });
  }

  /** Who the game is waiting on right now. */
  _actorId() {
    if (!this.state) return null;
    if (this.state.pending) return this.state.pending.playerId;
    return currentPlayer(this.state).id;
  }

  /** Human seats that have dropped and not yet come back. */
  _adrift() {
    if (this.phase !== 'playing' || !this.state) return [];
    if (this.state.phase === 'finished') return [];
    return this.seats.filter((s) => !s.isAI && !s.connected && !s.isHost);
  }

  get paused() { return this._adrift().length > 0; }

  /** When the table stops waiting and sails on without them. */
  get graceUntil() { return this._graceUntil; }

  /** Tell everyone whether the table is held, but only when it changes. */
  _syncPause() {
    const waiting = this._adrift().map((s) => s.name);

    // The grace clock starts the moment the table first goes quiet and
    // runs until it is whole again -- dropping, returning and dropping
    // again does not buy the table another full wait.
    if (waiting.length && !this._graceUntil) this._graceUntil = Date.now() + this.timing.grace;
    else if (!waiting.length) this._graceUntil = 0;

    const same = waiting.length === this._waiting.length
      && waiting.every((n, i) => n === this._waiting[i]);
    if (same) return;
    this._waiting = waiting;
    this.net.broadcast({ type: MSG.PAUSE, waiting, until: this._graceUntil });
    this.emit('paused', waiting, this._graceUntil);
  }

  /**
   * Give up on someone who is not coming back: the crew takes their
   * seat for the rest of the voyage. The host can call it early from
   * the held overlay; otherwise the grace clock calls it, because a
   * table that waits forever is a game nobody gets to finish.
   */
  coverForAdrift() {
    this._coverSeats(this._adrift());
  }

  _coverSeats(seats, message = null) {
    const taking = seats.filter((s) => !s.isAI && !s.isHost);
    if (!taking.length) return;
    for (const seat of taking) {
      seat.isAI = true;
      seat.aiLevel = seat.aiLevel || 'sly';
      seat.connected = true;
      seat.departed = false;
      seat.lost = false;
      seat.token = null;
      this._lastHeard.delete(seat.id);
      const player = this.state?.players.find((p) => p.id === seat.id);
      if (player) player.isAI = true;
      this.emit('toast', {
        text: message || `The crew takes ${seat.name}'s seat.`,
        kind: 'bad',
      });
    }
    this._graceUntil = 0;
    this._pushLobby();
    this.emit('lobby', this.lobby);
    this._syncPause();
    this._broadcastState({});
    this._persist();
    this._scheduleTurn();
  }

  // ---- liveness ----

  /**
   * One slow clock covers both things that can quietly go wrong: a
   * channel that stopped carrying traffic without ever closing, and a
   * grace period that has run out.
   */
  _startPulse() {
    if (this.solo || this._pulseTimer) return;
    this._pulseTimer = setInterval(() => this._pulse(), this.timing.pulse);
  }

  _pulse() {
    const now = Date.now();

    for (const seat of this.seats) {
      if (seat.isAI || seat.isHost || !seat.connected || !seat.peerId) continue;
      const last = this._lastHeard.get(seat.id) ?? now;
      if (now - last > this.timing.seatTimeout) this._seatLost(seat);
    }

    if (this._graceUntil && Date.now() >= this._graceUntil && this.paused) {
      this.coverForAdrift();
    }
  }

  _scheduleTurn() {
    this._clearTimers();
    if (!this.state || this.state.phase === 'finished') return;

    // Anybody adrift holds the whole table, not just their own turn --
    // otherwise play carries on around them and they come back to a
    // game they can no longer win.
    if (this.paused) {
      this._deadline = 0;
      this._broadcastDeadline();
      return;
    }

    const actorId = this._actorId();
    const seat = this.seats.find((s) => s.id === actorId);
    if (!seat) return;

    if (seat.isAI) {
      const think = this.timing.aiDelay ?? aiDelay(this.options.aiSpeed);
      this._aiTimer = setTimeout(() => this._playAi(actorId), think);
      return;
    }

    if (this.options.turnTimer > 0) {
      this._deadline = Date.now() + this.options.turnTimer * 1000;
      this._broadcastDeadline();
      this._timerHandle = setTimeout(() => this._autoPlay(actorId), this.options.turnTimer * 1000 + 250);
    } else {
      this._deadline = 0;
      this._broadcastDeadline();
    }
  }

  _playAi(actorId) {
    if (!this.state || this._actorId() !== actorId) return;
    const action = chooseAction(this.state, actorId);
    if (!action) { this.submit({ type: 'pass' }, actorId); return; }
    this.submit(action, actorId);
  }

  /** Play a sensible move on behalf of a player who ran out of time. */
  _autoPlay(actorId) {
    if (!this.state || this._actorId() !== actorId || this.paused) return;
    const seat = this.seats.find((s) => s.id === actorId);
    const action = chooseAction(this.state, actorId) || { type: 'pass' };
    this.emit('toast', {
      text: `${seat?.name || 'Someone'} ran out of time — the crew acted for them.`,
      kind: 'bad',
    });
    this.submit(action, actorId);
  }

  _clearTimers() {
    clearTimeout(this._aiTimer);
    clearTimeout(this._timerHandle);
    clearTimeout(this._autoplayTimer);
    this._aiTimer = this._timerHandle = this._autoplayTimer = 0;
  }

  _broadcastDeadline() {
    for (const seat of this.seats) {
      if (seat.peerId) this.net.send(seat.peerId, { type: 'deadline', deadline: this._deadline });
    }
    this.emit('deadline', this._deadline);
  }

  _broadcastState({ effects = [], reset = false } = {}) {
    for (const seat of this.seats) {
      if (!seat.peerId) continue;
      this.net.send(seat.peerId, {
        type: MSG.STATE,
        view: viewFor(this.state, seat.id),
        effects,
        reset,
        deadline: this._deadline,
      });
    }
    this.emit('state', viewFor(this.state, this.myId), { effects, reset });
  }

  _pushLobby() {
    this.net.broadcast({ type: MSG.LOBBY, lobby: this.lobby });
  }

  get view() { return this.state ? viewFor(this.state, this.myId) : null; }
  get deadline() { return this._deadline; }

  legalActions() {
    return this.state ? legalActions(this.state, this.myId) : [];
  }

  leave() {
    this._clearTimers();
    clearInterval(this._pulseTimer);
    this._pulseTimer = 0;
    forgetHostSnapshot(this._store);
    this.net.destroy();
  }

  /**
   * The tab is closing, which for a host may only mean a refresh. Let
   * go of the room but leave the saved voyage where the next load can
   * find it.
   */
  detach() {
    this._persist();
    this._clearTimers();
    clearInterval(this._pulseTimer);
    this._pulseTimer = 0;
    this.net.destroy();
  }

  // ---- surviving the host's own reload ----

  /**
   * Everything needed to put this table back together. The host is the
   * only copy of the game, so a stray refresh used to end it for all
   * four players; the snapshot rides in sessionStorage and the room
   * code is reclaimed on the way back.
   */
  snapshot() {
    if (this.solo || !this.code || !this.state) return null;
    return {
      v: 1,
      at: Date.now(),
      code: this.code,
      phase: this.phase,
      options: this.options,
      name: this.seats[0]?.name,
      // Peer ids belong to connections that will not survive the
      // reload; the tokens are what bring people back to their seats.
      seats: this.seats.map((seat) => ({
        ...seat, peerId: null, lost: false,
        connected: !!(seat.isAI || seat.isHost),
      })),
      state: this.state,
      chat: this._chat.slice(-40),
    };
  }

  _persist() {
    if (this.solo || !this.code) return;
    const snap = this.snapshot();
    // Back in the lobby there is no voyage to come back to, and leaving
    // the last one in storage would offer a finished game after a
    // reload.
    if (!snap) { forgetHostSnapshot(this._store); return; }
    storeHostSnapshot(this._store, snap);
  }

  /**
   * Rebuild a host from a snapshot and reclaim its room code. Everyone
   * else is already looping on that code, so they come back by
   * themselves.
   */
  static async resume(snap, { timing = {}, transport = null, storage = null } = {}) {
    const session = new HostSession({ name: snap.name, options: snap.options, timing, transport, storage });
    session.phase = snap.phase;
    session.seats = snap.seats.map((seat) => ({ ...seat }));
    session.state = snap.state;
    session._chat = snap.chat || [];
    await session.open(snap.code);
    if (session.phase === 'playing' && session.state) {
      session._syncPause();
      session._broadcastState({ reset: true });
      session._scheduleTurn();
    }
    session.emit('lobby', session.lobby);
    return session;
  }
}

// A voyage in progress, parked where a reload can find it again. Same
// storage as the seat tokens: a refresh keeps it, a new tab does not.
const HOST_KEY = 'dbln-host';
export const HOST_SNAPSHOT_TTL = 20 * 60 * 1000;

function storeHostSnapshot(store, snap) {
  if (!snap) return;
  try { store?.setItem(HOST_KEY, JSON.stringify(snap)); } catch { /* no storage */ }
}

export function loadHostSnapshot(storage = null) {
  const store = browserStore(storage);
  try {
    const raw = store?.getItem(HOST_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.v !== 1 || !snap.code || !snap.state) return null;
    if (Date.now() - (snap.at || 0) > HOST_SNAPSHOT_TTL) { forgetHostSnapshot(store); return null; }
    return snap;
  } catch { return null; }
}

export function forgetHostSnapshot(storage = null) {
  const store = browserStore(storage);
  try { store?.removeItem(HOST_KEY); } catch { /* no storage */ }
}

// ------------------------------------------------------------
// Client
// ------------------------------------------------------------

export class ClientSession extends Emitter {
  constructor({ name, timing = {}, transport = null, storage = null } = {}) {
    super();
    this.isHost = false;
    this.myId = null;
    this.myName = cleanName(name, 'Deckhand');
    this.code = null;
    this.phase = 'lobby';
    this.timing = { ...NET_TIMING, ...timing };
    this._lobby = { code: null, phase: 'lobby', options: { ...DEFAULT_OPTIONS }, seats: [], chat: [] };
    this._view = null;
    this._deadline = 0;
    this._token = null;
    this._left = false;
    this._rejoining = false;
    this._waiting = [];
    this._graceUntil = 0;
    this._lastHeard = 0;
    this._pulseTimer = 0;
    this._store = browserStore(storage);
    this._makeTransport = transport || (() => new Client());
    this.net = this._makeTransport();
  }

  _wireNet() {
    this.net.on('message', (message) => {
      this._lastHeard = Date.now();
      this._onMessage(message);
    });
    this.net.on('disconnect', () => this._onDrop());
    this.net.on('kicked', () => {
      this._left = true;
      this._stopPulse();
      forgetToken(this._store, this.code);
      this.emit('lost', 'The host closed your seat.');
    });
    this.net.on('status', (status) => this.emit('status', status));
  }

  async join(rawCode) {
    const code = normaliseCode(rawCode);
    if (code.length < 4) throw new Error('A room code is four characters.');

    this._wireNet();
    await this.net.connect(code);
    this.code = code;
    this.myId = this.net.peer?.id || this.myId;
    this._token = readToken(this._store, code) || this._token;
    this._lastHeard = Date.now();
    this.net.send({ type: MSG.HELLO, name: this.myName, token: this._token });
    this._startPulse();
    return code;
  }

  /**
   * The other half of the host's liveness clock. A channel that has
   * gone quiet without closing looks exactly like a working one, so
   * say something on a timer and treat a long silence as a drop.
   */
  _startPulse() {
    if (this._pulseTimer) return;
    this._pulseTimer = setInterval(() => {
      if (this._left) return;
      const quiet = Date.now() - this._lastHeard;
      if (!this._rejoining && quiet > this.timing.hostTimeout) {
        // Nothing has come back for a long time. Assume the channel is
        // dead even though nobody said so, and go looking for the room.
        this._onDrop();
        return;
      }
      if (!this._rejoining && quiet > this.timing.heartbeat) {
        this.net.send({ type: MSG.PING, t: Date.now() });
      }
    }, this.timing.pulse);
  }

  _stopPulse() {
    clearInterval(this._pulseTimer);
    this._pulseTimer = 0;
  }

  /**
   * A dropped channel is not the end of the game any more. Rebuild the
   * peer from scratch -- reconnecting the old one is not possible once
   * PeerJS has closed it on ICE failure -- and present the seat token
   * to pick the game back up where it stopped.
   */
  async _onDrop() {
    if (this._left || this._rejoining) return;
    this._rejoining = true;
    this.emit('status', 'rejoining');

    // Keep at it for minutes, not seconds. The host may simply have
    // refreshed: they have to load the page again and reclaim the room
    // code from the broker before anyone can get back in.
    const until = Date.now() + this.timing.rejoinWindow;
    for (let attempt = 0; Date.now() < until && !this._left; attempt++) {
      const base = this.timing.rejoinDelay;
      await sleep(Math.min(base * 4, base + attempt * base * 0.5));
      if (this._left) break;
      try {
        try { this.net.destroy(); } catch { /* already gone */ }
        this.net = this._makeTransport();
        this._wireNet();
        await this.net.connect(this.code);
        this._lastHeard = Date.now();
        this.net.send({ type: MSG.HELLO, name: this.myName, token: this._token });
        this._rejoining = false;
        this.emit('status', 'connected');
        return;
      } catch {
        // Host still down, or the broker has not released the room yet.
      }
    }

    this._rejoining = false;
    if (!this._left) {
      this._stopPulse();
      // The seat token is deliberately left alone: as long as the host
      // is still holding the table, typing the code in again picks the
      // same hand back up.
      this.emit('lost', 'The connection to the host dropped.');
    }
  }

  /** Try the room again by hand, after giving up or being told to wait. */
  async retry() {
    if (!this.code) throw new Error('No room to go back to.');
    this._left = false;
    this._rejoining = false;
    try { this.net.destroy(); } catch { /* already gone */ }
    this.net = this._makeTransport();
    return this.join(this.code);
  }

  _onMessage(message) {
    if (!message || typeof message !== 'object') return;
    switch (message.type) {
      case 'welcome':
        this.code = message.code;
        break;
      case 'seated':
        // The host decides who we are; our peer id is not stable.
        this.myId = message.seatId;
        this._token = message.token || this._token;
        if (this._token) storeToken(this._store, this.code, this._token);
        break;
      case 'pong':
        break;  // the timestamp on it is all we needed
      case 'pause':
        this._waiting = message.waiting || [];
        this._graceUntil = message.until || 0;
        this.emit('paused', this._waiting, this._graceUntil);
        break;
      case 'lobby':
        this._lobby = message.lobby || this._lobby;
        this.phase = this._lobby.phase;
        this._waiting = this._lobby.waiting || [];
        this._graceUntil = this._lobby.graceUntil || 0;
        this.emit('lobby', this._lobby);
        break;
      case 'state':
        if (!message.view) break;
        this.phase = 'playing';
        this._view = message.view;
        this._deadline = message.deadline || 0;
        // Tells the host we are still here even on a turn we do not act
        // on, so a quiet player is never mistaken for a lost one.
        this.net.send({ type: MSG.ACK, version: message.view.version });
        this.emit('state', message.view, { effects: message.effects || [], reset: message.reset });
        if (message.view.phase === 'finished') this.emit('gameOver', message.view.finalStandings);
        break;
      case 'deadline':
        this._deadline = message.deadline || 0;
        this.emit('deadline', this._deadline);
        break;
      case 'reject':
        this.emit('reject', message.reason);
        break;
      case 'chatEcho':
        this._lobby.chat = [...(this._lobby.chat || []), message.entry].slice(-40);
        this.emit('chat', message.entry);
        break;
    }
  }

  get lobby() { return this._lobby; }
  get view() { return this._view; }
  get deadline() { return this._deadline; }
  get options() { return this._lobby.options; }

  submit(action) {
    this.net.send({ type: MSG.ACTION, action });
  }

  rename(name) {
    this.myName = cleanName(name, this.myName);
    this.net.send({ type: MSG.RENAME, name: this.myName });
  }

  sendChat(text) {
    this.net.send({ type: MSG.CHAT, text });
  }

  legalActions() {
    return this._view ? legalActions(rehydrate(this._view), this.myId) : [];
  }

  get paused() { return this._waiting.length > 0; }
  get waiting() { return this._waiting; }
  get graceUntil() { return this._graceUntil; }

  /** Leaving on purpose. The seat is given up for good. */
  leave() {
    this._left = true;
    this._stopPulse();
    forgetToken(this._store, this.code);
    const net = this.net;
    net.clearHandlers?.();   // we are gone; nothing more to react to
    net.send({ type: MSG.LEAVE });
    // Tearing the channel down in the same breath used to swallow the
    // goodbye, and the host would hold the table for someone who had
    // walked out of the door in front of them.
    setTimeout(() => { try { net.destroy(); } catch { /* already gone */ } }, 400);
  }

  /**
   * The tab is going away, but the player may not be -- a refresh looks
   * exactly like this. Drop the channel without surrendering the seat,
   * so reloading lands back in the same chair with the same cards. If
   * they really have gone, the host's grace clock covers for them.
   */
  detach() {
    this._left = true;
    this._stopPulse();
    try { this.net.destroy(); } catch { /* already gone */ }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Seat tokens live in sessionStorage so a reload rejoins the same seat,
// but a fresh tab is a fresh player. Private-mode browsers throw on the
// mere mention of it, and the simulation hands in a store of its own.
const tokenKey = (code) => `dbln-seat-${code}`;

export function browserStore(custom = null) {
  if (custom) return custom;
  try { return globalThis.sessionStorage || null; } catch { return null; }
}

function readToken(store, code) {
  try { return store?.getItem(tokenKey(code)) ?? null; } catch { return null; }
}
function storeToken(store, code, token) {
  try { store?.setItem(tokenKey(code), token); } catch { /* no storage */ }
}
function forgetToken(store, code) {
  try { store?.removeItem(tokenKey(code)); } catch { /* no storage */ }
}

/**
 * A client view has deckCounts instead of decks. The rules helpers
 * only read decks for deck-reserve legality, so put back something
 * of the right length.
 */
export function rehydrate(view) {
  if (!view) return null;
  if (view.decks) return view;
  const decks = {};
  for (const tier of [1, 2, 3]) {
    decks[tier] = new Array(view.deckCounts?.[tier] || 0).fill(null);
  }
  return { ...view, decks };
}

// ------------------------------------------------------------
// Local-only session (solo against the crew, no networking)
// ------------------------------------------------------------

export class SoloSession extends HostSession {
  constructor(opts) {
    super(opts);
    this.solo = true;
  }
  async open() {
    this.code = null;
    this.emit('lobby', this.lobby);
    return null;
  }
  _persist() { /* nothing to come back to */ }
  _startPulse() { /* nobody to keep an eye on */ }
  _pushLobby() { /* nobody to tell */ }
  _broadcastDeadline() { this.emit('deadline', this._deadline); }
  _broadcastState({ effects = [], reset = false } = {}) {
    this.emit('state', viewFor(this.state, this.myId), { effects, reset });
  }
  leave() { this._clearTimers(); }
}

export { seatDecor, SEAT_COLORS, SEAT_EMBLEM_NAMES, MAX_TOKENS_HELD, countTokens, playerById };
