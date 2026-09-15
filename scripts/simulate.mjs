// Headless playtest: runs many AI-vs-AI games and checks invariants.
// Usage: node scripts/simulate.mjs [games] [playersPerGame]

import { createGame, apply, validate, standings, countTokens, pointsOf, currentPlayer } from '../src/game/rules.js';
import { chooseAction } from '../src/game/ai.js';
import { GEMS, GOLD, GEM_SUPPLY, GOLD_SUPPLY, MAX_TOKENS_HELD, MAX_RESERVED } from '../src/game/data.js';
import { mulberry32 } from '../src/game/rules.js';

const games = Number(process.argv[2] || 200);
const seats = Number(process.argv[3] || 0);
const LEVELS = ['greenhorn', 'sly', 'dread'];

function checkInvariants(state, tag) {
  const count = state.players.length;
  const problems = [];

  for (const gem of GEMS) {
    let total = state.supply[gem];
    for (const p of state.players) total += p.tokens[gem];
    const expected = GEM_SUPPLY[count];
    if (total !== expected) problems.push(`${tag}: ${gem} tokens ${total} != ${expected}`);
    if (state.supply[gem] < 0) problems.push(`${tag}: negative ${gem} supply`);
  }
  let gold = state.supply[GOLD];
  for (const p of state.players) gold += p.tokens[GOLD];
  if (gold !== GOLD_SUPPLY) problems.push(`${tag}: gold ${gold} != ${GOLD_SUPPLY}`);

  for (const p of state.players) {
    if (state.phase === 'playing' && countTokens(p.tokens) > MAX_TOKENS_HELD) {
      problems.push(`${tag}: ${p.name} holds ${countTokens(p.tokens)} tokens`);
    }
    if (p.reserved.length > MAX_RESERVED) problems.push(`${tag}: ${p.name} reserved ${p.reserved.length}`);
    for (const t of Object.values(p.tokens)) if (t < 0) problems.push(`${tag}: negative tokens`);
  }

  // Every card exists exactly once across decks, board and hands.
  const seen = new Map();
  const note = (id, where) => {
    if (seen.has(id)) problems.push(`${tag}: duplicate card ${id} (${seen.get(id)} + ${where})`);
    seen.set(id, where);
  };
  for (const tier of [1, 2, 3]) {
    for (const c of state.decks[tier]) note(c.id, 'deck');
    for (const c of state.board[tier]) if (c) note(c.id, 'board');
  }
  for (const p of state.players) {
    for (const c of p.cards) note(c.id, 'owned');
    for (const c of p.reserved) note(c.id, 'reserved');
  }
  if (seen.size !== 90) problems.push(`${tag}: ${seen.size} cards accounted for, expected 90`);

  // Board slots stay filled while the deck has cards.
  for (const tier of [1, 2, 3]) {
    const empty = state.board[tier].filter((c) => !c).length;
    if (empty > 0 && state.decks[tier].length > 0) problems.push(`${tag}: tier ${tier} has a hole but deck is not empty`);
  }
  return problems;
}

let totalTurns = 0;
let allProblems = [];
const winsByLevel = {};
const turnHistogram = [];
let stalls = 0;
let stalemates = 0;

for (let g = 0; g < games; g++) {
  const count = seats || (2 + (g % 3));
  const rand = mulberry32(1000 + g);
  const players = Array.from({ length: count }, (_, i) => ({
    id: `ai${i}`,
    name: `AI${i}`,
    isAI: true,
    aiLevel: LEVELS[(g + i) % LEVELS.length],
  }));
  const state = createGame(players, { targetPoints: 15 }, 5000 + g);

  let guard = 0;
  while (state.phase !== 'finished' && guard < 3000) {
    guard++;
    const actorId = state.pending ? state.pending.playerId : currentPlayer(state).id;
    const action = chooseAction(state, actorId, rand);
    if (!action) { stalls++; break; }
    const result = validate(state, actorId, action);
    if (!result.ok) {
      allProblems.push(`game ${g}: AI produced illegal ${action.type}: ${result.reason}`);
      break;
    }
    apply(state, actorId, action);
    const problems = checkInvariants(state, `game ${g} turn ${state.turnsTaken}`);
    if (problems.length) { allProblems.push(...problems.slice(0, 3)); break; }
  }

  if (state.phase !== 'finished') {
    allProblems.push(`game ${g}: did not finish in ${guard} steps (phase ${state.phase})`);
    continue;
  }

  const rounds = Math.ceil(state.turnsTaken / count);
  totalTurns += rounds;
  turnHistogram.push(rounds);
  const table = standings(state);
  const winner = state.players.find((p) => p.id === table[0].id);
  winsByLevel[winner.aiLevel] = (winsByLevel[winner.aiLevel] || 0) + 1;

  // Winner should actually have hit the target.
  if (state.endReason === "target" && table[0].points < 15) allProblems.push(`game ${g}: winner only has ${table[0].points}`);
  if (state.endReason === "stalemate") stalemates++;
}

turnHistogram.sort((a, b) => a - b);
const pct = (p) => turnHistogram[Math.floor(turnHistogram.length * p)] ?? 0;

console.log(`games: ${games}`);
console.log(`rounds per game  avg ${(totalTurns / turnHistogram.length).toFixed(1)}  min ${turnHistogram[0]}  p50 ${pct(0.5)}  p95 ${pct(0.95)}  max ${turnHistogram.at(-1)}`);
console.log('wins by level:', winsByLevel);
if (stalls) console.log('stalls:', stalls);
console.log('stalemate endings:', stalemates, `(${(stalemates / games * 100).toFixed(1)}%)`);
if (allProblems.length) {
  console.log(`\nPROBLEMS (${allProblems.length}):`);
  for (const p of allProblems.slice(0, 20)) console.log(' -', p);
  process.exit(1);
} else {
  console.log('\nAll invariants held.');
}
