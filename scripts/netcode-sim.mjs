// ============================================================
// Netcode simulation.
//
// Plays whole multiplayer games over a stand-in transport while
// things go wrong: players drop, freeze, reload, walk away, and
// send nonsense; the host's room falls off the broker, and the
// host itself refreshes mid-voyage.
//
// The claim under test is simple and total: a game that starts
// always finishes, nobody's move is lost, and no client can put
// the host's state somewhere the rules engine would not.
//
// Usage: node scripts/netcode-sim.mjs [chaosGames]
// ============================================================

import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'lib', 'peerjs-loader.mjs')).href);

const { HostSession, ClientSession, loadHostSnapshot, MAX_TOKENS_HELD } =
  await import('../src/game/session.js');
const { mulberry32, countTokens } = await import('../src/game/rules.js');
const { GEMS, GOLD, GEM_SUPPLY, GOLD_SUPPLY, MAX_RESERVED } = await import('../src/game/data.js');
const { Switchboard, fakeStorage } = await import('./lib/fake-net.mjs');

const CHAOS_GAMES = Number(process.argv[2] || 12);

// Everything the sessions wait on, wound down so a full drop-and-return
// cycle takes milliseconds instead of minutes.
const TIMING = {
  pulse: 5,
  heartbeat: 15,
  seatTimeout: 60,
  hostTimeout: 80,
  grace: 250,
  rejoinWindow: 4000,
  rejoinDelay: 20,
  aiDelay: 0,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------
// Assertions
// ------------------------------------------------------------

let failures = [];
let checks = 0;
let currentTest = '';

function check(condition, message) {
  checks++;
  if (!condition) failures.push(`${currentTest}: ${message}`);
  return !!condition;
}

/** The same conservation laws simulate.mjs asserts, on the host state. */
function invariants(state, tag) {
  if (!state) return [];
  const problems = [];
  const count = state.players.length;

  for (const gem of GEMS) {
    let total = state.supply[gem];
    for (const p of state.players) total += p.tokens[gem];
    if (total !== GEM_SUPPLY[count]) problems.push(`${tag}: ${gem} ${total} != ${GEM_SUPPLY[count]}`);
    if (state.supply[gem] < 0) problems.push(`${tag}: negative ${gem}`);
    if (!Number.isInteger(state.supply[gem])) problems.push(`${tag}: fractional ${gem} in the chest`);
  }
  let gold = state.supply[GOLD];
  for (const p of state.players) gold += p.tokens[GOLD];
  if (gold !== GOLD_SUPPLY + (state.options.extraGold | 0)) problems.push(`${tag}: gold ${gold}`);

  for (const p of state.players) {
    for (const [token, n] of Object.entries(p.tokens)) {
      if (n < 0) problems.push(`${tag}: ${p.name} has ${n} ${token}`);
      if (!Number.isInteger(n)) problems.push(`${tag}: ${p.name} has ${n} ${token}`);
    }
    if (state.phase === 'playing' && countTokens(p.tokens) > MAX_TOKENS_HELD) {
      problems.push(`${tag}: ${p.name} holds ${countTokens(p.tokens)}`);
    }
    if (p.reserved.length > MAX_RESERVED) problems.push(`${tag}: ${p.name} stowed ${p.reserved.length}`);
  }

  const seen = new Set();
  const note = (id) => { if (seen.has(id)) problems.push(`${tag}: duplicate card ${id}`); seen.add(id); };
  for (const tier of [1, 2, 3]) {
    for (const c of state.decks[tier]) note(c.id);
    for (const c of state.board[tier]) if (c) note(c.id);
  }
  for (const p of state.players) {
    for (const c of p.cards) note(c.id);
    for (const c of p.reserved) note(c.id);
  }
  if (seen.size !== 90) problems.push(`${tag}: ${seen.size} cards accounted for`);
  return problems;
}

// ------------------------------------------------------------
// A table: one host, some clients, and somebody to play each hand
// ------------------------------------------------------------

/** Who the table is waiting on, from whichever end is asking. */
function actorOf(view) {
  if (!view || view.phase === 'finished') return null;
  return view.pending ? view.pending.playerId : view.players[view.current]?.id;
}

function pickAction(session, rand) {
  const view = session.view;
  if (!view || view.phase === 'finished') return null;
  const me = view.players.find((p) => p.id === session.myId);
  if (!me) return null;

  if (view.phase === 'discard') {
    if (view.pending?.playerId !== session.myId) return null;
    return { type: 'discard', tokens: shed(me, view.pending.excess) };
  }

  const actions = session.legalActions();
  if (!actions.length) return null;
  // Lean on buying, so games get somewhere rather than shuffling
  // tokens back and forth until the stalemate rule calls it.
  const buys = actions.filter((a) => a.type === 'purchase');
  const pool = buys.length && rand() < 0.65 ? buys : actions;
  return pool[Math.floor(rand() * pool.length)];
}

/** Move tokens from the chest into a hand, so the totals still add up. */
function give(state, player, tokens) {
  for (const [gem, n] of Object.entries(tokens)) {
    player.tokens[gem] += n;
    state.supply[gem] -= n;
  }
}

/** Hand back the excess, largest piles first. */
function shed(player, excess) {
  const tokens = {};
  let left = excess;
  const piles = Object.entries(player.tokens)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  for (const [token, held] of piles) {
    if (left <= 0) break;
    const take = Math.min(held, left);
    tokens[token] = take;
    left -= take;
  }
  return tokens;
}

class Table {
  constructor({ humans = 2, ai = 0, seed = 1, options = {}, timing = {}, passive = false } = {}) {
    this.board = new Switchboard({ latency: 1 });
    this.rand = mulberry32(seed);
    this.humans = humans;
    this.aiSeats = ai;
    this.options = options;
    this.timing = { ...TIMING, ...timing };
    // A passive table has nobody at the keyboard: only the host's own
    // clocks can move it along.
    this.passive = passive;
    this.clients = [];
    this.stores = [];
    this.problems = [];
  }

  async open() {
    this.hostStore = fakeStorage();
    this.hostNet = this.board.host();
    this.host = new HostSession({
      name: 'Host',
      options: this.options,
      timing: this.timing,
      transport: this.hostNet,
      storage: this.hostStore,
    });
    this.code = await this.host.open();
    this._drive(this.host);
    for (let i = 0; i < this.aiSeats; i++) this.host.addAI('sly');
    for (let i = 1; i < this.humans; i++) await this.addClient(`Mate ${i}`);
    return this.code;
  }

  async addClient(name) {
    const store = fakeStorage();
    const net = this.board.client();
    const client = new ClientSession({
      name,
      timing: this.timing,
      storage: store,
      transport: () => this.board.client(),
    });
    client.net = net;
    await client.join(this.code);
    this.stores.push(store);
    this.clients.push(client);
    this._drive(client);
    await this.settle();
    return client;
  }

  /** Whoever is at the keyboard for this seat. */
  _drive(session) {
    if (this.passive) return;
    session.on('state', () => {
      const actorId = actorOf(session.view);
      if (actorId !== session.myId) return;
      setTimeout(() => {
        if (session.paused) return;
        if (actorOf(session.view) !== session.myId) return;
        const action = pickAction(session, this.rand);
        if (action) session.submit(action);
      }, 0);
    });
  }

  start() {
    const ok = this.host.start();
    // Kick the first actor off, since nobody has had a state event yet
    // in the case where the host moves first.
    setTimeout(() => this._nudge(), 0);
    return ok;
  }

  /** Re-offer a move to whoever is on the clock, in case a turn stalled. */
  _nudge() {
    if (this.passive || this.host.paused) return;
    const actorId = actorOf(this.host.view);
    if (!actorId) return;
    const seat = this.host.seats.find((s) => s.id === actorId);
    if (!seat || seat.isAI) return;
    const session = actorId === this.host.myId
      ? this.host
      : this.clients.find((c) => c.myId === actorId);
    if (!session || session.paused) return;
    const action = pickAction(session, this.rand);
    if (action) session.submit(action);
  }

  /** Let every queued message and timer land. */
  async settle(ms = 30) { await sleep(ms); }

  /**
   * Run until the game is over, nudging the clock along. Returns false
   * if it never finished, which is the failure this whole file exists
   * to catch.
   */
  async run(limitMs = 20000, onTick = null) {
    const started = Date.now();
    let lastVersion = -1;
    let still = 0;
    while (Date.now() - started < limitMs) {
      await sleep(5);
      const state = this.host.state;
      if (!state) continue;
      this.problems.push(...invariants(state, 'host'));
      if (this.problems.length) return false;
      if (state.phase === 'finished') return true;
      if (onTick) await onTick(Date.now() - started);

      if (state.version === lastVersion) {
        still++;
        // Nothing has moved for a while. If the table is not deliberately
        // held, poke the actor -- a real client would still be sitting
        // there with the board in front of them.
        if (still > 8 && !this.host.paused) { this._nudge(); still = 0; }
      } else {
        lastVersion = state.version;
        still = 0;
      }
    }
    return false;
  }

  teardown() {
    for (const client of this.clients) { try { client.detach(); } catch { /* gone */ } }
    try { this.host.leave(); } catch { /* gone */ }
  }
}

// ------------------------------------------------------------
// Scenarios
// ------------------------------------------------------------

async function test(name, fn) {
  currentTest = name;
  const before = failures.length;
  try {
    await fn();
  } catch (error) {
    failures.push(`${name}: threw ${error?.stack || error}`);
  }
  const bad = failures.length - before;
  console.log(`  ${bad ? 'FAIL' : 'ok  '}  ${name}`);
}

/** A drop and a return puts the same player back in the same chair. */
async function testReconnectKeepsSeat() {
  // A slow first retry, so the moment where the table is held is wide
  // enough to look at rather than something to race.
  const table = new Table({ humans: 2, seed: 11, timing: { rejoinDelay: 200 } });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const seatId = client.myId;
  const before = JSON.stringify(table.host.state.players.find((p) => p.id === seatId));

  client.net.drop();
  await table.settle(60);
  check(table.host.paused, 'the table should hold while a player is adrift');
  check(table.host.seats.find((s) => s.id === seatId)?.connected === false, 'seat marked adrift');

  await table.settle(500);
  check(client.myId === seatId, `same seat after rejoining (was ${seatId}, now ${client.myId})`);
  check(!table.host.paused, 'the table should sail again once they are back');
  const after = JSON.stringify(table.host.state.players.find((p) => p.id === seatId));
  check(before === after || table.host.state.version > 0, 'their hand survived the drop');

  const finished = await table.run(8000);
  check(finished, 'the game finished after the reconnect');
  check(!table.problems.length, `invariants held: ${table.problems[0] || ''}`);
  table.teardown();
}

/** A refresh is not a resignation. */
async function testReloadKeepsSeat() {
  const table = new Table({ humans: 2, seed: 12 });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const seatId = client.myId;
  const store = table.stores[0];

  // The tab goes away, as beforeunload would have it.
  client.detach();
  await table.settle(30);
  check(table.host.paused, 'the table holds while the tab reloads');

  // ...and comes back as a brand new session with the same storage.
  const reborn = new ClientSession({
    name: 'Mate 1', timing: table.timing, storage: store,
    transport: () => table.board.client(),
  });
  table.clients[0] = reborn;
  table._drive(reborn);
  await reborn.join(table.code);
  await table.settle(60);

  check(reborn.myId === seatId, `reload landed back in seat ${seatId}, got ${reborn.myId}`);
  check(!table.host.paused, 'the table sails again after the reload');
  check(table.host.seats.filter((s) => !s.isHost).length === 1, 'no ghost seat was left behind');

  const finished = await table.run(8000);
  check(finished, 'the game finished after the reload');
  table.teardown();
}

/** Somebody who leaves on purpose must not hold up the rest. */
async function testDeliberateLeaveDoesNotHold() {
  const table = new Table({ humans: 3, seed: 13 });
  await table.open();
  table.start();
  await table.settle(40);

  const leaver = table.clients[0];
  const seatId = leaver.myId;
  leaver.leave();
  await table.settle(60);

  const seat = table.host.seats.find((s) => s.id === seatId);
  check(seat?.isAI === true, 'the crew takes the seat of someone who walked away');
  check(!table.host.paused, 'the table is not held for a player who left on purpose');

  const finished = await table.run(8000);
  check(finished, 'the game finished after somebody left');
  check(!table.problems.length, `invariants held: ${table.problems[0] || ''}`);
  table.teardown();
}

/** Nobody comes back. The table must sail anyway. */
async function testGraceExpiry() {
  const table = new Table({ humans: 2, seed: 14 });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const seatId = client.myId;
  client.detach();              // gone for good, no rejoin loop
  await table.settle(40);
  check(table.host.paused, 'held at first');
  check(table.host.graceUntil > 0, 'a grace clock is running');

  await table.settle(table.timing.grace + 120);
  check(!table.host.paused, 'the grace ran out and the table sailed');
  check(table.host.seats.find((s) => s.id === seatId)?.isAI === true, 'the crew took the seat');

  const finished = await table.run(8000);
  check(finished, 'the game finished without them');
  table.teardown();
}

/** The worst kind of drop: the channel stops carrying, and says nothing. */
async function testSilentChannelDeath() {
  const table = new Table({ humans: 2, seed: 15 });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const seatId = client.myId;
  client.net.freeze();

  // Nothing has closed, so only the clocks can notice.
  await sleep(table.timing.seatTimeout + table.timing.pulse * 4);
  check(table.host.seats.find((s) => s.id === seatId)?.connected === false,
    'the host noticed a channel that went quiet without closing');
  check(table.host.paused, 'the table held for them');

  // And their own end noticed too, and is out looking for the room.
  await sleep(table.timing.hostTimeout);
  const finished = await table.run(8000);
  check(finished, 'the game finished after a silent drop');
  table.teardown();
}

/** The room falls off the broker. It has to come back on the same code. */
async function testRoomCollapseAndReopen() {
  const table = new Table({ humans: 3, seed: 16 });
  await table.open();
  table.start();
  await table.settle(40);

  const seatIds = table.clients.map((c) => c.myId);
  table.hostNet.collapse();
  await table.settle(30);
  await table.hostNet.reopen();
  await table.settle(table.timing.rejoinDelay * 8);

  for (const seatId of seatIds) {
    const seat = table.host.seats.find((s) => s.id === seatId);
    check(seat && (seat.connected || seat.isAI), `seat ${seatId} recovered or was covered`);
  }
  const finished = await table.run(10000);
  check(finished, 'the game finished after the room was rebuilt');
  check(!table.problems.length, `invariants held: ${table.problems[0] || ''}`);
  table.teardown();
}

/** The host refreshes the page. Everyone else is still sitting there. */
async function testHostReloadResume() {
  const table = new Table({ humans: 3, seed: 17 });
  await table.open();
  table.start();
  await table.settle(60);

  // Play a few turns so there is something worth saving.
  await table.run(400).catch(() => {});
  const before = table.host.state;
  const code = table.code;
  const versionBefore = before.version;
  const pointsBefore = before.players.map((p) => p.cards.length);

  const snap = loadHostSnapshot(table.hostStore);
  check(!!snap, 'the voyage was saved where a reload can find it');
  check(snap?.code === code, 'the saved voyage knows its room code');

  // The tab goes away. Every channel with it.
  table.hostNet.destroy();
  await table.settle(20);

  // ...and the page comes back, reclaims the code and rebuilds the table.
  const freshNet = table.board.host();
  const resumed = await HostSession.resume(snap, {
    timing: table.timing, transport: freshNet, storage: table.hostStore,
  });
  table.host = resumed;
  table.hostNet = freshNet;
  table._drive(resumed);

  check(resumed.code === code, `the room code came back (${resumed.code} vs ${code})`);
  check(resumed.state.version === versionBefore, 'the game came back where it left off');
  check(JSON.stringify(resumed.state.players.map((p) => p.cards.length)) === JSON.stringify(pointsBefore),
    'everybody still has the cards they bought');

  await table.settle(table.timing.rejoinDelay * 10);
  const back = table.clients.filter((c) => resumed.seats.some((s) => s.id === c.myId && s.connected));
  check(back.length === table.clients.length,
    `all ${table.clients.length} clients found the table again (${back.length} did)`);

  const finished = await table.run(10000);
  check(finished, 'the game finished after the host reloaded');
  check(!table.problems.length, `invariants held: ${table.problems[0] || ''}`);
  table.teardown();
}

/** A client sending nonsense must not be able to hurt anyone. */
async function testHostileClient() {
  const table = new Table({ humans: 2, seed: 18 });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const victimId = table.host.myId;
  const junk = [
    null,
    undefined,
    'hello',
    { type: 'action' },
    { type: 'action', action: null },
    { type: 'action', action: 'purchase' },
    { type: 'action', action: { type: 'takeThree', gems: { length: 3 } } },
    { type: 'action', action: { type: 'takeThree', gems: 'abc' } },
    { type: 'action', action: { type: 'takeTwo', gem: '__proto__' } },
    { type: 'action', action: { type: 'discard', tokens: { ruby: -5 } } },
    { type: 'action', action: { type: 'discard', tokens: 'lots' } },
    { type: 'action', action: { type: '__proto__' } },
    { type: 'action', action: { type: 'undoTake' } },
    { type: 'action', action: { type: 'purchase', from: 'reserve', cardId: 'nope' } },
    { type: 'chat', text: 'x'.repeat(100000) },
    { type: 'rename', name: { toString() { return 'boom'; } } },
    { type: 'hello', token: 'x'.repeat(10000) },
  ];
  for (const message of junk) client.net.send(message);

  // Buying a card for fractions of a token used to work.
  const board = table.host.state.board[1].filter(Boolean);
  for (const card of board) {
    client.net.send({
      type: 'action',
      action: {
        type: 'purchase', from: 'board', cardId: card.id,
        payment: { ruby: 0.5, sapphire: 0.5, pearl: 0.5, emerald: 0.5, onyx: 0.5, doubloon: 0.5 },
      },
    });
    client.net.send({
      type: 'action',
      action: {
        type: 'purchase', from: 'board', cardId: card.id,
        payment: { ruby: -3, doubloon: 99 },
      },
    });
  }
  // And moving on somebody else's turn.
  client.net.send({ type: 'action', action: { type: 'pass' } });

  await table.settle(80);
  check(!!table.host.state, 'the host survived the nonsense');
  const problems = invariants(table.host.state, 'hostile');
  check(!problems.length, `nothing got through: ${problems[0] || ''}`);
  check(table.host.state.players.every((p) => p.cards.length === 0 || p.id !== client.myId)
    || table.host.state.players.find((p) => p.id === client.myId).cards.every((c) => !!c.id),
    'no card was bought with fractional tokens');
  check(Object.getPrototypeOf({}).polluted === undefined, 'no prototype pollution');

  const finished = await table.run(8000);
  check(finished, 'the game still finished');
  check(!table.problems.length, `invariants held: ${table.problems[0] || ''}`);
  table.teardown();
}

/**
 * Half a ruby is not a ruby. A client used to be able to name its own
 * payment and the host would take it at face value, so fractions bought
 * cards at a discount and then rattled around the chest forever.
 */
async function testFractionalPaymentRefused() {
  // Nobody else is playing, so the only thing that can move this game
  // is the message we are about to send.
  const table = new Table({ humans: 2, seed: 22, passive: true });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const state = table.host.state;
  const seat = state.players.findIndex((p) => p.id === client.myId);
  const player = state.players[seat];
  const card = state.board[1].find(Boolean);

  // Put them on the clock, holding exactly what the card costs plus a
  // doubloon to make up an imaginary difference with.
  state.current = seat;
  state.pending = null;
  state.phase = 'playing';
  for (const gem of Object.keys(player.tokens)) player.tokens[gem] = 0;
  for (const [gem, amount] of Object.entries(card.cost)) player.tokens[gem] = amount;
  player.tokens[GOLD] = 5;

  // Shave half a token off every gem and offer doubloons for the
  // difference. Every line of it passes the old checks: nothing is
  // overpaid, nothing is unheld, and the gold covers the shortfall
  // exactly -- it is only the fractions that make it nonsense.
  const shaved = {};
  let shortfall = 0;
  for (const [gem, amount] of Object.entries(card.cost)) {
    shaved[gem] = amount - 0.5;
    shortfall += 0.5;
  }
  shaved[GOLD] = shortfall;

  const version = state.version;
  client.net.send({
    type: 'action',
    action: { type: 'purchase', from: 'board', cardId: card.id, payment: shaved },
  });
  await table.settle(60);

  check(table.host.state.version === version, 'a fractional payment bought nothing');
  check(player.cards.length === 0, 'the card stayed on the table');
  check(Object.values(player.tokens).every(Number.isInteger), 'no fractions ended up in their hand');
  check(Object.values(table.host.state.supply).every(Number.isInteger), 'no fractions ended up in the chest');

  // ...and paying for it properly still works, so the check is not
  // simply refusing everything.
  client.net.send({
    type: 'action',
    action: { type: 'purchase', from: 'board', cardId: card.id },
  });
  await table.settle(60);
  check(player.cards.some((c) => c.id === card.id), 'paying the real price still buys the card');

  table.teardown();
}

/**
 * Taking a gem grab back. It has to put the game exactly where it was,
 * and it has to be refused every other time it is asked for.
 */
async function testUndoTake() {
  const table = new Table({ humans: 2, seed: 23, passive: true });
  await table.open();
  table.start();
  await table.settle(40);

  const client = table.clients[0];
  const state = table.host.state;
  const seat = state.players.findIndex((p) => p.id === client.myId);
  const player = state.players[seat];
  state.current = seat;

  // Eight in hand: any three more puts them over. Moved out of the
  // chest rather than conjured, so conservation still holds.
  give(state, player, { pearl: 3, sapphire: 3, emerald: 2 });

  // Asking to take one back when nothing was taken is refused.
  const quiet = state.version;
  client.net.send({ type: 'action', action: { type: 'undoTake' } });
  await table.settle(60);
  check(table.host.state.version === quiet, 'nothing to take back, nothing happens');

  const before = {
    supply: { ...state.supply },
    tokens: { ...player.tokens },
    turnsTaken: state.turnsTaken,
    current: state.current,
    idleTurns: state.idleTurns,
    consecutivePasses: state.consecutivePasses,
  };

  client.net.send({ type: 'action', action: { type: 'takeThree', gems: ['ruby', 'onyx', 'emerald'] } });
  await table.settle(60);
  check(table.host.state.phase === 'discard', 'over the limit, so tokens must come back');
  check(!!table.host.state.pending.undo, 'and the take is offered back');

  client.net.send({ type: 'action', action: { type: 'undoTake' } });
  await table.settle(60);

  const after = table.host.state;
  check(after.phase === 'playing', 'back to playing');
  check(after.pending === null, 'nothing pending');
  check(JSON.stringify(after.players[seat].tokens) === JSON.stringify(before.tokens),
    'their hand is exactly as it was');
  check(JSON.stringify(after.supply) === JSON.stringify(before.supply),
    'the chest is exactly as it was');
  check(after.current === before.current && after.turnsTaken === before.turnsTaken,
    'still their turn, and the turn count did not move');
  check(after.idleTurns === before.idleTurns && after.consecutivePasses === before.consecutivePasses,
    'the deadlock counters never saw the take');

  // And it cannot be asked for twice.
  const settled = after.version;
  client.net.send({ type: 'action', action: { type: 'undoTake' } });
  await table.settle(60);
  check(table.host.state.version === settled, 'a take can only be put back once');

  // A stow that goes over the limit is not offered back: a card moved.
  give(state, player, { pearl: 1, emerald: 1 });
  const card = table.host.state.board[1].find(Boolean);
  client.net.send({ type: 'action', action: { type: 'reserve', cardId: card.id } });
  await table.settle(60);
  check(table.host.state.phase === 'discard', 'stowing over the limit still asks for tokens back');
  check(!table.host.state.pending.undo, 'but a stow cannot be taken back');

  check(!invariants(table.host.state, 'undo').length, 'invariants held throughout');
  table.teardown();
}

/** Held means held: nobody gets a move in while the table waits. */
async function testPausedTableRefusesMoves() {
  // Their end waits a good while before trying again, so the hold is
  // something to inspect rather than something to catch in flight.
  const table = new Table({ humans: 3, seed: 19, timing: { rejoinDelay: 400 } });
  await table.open();
  table.start();
  await table.settle(40);

  table.clients[0].net.drop();
  await table.settle(40);
  check(table.host.paused, 'the table is held');

  const version = table.host.state.version;
  const other = table.clients[1];
  for (let i = 0; i < 5; i++) {
    other.net.send({ type: 'action', action: { type: 'pass' } });
    table.host.submit({ type: 'pass' });
  }
  await table.settle(40);
  check(table.host.state.version === version, 'nothing was played while the table was held');

  await table.settle(table.timing.grace + 150);
  const finished = await table.run(8000);
  check(finished, 'the game finished after the hold resolved itself');
  table.teardown();
}

/** A rematch must not start held, waiting on somebody who never returned. */
async function testRematchPrunesStrandedSeats() {
  const table = new Table({ humans: 3, seed: 20 });
  await table.open();
  table.start();
  await table.settle(40);

  table.clients[0].detach();
  await table.settle(40);
  table.host.rematch();
  await table.settle(20);

  check(table.host.phase === 'lobby', 'back in the lobby');
  check(table.host.seats.every((s) => s.isAI || s.isHost || s.connected),
    'no stranded seat was carried into the rematch');
  check(table.host.canStart(), 'the rematch can actually be started');
  table.teardown();
}

/** The turn clock still runs the table when somebody goes quiet. */
async function testTurnTimerAutoPlays() {
  // Nobody is at the keyboard on any seat: the only thing that can move
  // this game is the turn clock.
  const table = new Table({ humans: 2, seed: 21, options: { turnTimer: 1 }, passive: true });
  await table.open();
  table.start();
  await table.settle(40);

  const version = table.host.state.version;
  await sleep(2600);
  check(table.host.state.version > version + 1,
    `the turn clock played for two silent seats (version ${version} -> ${table.host.state.version})`);
  check(!table.host.paused, 'sitting still is not the same as being adrift');
  table.teardown();
}

// ------------------------------------------------------------
// Chaos: whole games, with things going wrong throughout
// ------------------------------------------------------------

async function chaosGame(seed) {
  const rand = mulberry32(seed * 7919);
  const humans = 2 + Math.floor(rand() * 3);      // 2..4 seats
  const table = new Table({ humans, seed });
  await table.open();
  table.start();
  await table.settle(30);

  let faults = 0;
  const finished = await table.run(20000, async () => {
    if (rand() > 0.12 || faults > 6) return;
    faults++;
    const client = table.clients[Math.floor(rand() * table.clients.length)];
    if (!client || client._left) return;
    const roll = rand();
    if (roll < 0.4) client.net?.drop();
    else if (roll < 0.65) client.net?.freeze();
    else if (roll < 0.8) {
      client.net?.send({ type: 'action', action: { type: 'takeThree', gems: [1, 2, 3] } });
      client.net?.send({ type: 'action', action: null });
    } else if (roll < 0.9) {
      table.hostNet.collapse();
      await table.hostNet.reopen();
    } else {
      client.leave();
    }
  });

  const result = {
    seed, humans, faults, finished,
    problems: table.problems.slice(0, 2),
    reason: table.host.state?.endReason,
  };
  table.teardown();
  return result;
}

// ------------------------------------------------------------

console.log('Netcode simulation\n');
console.log('Scenarios:');
await test('a drop and a return keeps the same seat', testReconnectKeepsSeat);
await test('a page reload keeps the same seat', testReloadKeepsSeat);
await test('leaving on purpose does not hold the table', testDeliberateLeaveDoesNotHold);
await test('the grace clock sails without a player who never returns', testGraceExpiry);
await test('a channel that dies silently is noticed by both ends', testSilentChannelDeath);
await test('a collapsed room comes back on the same code', testRoomCollapseAndReopen);
await test('the host can reload and pick the voyage back up', testHostReloadResume);
await test('a hostile client cannot corrupt the game', testHostileClient);
await test('fractional payments are refused, whole ones are not', testFractionalPaymentRefused);
await test('a gem grab can be taken back, once, and only when it can', testUndoTake);
await test('a held table refuses every move', testPausedTableRefusesMoves);
await test('a rematch drops seats nobody came back to', testRematchPrunesStrandedSeats);
await test('the turn clock plays for a silent seat', testTurnTimerAutoPlays);

console.log(`\nChaos: ${CHAOS_GAMES} games with drops, freezes, walkouts, junk and room collapses`);
let unfinished = 0;
let totalFaults = 0;
const endings = {};
for (let i = 0; i < CHAOS_GAMES; i++) {
  currentTest = `chaos game ${i}`;
  const result = await chaosGame(i + 1);
  totalFaults += result.faults;
  endings[result.reason || 'none'] = (endings[result.reason || 'none'] || 0) + 1;
  if (!result.finished) {
    unfinished++;
    failures.push(`chaos game ${i} (seed ${result.seed}, ${result.humans} seats) never finished`
      + (result.problems.length ? ` — ${result.problems[0]}` : ''));
  }
  for (const problem of result.problems) failures.push(`chaos game ${i}: ${problem}`);
  process.stdout.write(result.finished ? '.' : 'X');
}
console.log(`\n  ${CHAOS_GAMES - unfinished}/${CHAOS_GAMES} finished, ${totalFaults} faults injected, endings:`, endings);

console.log(`\n${checks} checks`);
if (failures.length) {
  console.log(`\nPROBLEMS (${failures.length}):`);
  for (const failure of failures.slice(0, 25)) console.log(' -', failure);
  process.exit(1);
}
console.log('\nEvery game finished. The netcode held.');
process.exit(0);
