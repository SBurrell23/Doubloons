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

/** Strip anything that would break the lobby list. */
export function cleanName(name, fallback = 'Captain') {
  const trimmed = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return trimmed || fallback;
}

// ------------------------------------------------------------
// Host
// ------------------------------------------------------------

export class HostSession extends Emitter {
  constructor({ name, options = {} } = {}) {
    super();
    this.isHost = true;
    this.myId = 'host';
    this.code = null;
    this.phase = 'lobby';
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.seats = [
      { id: 'host', name: cleanName(name, 'Captain'), isAI: false, peerId: null, connected: true, isHost: true },
    ];
    this.state = null;
    this.net = new Host();
    this._aiTimer = 0;
    this._timerHandle = 0;
    this._deadline = 0;
    this._autoplayTimer = 0;
    this._chat = [];
    this._wire();
  }

  // ---- lobby ----

  async open() {
    this.code = await this.net.open();
    this.emit('lobby', this.lobby);
    return this.code;
  }

  get lobby() {
    return {
      code: this.code,
      phase: this.phase,
      options: { ...this.options },
      seats: this.seats.map((seat, i) => ({ ...seat, ...seatDecor(i), seat: i })),
      chat: this._chat.slice(-40),
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
      if (this.phase === 'lobby') {
        this.seats = this.seats.filter((s) => s.peerId !== peerId);
        this.emit('toast', { text: `${seat.name} left the table.`, kind: 'bad' });
      } else {
        seat.connected = false;
        this.emit('toast', { text: `${seat.name} lost their connection. The crew will cover.`, kind: 'bad' });
        this._scheduleTurn();
      }
      this._pushLobby();
      this.emit('lobby', this.lobby);
    });

    this.net.on('error', (error) => this.emit('error', error));
  }

  _onMessage(peerId, message) {
    if (!message || typeof message !== 'object') return;

    switch (message.type) {
      case MSG.HELLO: {
        const existing = this.seats.find((s) => s.peerId === peerId);
        if (existing) return;
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
        this.seats.push({ id: peerId, name, isAI: false, peerId, connected: true, isHost: false });
        this.emit('toast', { text: `${name} joined the table.`, kind: 'good', sound: 'join' });
        this._pushLobby();
        this.emit('lobby', this.lobby);
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
        this.net.kick(peerId);
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
    this._pushLobby();
    this._broadcastState({ reset: true });
    this._scheduleTurn();
    return true;
  }

  /** Back to the lobby with the same crew. */
  rematch() {
    if (this.phase !== 'playing') return;
    this._clearTimers();
    this.phase = 'lobby';
    this.state = null;
    this._pushLobby();
    this.emit('lobby', this.lobby);
    this.net.broadcast({ type: MSG.LOBBY, lobby: this.lobby });
  }

  // ---- gameplay ----

  submit(action, playerId = this.myId) {
    if (this.phase !== 'playing' || !this.state) return;
    const result = validate(this.state, playerId, action);
    if (!result.ok) {
      if (playerId === this.myId) this.emit('reject', result.reason);
      else {
        const seat = this.seats.find((s) => s.id === playerId);
        if (seat?.peerId) this.net.send(seat.peerId, { type: MSG.REJECT, reason: result.reason });
      }
      return;
    }
    const effects = apply(this.state, playerId, action);
    this._broadcastState({ effects });
    if (this.state.phase === 'finished') {
      this._clearTimers();
      this.emit('gameOver', standings(this.state));
    } else {
      this._scheduleTurn();
    }
  }

  /** Who the game is waiting on right now. */
  _actorId() {
    if (!this.state) return null;
    if (this.state.pending) return this.state.pending.playerId;
    return currentPlayer(this.state).id;
  }

  _scheduleTurn() {
    this._clearTimers();
    if (!this.state || this.state.phase === 'finished') return;

    const actorId = this._actorId();
    const seat = this.seats.find((s) => s.id === actorId);
    if (!seat) return;

    if (seat.isAI) {
      this._aiTimer = setTimeout(() => this._playAi(actorId), aiDelay(this.options.aiSpeed));
      return;
    }

    if (!seat.connected) {
      // Cover for someone who dropped, so the table is not stuck.
      this._autoplayTimer = setTimeout(() => this._autoPlay(actorId, 'disconnected'), 4000);
      return;
    }

    if (this.options.turnTimer > 0) {
      this._deadline = Date.now() + this.options.turnTimer * 1000;
      this._broadcastDeadline();
      this._timerHandle = setTimeout(() => this._autoPlay(actorId, 'timeout'), this.options.turnTimer * 1000 + 250);
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
  _autoPlay(actorId, reason) {
    if (!this.state || this._actorId() !== actorId) return;
    const seat = this.seats.find((s) => s.id === actorId);
    const action = chooseAction(this.state, actorId) || { type: 'pass' };
    this.emit('toast', {
      text: reason === 'timeout'
        ? `${seat?.name || 'Someone'} ran out of time — the crew acted for them.`
        : `${seat?.name || 'Someone'} is adrift — the crew acted for them.`,
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
    this.net.destroy();
  }
}

// ------------------------------------------------------------
// Client
// ------------------------------------------------------------

export class ClientSession extends Emitter {
  constructor({ name } = {}) {
    super();
    this.isHost = false;
    this.myId = null;
    this.myName = cleanName(name, 'Deckhand');
    this.code = null;
    this.phase = 'lobby';
    this._lobby = { code: null, phase: 'lobby', options: { ...DEFAULT_OPTIONS }, seats: [], chat: [] };
    this._view = null;
    this._deadline = 0;
    this.net = new Client();
  }

  async join(rawCode) {
    const code = normaliseCode(rawCode);
    if (code.length < 4) throw new Error('A room code is four characters.');

    this.net.on('message', (message) => this._onMessage(message));
    this.net.on('disconnect', () => this.emit('lost', 'The connection to the host dropped.'));
    this.net.on('kicked', () => this.emit('lost', 'The host closed your seat.'));
    this.net.on('status', (status) => this.emit('status', status));

    await this.net.connect(code);
    this.code = code;
    this.myId = this.net.peer.id;
    this.net.send({ type: MSG.HELLO, name: this.myName });
    return code;
  }

  _onMessage(message) {
    if (!message || typeof message !== 'object') return;
    switch (message.type) {
      case 'welcome':
        this.code = message.code;
        break;
      case 'lobby':
        this._lobby = message.lobby;
        this.phase = message.lobby.phase;
        this.emit('lobby', this._lobby);
        break;
      case 'state':
        this.phase = 'playing';
        this._view = message.view;
        this._deadline = message.deadline || 0;
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

  leave() {
    this.net.send({ type: MSG.LEAVE });
    this.net.destroy();
  }
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
  _pushLobby() { /* nobody to tell */ }
  _broadcastDeadline() { this.emit('deadline', this._deadline); }
  _broadcastState({ effects = [], reset = false } = {}) {
    this.emit('state', viewFor(this.state, this.myId), { effects, reset });
  }
  leave() { this._clearTimers(); }
}

export { seatDecor, SEAT_COLORS, SEAT_EMBLEM_NAMES, MAX_TOKENS_HELD, countTokens, playerById };
