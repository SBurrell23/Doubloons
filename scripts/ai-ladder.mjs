// Head-to-head AI strength check: each level pair, both seatings.
import { createGame, apply, validate, standings, currentPlayer, mulberry32 } from '../src/game/rules.js';
import { chooseAction } from '../src/game/ai.js';

const perMatch = Number(process.argv[2] || 300);
const LEVELS = ['greenhorn', 'sly', 'dread'];

function playGame(levels, seed) {
  const rand = mulberry32(seed * 7919 + 13);
  const players = levels.map((lvl, i) => ({ id: `p${i}`, name: `P${i}`, isAI: true, aiLevel: lvl }));
  const state = createGame(players, { targetPoints: 15 }, seed);
  let guard = 0;
  while (state.phase !== 'finished' && guard++ < 3000) {
    const actorId = state.pending ? state.pending.playerId : currentPlayer(state).id;
    const action = chooseAction(state, actorId, rand);
    if (!action) return null;
    if (!validate(state, actorId, action).ok) return null;
    apply(state, actorId, action);
  }
  if (state.phase !== 'finished') return null;
  const table = standings(state);
  return { winnerSeat: Number(table[0].id.slice(1)), rounds: Math.ceil(state.turnsTaken / levels.length) };
}

for (let a = 0; a < LEVELS.length; a++) {
  for (let b = a + 1; b < LEVELS.length; b++) {
    let winsA = 0, winsB = 0, rounds = 0, n = 0;
    for (let i = 0; i < perMatch; i++) {
      const swap = i % 2 === 1;
      const levels = swap ? [LEVELS[b], LEVELS[a]] : [LEVELS[a], LEVELS[b]];
      const result = playGame(levels, 900000 + i);
      if (!result) continue;
      n++; rounds += result.rounds;
      const winnerLevel = levels[result.winnerSeat];
      if (winnerLevel === LEVELS[a]) winsA++; else winsB++;
    }
    const rate = ((winsB / n) * 100).toFixed(1);
    console.log(`${LEVELS[a]} ${winsA} - ${winsB} ${LEVELS[b]}   (${LEVELS[b]} wins ${rate}%, avg ${(rounds / n).toFixed(1)} rounds, n=${n})`);
  }
}
