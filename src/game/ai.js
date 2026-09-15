// ============================================================
// Doubloons! — computer captains
//
// A heuristic player. It picks a target card, buys whenever a
// purchase beats waiting, and otherwise draws the gems that
// shorten the road to its target.
// ============================================================

import { GEMS, GOLD, ALL_TOKENS, MAX_TOKENS_HELD, LORD_POINTS } from './data.js';
import {
  legalActions, bonusesOf, pointsOf, netCost, playerById,
  countTokens, mulberry32, apply as applyAction,
} from './rules.js';

export const AI_LEVELS = {
  greenhorn: { label: 'Greenhorn', blurb: 'Grabs whatever glitters. Easy pickings.', noise: 6.0, horizon: 2, search: false },
  sly: { label: 'Sly Dog', blurb: 'Plays a decent game and watches the Lords.', noise: 1.2, horizon: 4, search: false },
  dread: { label: 'Dread Captain', blurb: 'Ruthless. Counts your coins as well as yours.', noise: 0.12, horizon: 8, search: true },
};

export const AI_NAMES = [
  'Barnacle Bess', 'One-Eye Pike', 'Salty Mercer', 'Gunpowder Gale',
  'Hooktooth Harlan', 'Ravenna Blackcask', 'Peg-Leg Prosper', 'Iron Maggie',
  'Cutlass Quinn', 'Squid-Ink Sil', 'Brine Barlow', 'Tempest Tilda',
];

/** Cards this player can see and might buy: board + own hold. */
function visibleCards(state, player) {
  const cards = [];
  for (const tier of [1, 2, 3]) {
    for (const card of state.board[tier]) if (card) cards.push({ card, from: 'board' });
  }
  for (const card of player.reserved) {
    if (!card.masked) cards.push({ card, from: 'reserve' });
  }
  return cards;
}

/** Tokens still to be drawn before this card is affordable. */
function tokensMissing(card, player) {
  const owed = netCost(card, player);
  let short = 0;
  for (const [gem, amount] of Object.entries(owed)) {
    short += Math.max(0, amount - (player.tokens[gem] || 0));
  }
  return Math.max(0, short - (player.tokens[GOLD] || 0));
}

/** Per-gem shortfall for a card, ignoring gold. */
function gemDeficit(card, player) {
  const owed = netCost(card, player);
  const deficit = {};
  for (const gem of GEMS) {
    deficit[gem] = Math.max(0, (owed[gem] || 0) - (player.tokens[gem] || 0));
  }
  return deficit;
}

/**
 * How useful another bonus of this colour is, judged by the Lords
 * still on the table and by the cards on offer.
 */
function bonusUtility(state, player, gem) {
  const bonuses = bonusesOf(player);
  let utility = 1.4;

  for (const lord of state.lords) {
    const need = lord.req[gem];
    if (!need) continue;
    const have = bonuses[gem] || 0;
    if (have >= need) continue;
    // Closer to completing a Lord's demand => this bonus is worth more.
    let otherGap = 0;
    for (const [other, amount] of Object.entries(lord.req)) {
      if (other === gem) continue;
      otherGap += Math.max(0, amount - (bonuses[other] || 0));
    }
    utility += 3.2 / (1 + otherGap + (need - have - 1));
  }

  // Discount value against what is actually on the table.
  let demand = 0;
  for (const tier of [1, 2, 3]) {
    for (const card of state.board[tier]) {
      if (card && card.cost[gem]) demand += card.cost[gem] * (tier === 1 ? 0.12 : 0.25);
    }
  }
  return utility + Math.min(demand, 4);
}

/** Raw desirability of owning a card. */
function cardValue(state, player, card) {
  const pointWeight = 2.6;
  return card.points * pointWeight + bonusUtility(state, player, card.bonus) + (card.tier - 1) * 0.35;
}

/** Danger that an opponent snaps up this card before we can. */
function contention(state, player, card) {
  let worst = 0;
  for (const other of state.players) {
    if (other.id === player.id) continue;
    const missing = tokensMissing(card, other);
    if (missing <= 1) worst = Math.max(worst, 2.5);
    else if (missing <= 3) worst = Math.max(worst, 1.0);
  }
  return worst;
}

function scoreAction(state, player, action, cfg) {
  const target = state.options.targetPoints;
  const myPoints = pointsOf(player);

  switch (action.type) {
    case 'purchase': {
      const entry = visibleCards(state, player).find((e) => e.card.id === action.cardId);
      const card = entry ? entry.card : player.reserved.find((c) => c.id === action.cardId);
      if (!card) return -100;
      let score = 14 + cardValue(state, player, card) * 1.35;
      // Spending gold is mildly wasteful; it is a flexible resource.
      score -= (action.payment?.[GOLD] || 0) * 0.5;
      if (myPoints + card.points >= target) score += 200;
      // Clearing a stowed card frees a hold slot.
      if (action.from === 'reserve') score += 1.2;
      return score;
    }

    case 'reserve': {
      if (action.fromDeck) return 1.0 + (player.tokens[GOLD] ? 0 : 1.2);
      const found = visibleCards(state, player).find((e) => e.card.id === action.cardId);
      const card = found?.card;
      if (!card) return -100;
      let score = cardValue(state, player, card) * 0.45 + contention(state, player, card) * 1.6;
      if (state.supply[GOLD] > 0) score += 1.4;
      // Do not clog the hold early.
      score -= player.reserved.length * 2.4;
      if (card.tier === 1) score -= 2.5;
      return score;
    }

    case 'takeTwo':
    case 'takeThree': {
      const gems = action.type === 'takeTwo' ? [action.gem, action.gem] : action.gems;
      const held = countTokens(player.tokens);
      if (held + gems.length > MAX_TOKENS_HELD) {
        // Legal, but we would have to throw tokens back.
        return gemScore(state, player, gems, cfg) - (held + gems.length - MAX_TOKENS_HELD) * 2.2;
      }
      return gemScore(state, player, gems, cfg);
    }

    case 'chooseLord':
      return 1;
    case 'pass':
      return -10;
    default:
      return 0;
  }
}

/** Value of adding these gems, judged against our best target cards. */
function gemScore(state, player, gems, cfg) {
  const candidates = visibleCards(state, player)
    .map(({ card }) => ({
      card,
      value: cardValue(state, player, card),
      missing: tokensMissing(card, player),
    }))
    .filter((c) => c.missing > 0 && c.missing <= cfg.horizon)
    .sort((a, b) => b.value / (1 + b.missing) - a.value / (1 + a.missing))
    .slice(0, 5);

  if (candidates.length === 0) {
    // Nothing in reach — just favour scarce colours.
    return gems.reduce((sum, gem) => sum + 0.6 + (4 - Math.min(4, state.supply[gem])) * 0.1, 1);
  }

  const wanted = {};
  for (const gem of GEMS) wanted[gem] = 0;
  candidates.forEach((entry, rank) => {
    const weight = (entry.value / (1 + entry.missing)) * (1 - rank * 0.13);
    const deficit = gemDeficit(entry.card, player);
    for (const gem of GEMS) if (deficit[gem] > 0) wanted[gem] += weight;
  });

  const take = {};
  let score = 0.8;
  for (const gem of gems) {
    take[gem] = (take[gem] || 0) + 1;
    // Second copy of a colour is worth less than the first.
    const useful = Math.min(take[gem], maxNeeded(candidates, player, gem));
    score += (useful >= take[gem] ? wanted[gem] : wanted[gem] * 0.25) * 0.55;
  }
  return score;
}

function maxNeeded(candidates, player, gem) {
  let most = 0;
  for (const entry of candidates) {
    most = Math.max(most, gemDeficit(entry.card, player)[gem]);
  }
  return most;
}

// ------------------------------------------------------------
// Positional evaluation — used by the searching level.
// ------------------------------------------------------------

/** Cheap structural clone. Card objects are immutable, so they are shared. */
function cloneState(state) {
  return {
    ...state,
    players: state.players.map((p) => ({
      ...p,
      tokens: { ...p.tokens },
      cards: p.cards.slice(),
      reserved: p.reserved.slice(),
      lords: p.lords.slice(),
    })),
    decks: { 1: state.decks[1].slice(), 2: state.decks[2].slice(), 3: state.decks[3].slice() },
    board: { 1: state.board[1].slice(), 2: state.board[2].slice(), 3: state.board[3].slice() },
    lords: state.lords.slice(),
    supply: { ...state.supply },
    pending: state.pending ? { ...state.pending } : null,
    log: [],
  };
}

/** How near a player is to claiming each remaining Lord. */
function lordProximity(state, player) {
  const bonuses = bonusesOf(player);
  let best = 0;
  for (const lord of state.lords) {
    let gap = 0;
    for (const [gem, need] of Object.entries(lord.req)) {
      gap += Math.max(0, need - (bonuses[gem] || 0));
    }
    best = Math.max(best, LORD_POINTS * 2.0 / (1 + gap * 0.9));
  }
  return best;
}

/** Standing of one player: points banked plus the engine behind them. */
function positionScore(state, player, cfg) {
  let score = pointsOf(player) * 10;

  const bonuses = bonusesOf(player);
  // A broad spread of bonuses buys more than a tall stack of one colour.
  let engine = 0;
  for (const gem of GEMS) engine += Math.sqrt(bonuses[gem]) * 2.1;
  score += engine;

  score += lordProximity(state, player);
  score += countTokens(player.tokens) * 0.22 + (player.tokens[GOLD] || 0) * 0.35;

  // Cards we could realistically take soon.
  const reach = visibleCards(state, player)
    .map(({ card }) => ({ value: cardValue(state, player, card), missing: tokensMissing(card, player) }))
    .filter((c) => c.missing <= cfg.horizon)
    .sort((a, b) => b.value / (1 + b.missing) - a.value / (1 + a.missing))
    .slice(0, 3);
  for (const entry of reach) score += entry.value / (1 + entry.missing) * 1.1;

  return score;
}

/** Evaluate a position from one player's seat, net of the best rival. */
function relativeScore(state, playerId, cfg) {
  const me = playerById(state, playerId);
  let mine = positionScore(state, me, cfg);
  let best = -Infinity;
  for (const other of state.players) {
    if (other.id === playerId) continue;
    best = Math.max(best, positionScore(state, other, cfg));
  }
  if (best === -Infinity) return mine;

  // Race pressure: once a rival is within a card or two of the target,
  // banked points matter far more than a prettier engine.
  const target = state.options.targetPoints;
  const rivalPoints = Math.max(...state.players.filter((p) => p.id !== playerId).map(pointsOf));
  const urgency = rivalPoints >= target - 4 ? 1.9 : 1.0;
  mine += pointsOf(me) * 10 * (urgency - 1);

  return mine - best * 0.55;
}

/**
 * Pick an action for an AI player. Returns null when it is not
 * this player's move.
 */
export function chooseAction(state, playerId, rand = Math.random) {
  const player = playerById(state, playerId);
  if (!player) return null;

  if (state.phase === 'discard' && state.pending?.playerId === playerId) {
    return chooseDiscard(state, player);
  }

  const actions = legalActions(state, playerId);
  if (actions.length === 0) return null;

  const cfg = AI_LEVELS[player.aiLevel] || AI_LEVELS.sly;
  let best = null;
  let bestScore = -Infinity;

  // The searching level reads every action as "what position does this
  // leave me in", except a blind deck reserve — searching that would
  // let it peek at the top card.
  const baseline = cfg.search ? relativeScore(state, playerId, cfg) : 0;

  for (const action of actions) {
    let score;
    const blindReserve = action.type === 'reserve' && action.fromDeck;
    if (cfg.search && !blindReserve) {
      const next = cloneState(state);
      applyAction(next, playerId, action);
      score = relativeScore(next, playerId, cfg) + scoreAction(state, player, action, cfg) * 0.25;
    } else if (cfg.search) {
      score = baseline + scoreAction(state, player, action, cfg) * 0.25;
    } else {
      score = scoreAction(state, player, action, cfg);
    }
    score += (rand() - 0.5) * cfg.noise;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }
  return best;
}

/** Throw back the tokens that help our targets least. */
function chooseDiscard(state, player) {
  const excess = countTokens(player.tokens) - MAX_TOKENS_HELD;
  const cfg = AI_LEVELS[player.aiLevel] || AI_LEVELS.sly;

  const candidates = visibleCards(state, player)
    .map(({ card }) => ({ card, value: cardValue(state, player, card), missing: tokensMissing(card, player) }))
    .sort((a, b) => b.value / (1 + b.missing) - a.value / (1 + a.missing))
    .slice(0, cfg.horizon);

  const need = {};
  for (const token of ALL_TOKENS) need[token] = 0;
  need[GOLD] = 99; // never throw away doubloons if anything else will do
  for (const entry of candidates) {
    const deficit = gemDeficit(entry.card, player);
    for (const gem of GEMS) need[gem] += deficit[gem];
  }

  const pool = [];
  for (const token of ALL_TOKENS) {
    for (let i = 0; i < (player.tokens[token] || 0); i++) pool.push(token);
  }
  pool.sort((a, b) => need[a] - need[b]);

  const tokens = {};
  for (let i = 0; i < excess; i++) {
    const token = pool[i];
    tokens[token] = (tokens[token] || 0) + 1;
  }
  return { type: 'discard', tokens };
}

/** Thinking time in ms, so AI turns feel like a person moving pieces. */
export function aiDelay(speed) {
  const base = { slow: [1400, 2600], normal: [700, 1500], fast: [180, 420] }[speed] || [700, 1500];
  return base[0] + Math.random() * (base[1] - base[0]);
}

export function makeAiRng(seed) {
  return mulberry32(seed);
}
