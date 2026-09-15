// ============================================================
// Doubloons! — rules engine
//
// Pure and deterministic. The host owns one instance of this
// state and broadcasts snapshots; clients only send intents.
// ============================================================

import {
  GEMS, GOLD, ALL_TOKENS, buildDecks, LORDS, LORD_POINTS,
  GEM_SUPPLY, GOLD_SUPPLY, MAX_TOKENS_HELD, MAX_RESERVED,
  DEFAULT_TARGET_POINTS,
} from './data.js';

// ---------- deterministic RNG ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rand) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- small helpers ----------

export function emptyPile() {
  const pile = {};
  for (const t of ALL_TOKENS) pile[t] = 0;
  return pile;
}

export function countTokens(pile) {
  return ALL_TOKENS.reduce((sum, t) => sum + (pile[t] || 0), 0);
}

/** Bonus counts a player has, derived from their purchased cards. */
export function bonusesOf(player) {
  const bonuses = {};
  for (const g of GEMS) bonuses[g] = 0;
  for (const card of player.cards) bonuses[card.bonus]++;
  return bonuses;
}

export function pointsOf(player) {
  const cardPoints = player.cards.reduce((sum, c) => sum + c.points, 0);
  return cardPoints + player.lords.length * LORD_POINTS;
}

/** What a player still owes for a card after their bonus discounts. */
export function netCost(card, player) {
  const bonuses = bonusesOf(player);
  const owed = {};
  for (const [gem, amount] of Object.entries(card.cost)) {
    const remaining = amount - (bonuses[gem] || 0);
    if (remaining > 0) owed[gem] = remaining;
  }
  return owed;
}

/**
 * Cheapest legal payment for a card, spending gold only where the
 * player is short. Returns null if they cannot afford it at all.
 */
export function autoPayment(card, player) {
  const owed = netCost(card, player);
  const payment = emptyPile();
  let goldNeeded = 0;
  for (const [gem, amount] of Object.entries(owed)) {
    const have = player.tokens[gem] || 0;
    const fromGems = Math.min(have, amount);
    payment[gem] = fromGems;
    goldNeeded += amount - fromGems;
  }
  if (goldNeeded > (player.tokens[GOLD] || 0)) return null;
  payment[GOLD] = goldNeeded;
  return payment;
}

export function canAfford(card, player) {
  return autoPayment(card, player) !== null;
}

// ---------- setup ----------

export const DEFAULT_OPTIONS = {
  targetPoints: DEFAULT_TARGET_POINTS,
  turnTimer: 0,           // seconds; 0 = off
  aiSpeed: 'normal',      // slow | normal | fast
  revealReserved: false,  // if true, reserved cards are public
  extraGold: 0,           // house rule: +n gold in the chest
};

/**
 * Build a fresh game. `players` is [{ id, name, isAI, aiLevel, color }].
 */
export function createGame(players, options = {}, seed = Date.now()) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const rand = mulberry32(seed);
  const decks = buildDecks();
  const count = players.length;

  const state = {
    seed,
    version: 0,
    options: opts,
    players: players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isAI: !!p.isAI,
      aiLevel: p.aiLevel || 'sly',
      seat: i,
      tokens: emptyPile(),
      cards: [],
      reserved: [],
      lords: [],
    })),
    decks: {
      1: shuffle(decks[1], rand),
      2: shuffle(decks[2], rand),
      3: shuffle(decks[3], rand),
    },
    board: { 1: [], 2: [], 3: [] },
    lords: shuffle(LORDS, rand).slice(0, count + 1),
    supply: emptyPile(),
    current: 0,
    turnsTaken: 0,
    phase: 'playing',      // playing | discard | chooseLord | finished
    pending: null,
    consecutivePasses: 0,
    idleTurns: 0,
    endTriggered: false,
    winner: null,
    finalStandings: null,
    log: [],
  };

  for (const gem of GEMS) state.supply[gem] = GEM_SUPPLY[count] ?? 7;
  state.supply[GOLD] = GOLD_SUPPLY + (opts.extraGold | 0);

  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < 4; i++) state.board[tier].push(state.decks[tier].pop() || null);
  }

  pushLog(state, { kind: 'start', players: state.players.map((p) => p.name) });
  return state;
}

function pushLog(state, entry) {
  state.log.push({ ...entry, turn: state.turnsTaken, at: state.log.length });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

// ---------- lookups ----------

export function playerById(state, id) {
  return state.players.find((p) => p.id === id) || null;
}

export function currentPlayer(state) {
  return state.players[state.current];
}

export function findBoardCard(state, cardId) {
  for (const tier of [1, 2, 3]) {
    const index = state.board[tier].findIndex((c) => c && c.id === cardId);
    if (index >= 0) return { tier, index, card: state.board[tier][index] };
  }
  return null;
}

/** Replace a taken board slot from its deck (or leave it empty). */
function refillSlot(state, tier, index) {
  state.board[tier][index] = state.decks[tier].pop() || null;
}

// ---------- action validation ----------

/**
 * Returns { ok: true } or { ok: false, reason }. Never mutates.
 */
export function validate(state, playerId, action) {
  if (state.phase === 'finished') return fail('The voyage is already over.');
  const player = playerById(state, playerId);
  if (!player) return fail('Unknown player.');

  if (state.phase === 'discard') {
    if (state.pending?.playerId !== playerId) return fail('Not your discard.');
    if (action.type !== 'discard') return fail('You must return tokens first.');
    return validateDiscard(state, player, action);
  }

  if (state.phase === 'chooseLord') {
    if (state.pending?.playerId !== playerId) return fail('Not your choice.');
    if (action.type !== 'chooseLord') return fail('You must choose a Pirate Lord first.');
    if (!state.pending.options.includes(action.lordId)) return fail('That Lord is not offering.');
    return ok();
  }

  if (currentPlayer(state).id !== playerId) return fail('It is not your turn.');

  switch (action.type) {
    case 'takeThree': return validateTakeThree(state, action);
    case 'takeTwo': return validateTakeTwo(state, action);
    case 'reserve': return validateReserve(state, player, action);
    case 'purchase': return validatePurchase(state, player, action);
    case 'pass': return ok();
    default: return fail('Unknown action.');
  }
}

const ok = () => ({ ok: true });
const fail = (reason) => ({ ok: false, reason });

function validateTakeThree(state, action) {
  const gems = action.gems || [];
  if (gems.length === 0) return fail('Pick at least one gem.');
  if (gems.length > 3) return fail('Three gems at most.');
  if (new Set(gems).size !== gems.length) return fail('Gems must be different colours.');
  for (const gem of gems) {
    if (!GEMS.includes(gem)) return fail('That is not a gem.');
    if (state.supply[gem] < 1) return fail(`No ${gem} left in the chest.`);
  }
  // Taking fewer than three is only allowed when fewer colours are available.
  const available = GEMS.filter((g) => state.supply[g] > 0).length;
  if (gems.length < 3 && gems.length < available) {
    return fail('You must take three different colours when you can.');
  }
  return ok();
}

function validateTakeTwo(state, action) {
  const gem = action.gem;
  if (!GEMS.includes(gem)) return fail('That is not a gem.');
  if (state.supply[gem] < 4) return fail('Need four or more in the chest to take two.');
  return ok();
}

function validateReserve(state, player, action) {
  if (player.reserved.length >= MAX_RESERVED) return fail('You already hold three stowed cards.');
  if (action.fromDeck) {
    const tier = action.tier;
    if (![1, 2, 3].includes(tier)) return fail('No such deck.');
    if (state.decks[tier].length === 0) return fail('That deck is empty.');
    return ok();
  }
  const found = findBoardCard(state, action.cardId);
  if (!found) return fail('That card is not on the table.');
  return ok();
}

function validatePurchase(state, player, action) {
  let card = null;
  if (action.from === 'reserve') {
    card = player.reserved.find((c) => c.id === action.cardId) || null;
    if (!card) return fail('That card is not stowed in your hold.');
  } else {
    const found = findBoardCard(state, action.cardId);
    if (!found) return fail('That card is not on the table.');
    card = found.card;
  }

  const owed = netCost(card, player);
  const payment = action.payment || autoPayment(card, player);
  if (!payment) return fail('You cannot pay for that card.');

  let goldShortfall = 0;
  for (const gem of GEMS) {
    const paid = payment[gem] || 0;
    const need = owed[gem] || 0;
    if (paid < 0) return fail('Bad payment.');
    if (paid > need) return fail('You are overpaying.');
    if (paid > (player.tokens[gem] || 0)) return fail('You do not hold those tokens.');
    goldShortfall += need - paid;
  }
  const gold = payment[GOLD] || 0;
  if (gold !== goldShortfall) return fail('Doubloons do not cover the difference.');
  if (gold > (player.tokens[GOLD] || 0)) return fail('You do not hold that many doubloons.');
  return ok();
}

function validateDiscard(state, player, action) {
  const tokens = action.tokens || {};
  let total = 0;
  for (const [token, amount] of Object.entries(tokens)) {
    if (!ALL_TOKENS.includes(token)) return fail('Unknown token.');
    if (amount < 0) return fail('Bad discard.');
    if (amount > (player.tokens[token] || 0)) return fail('You do not hold those.');
    total += amount;
  }
  const excess = countTokens(player.tokens) - MAX_TOKENS_HELD;
  if (total !== excess) return fail(`Return exactly ${excess} token(s).`);
  return ok();
}

// ---------- action application ----------

/**
 * Apply an action. Assumes `validate` passed. Mutates and returns
 * a list of effect descriptors the presentation layer can animate.
 */
export function apply(state, playerId, action) {
  const player = playerById(state, playerId);
  const effects = [];

  // Progress tracking. A turn only counts as progress if a card moved;
  // shuffling tokens around forever is how the table can lock up.
  if (action.type === 'pass') state.consecutivePasses++;
  else if (action.type !== 'discard' && action.type !== 'chooseLord') state.consecutivePasses = 0;

  if (action.type === 'purchase' || action.type === 'reserve') state.idleTurns = 0;
  else if (action.type !== 'discard' && action.type !== 'chooseLord') state.idleTurns++;

  switch (action.type) {
    case 'takeThree': {
      for (const gem of action.gems) {
        state.supply[gem]--;
        player.tokens[gem]++;
      }
      pushLog(state, { kind: 'take', who: player.name, gems: action.gems });
      effects.push({ type: 'tokens', gems: action.gems, to: player.id });
      break;
    }
    case 'takeTwo': {
      state.supply[action.gem] -= 2;
      player.tokens[action.gem] += 2;
      pushLog(state, { kind: 'take', who: player.name, gems: [action.gem, action.gem] });
      effects.push({ type: 'tokens', gems: [action.gem, action.gem], to: player.id });
      break;
    }
    case 'reserve': {
      let card;
      if (action.fromDeck) {
        card = state.decks[action.tier].pop();
        card = { ...card, hidden: true };
      } else {
        const found = findBoardCard(state, action.cardId);
        card = found.card;
        refillSlot(state, found.tier, found.index);
      }
      player.reserved.push(card);
      let gotGold = false;
      if (state.supply[GOLD] > 0) {
        state.supply[GOLD]--;
        player.tokens[GOLD]++;
        gotGold = true;
      }
      pushLog(state, {
        kind: 'reserve', who: player.name,
        card: action.fromDeck ? `a blind card from ${tierName(action.tier)}` : card.name,
        gold: gotGold,
      });
      effects.push({ type: 'reserve', cardId: card.id, to: player.id, gold: gotGold });
      break;
    }
    case 'purchase': {
      let card;
      if (action.from === 'reserve') {
        const index = player.reserved.findIndex((c) => c.id === action.cardId);
        card = player.reserved.splice(index, 1)[0];
        card = { ...card };
        delete card.hidden;
      } else {
        const found = findBoardCard(state, action.cardId);
        card = found.card;
        refillSlot(state, found.tier, found.index);
      }
      const payment = action.payment || autoPayment(card, player);
      for (const token of ALL_TOKENS) {
        const amount = payment[token] || 0;
        if (amount) {
          player.tokens[token] -= amount;
          state.supply[token] += amount;
        }
      }
      player.cards.push(card);
      pushLog(state, { kind: 'buy', who: player.name, card: card.name, points: card.points });
      effects.push({ type: 'purchase', cardId: card.id, to: player.id, payment });
      break;
    }
    case 'pass': {
      pushLog(state, { kind: 'pass', who: player.name });
      break;
    }
    case 'discard': {
      for (const [token, amount] of Object.entries(action.tokens)) {
        player.tokens[token] -= amount;
        state.supply[token] += amount;
      }
      pushLog(state, { kind: 'discard', who: player.name, tokens: action.tokens });
      effects.push({ type: 'discard', to: player.id, tokens: action.tokens });
      state.phase = 'playing';
      state.pending = null;
      finishTurn(state, player, effects);
      state.version++;
      return effects;
    }
    case 'chooseLord': {
      awardLord(state, player, action.lordId, effects);
      state.phase = 'playing';
      state.pending = null;
      endTurn(state, effects);
      state.version++;
      return effects;
    }
  }

  // Post-action: over-limit tokens must be returned before anything else.
  if (countTokens(player.tokens) > MAX_TOKENS_HELD) {
    state.phase = 'discard';
    state.pending = {
      playerId: player.id,
      excess: countTokens(player.tokens) - MAX_TOKENS_HELD,
    };
    state.version++;
    return effects;
  }

  finishTurn(state, player, effects);
  state.version++;
  return effects;
}

function tierName(tier) {
  return ['', 'Tier I', 'Tier II', 'Tier III'][tier];
}

/** Lord check, then hand the turn on (unless a Lord choice is pending). */
function finishTurn(state, player, effects) {
  const eligible = eligibleLords(state, player);
  if (eligible.length === 1) {
    awardLord(state, player, eligible[0], effects);
  } else if (eligible.length > 1) {
    state.phase = 'chooseLord';
    state.pending = { playerId: player.id, options: eligible };
    return;
  }
  endTurn(state, effects);
}

export function eligibleLords(state, player) {
  const bonuses = bonusesOf(player);
  return state.lords
    .filter((lord) => Object.entries(lord.req).every(([gem, n]) => bonuses[gem] >= n))
    .map((lord) => lord.id);
}

function awardLord(state, player, lordId, effects) {
  const index = state.lords.findIndex((l) => l.id === lordId);
  if (index < 0) return;
  const [lord] = state.lords.splice(index, 1);
  player.lords.push(lord);
  pushLog(state, { kind: 'lord', who: player.name, lord: lord.name });
  effects.push({ type: 'lord', lordId: lord.id, to: player.id });
}

function endTurn(state, effects) {
  const player = currentPlayer(state);
  if (pointsOf(player) >= state.options.targetPoints) state.endTriggered = true;

  state.turnsTaken++;
  state.current = (state.current + 1) % state.players.length;

  // The round completes when play returns to the first seat.
  if (state.endTriggered && state.current === 0) {
    concludeGame(state, effects, 'target');
    return;
  }

  // Deadlock. Two shapes of it: nobody can act at all, or the chest is
  // so empty that players can only pass the last gems back and forth.
  // Either way play would never end, so call it and score as it stands.
  const players = state.players.length;
  if (state.consecutivePasses >= players || state.idleTurns >= players * 6) {
    concludeGame(state, effects, 'stalemate');
  }
}

function concludeGame(state, effects, reason) {
  state.phase = 'finished';
  state.endReason = reason;
  state.finalStandings = standings(state);
  state.winner = state.finalStandings[0].id;
  pushLog(state, { kind: 'end', who: state.finalStandings[0].name, reason });
  effects.push({ type: 'gameOver', winner: state.winner, reason });
}

/** Ranked players: most infamy, then fewest cards bought. */
export function standings(state) {
  return state.players
    .map((p) => ({
      id: p.id,
      name: p.name,
      points: pointsOf(p),
      cards: p.cards.length,
      lords: p.lords.length,
      isAI: p.isAI,
    }))
    .sort((a, b) => (b.points - a.points) || (a.cards - b.cards) || (a.name < b.name ? -1 : 1));
}

// ---------- convenience for UI / AI ----------

/** Every legal action for the player whose turn it is. */
export function legalActions(state, playerId) {
  const player = playerById(state, playerId);
  if (!player) return [];
  const actions = [];

  if (state.phase === 'discard' && state.pending?.playerId === playerId) return [];
  if (state.phase === 'chooseLord' && state.pending?.playerId === playerId) {
    return state.pending.options.map((lordId) => ({ type: 'chooseLord', lordId }));
  }
  if (state.phase !== 'playing' || currentPlayer(state).id !== playerId) return [];

  const availableGems = GEMS.filter((g) => state.supply[g] > 0);
  if (availableGems.length >= 3) {
    for (let a = 0; a < availableGems.length; a++)
      for (let b = a + 1; b < availableGems.length; b++)
        for (let c = b + 1; c < availableGems.length; c++)
          actions.push({ type: 'takeThree', gems: [availableGems[a], availableGems[b], availableGems[c]] });
  } else if (availableGems.length > 0) {
    actions.push({ type: 'takeThree', gems: availableGems.slice() });
  }

  for (const gem of GEMS) {
    if (state.supply[gem] >= 4) actions.push({ type: 'takeTwo', gem });
  }

  if (player.reserved.length < MAX_RESERVED) {
    for (const tier of [1, 2, 3]) {
      for (const card of state.board[tier]) {
        if (card) actions.push({ type: 'reserve', cardId: card.id });
      }
      if (state.decks[tier].length) actions.push({ type: 'reserve', fromDeck: true, tier });
    }
  }

  for (const tier of [1, 2, 3]) {
    for (const card of state.board[tier]) {
      if (card && canAfford(card, player)) {
        actions.push({ type: 'purchase', cardId: card.id, from: 'board', payment: autoPayment(card, player) });
      }
    }
  }
  for (const card of player.reserved) {
    if (canAfford(card, player)) {
      actions.push({ type: 'purchase', cardId: card.id, from: 'reserve', payment: autoPayment(card, player) });
    }
  }

  if (actions.length === 0) actions.push({ type: 'pass' });
  return actions;
}

/**
 * Snapshot for a given viewer: blind-reserved cards held by others are
 * masked unless the lobby enabled open holds.
 */
export function viewFor(state, viewerId) {
  const view = JSON.parse(JSON.stringify(state));
  view.deckCounts = { 1: state.decks[1].length, 2: state.decks[2].length, 3: state.decks[3].length };
  delete view.decks;
  if (!state.options.revealReserved) {
    for (const player of view.players) {
      if (player.id === viewerId) continue;
      player.reserved = player.reserved.map((card) =>
        card.hidden ? { id: card.id, tier: card.tier, hidden: true, masked: true } : card);
    }
  }
  return view;
}
