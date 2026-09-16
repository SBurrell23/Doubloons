// ============================================================
// The in-game HUD. Everything that is not on the table.
// ============================================================

import {
  el, button, clear, gemChip, costRow, bonusDisc, infamySeal, announce, trapFocus,
} from './dom.js';
import { play } from '../audio/sfx.js';
import {
  GEMS, GOLD, ALL_TOKENS, GEM_INFO, TIER_INFO, MAX_TOKENS_HELD, MAX_RESERVED, LORD_POINTS,
} from '../game/data.js';
import { seatDecor } from '../game/session.js';
import { GLOSSARY, pinTip, unpinTip } from './tooltip.js';
import { icon, seatEmblem } from './icons.js';
import { cardFaceImageUrl } from '../three/textures.js';

// ------------------------------------------------------------
// Derived helpers that work off a client view (no engine access)
// ------------------------------------------------------------

function bonusesOfView(player) {
  const out = {};
  for (const gem of GEMS) out[gem] = 0;
  for (const card of player.cards) out[card.bonus]++;
  return out;
}

function pointsOfView(player) {
  return player.cards.reduce((sum, c) => sum + c.points, 0) + player.lords.length * 3;
}

function tokenTotal(tokens) {
  return ALL_TOKENS.reduce((sum, t) => sum + (tokens[t] || 0), 0);
}

function netCostView(card, player) {
  const bonuses = bonusesOfView(player);
  const owed = {};
  for (const [gem, amount] of Object.entries(card.cost || {})) {
    const left = amount - (bonuses[gem] || 0);
    if (left > 0) owed[gem] = left;
  }
  return owed;
}

function paymentFor(card, player) {
  const owed = netCostView(card, player);
  const payment = {};
  let gold = 0;
  for (const [gem, amount] of Object.entries(owed)) {
    const have = player.tokens[gem] || 0;
    payment[gem] = Math.min(have, amount);
    gold += amount - payment[gem];
  }
  if (gold > (player.tokens[GOLD] || 0)) return null;
  payment[GOLD] = gold;
  return payment;
}

const affordable = (card, player) => paymentFor(card, player) !== null;

// ------------------------------------------------------------
// HUD
// ------------------------------------------------------------

export function createHud(mount, {
  session, world, board, settings, onLeave, onSettings, onHowTo, onRematch,
}) {
  clear(mount);

  let view = null;
  let deadline = 0;
  let pending = [];          // gem keys picked but not confirmed
  let inspector = null;
  let promptOverlay = null;
  let logVisible = true;

  // ---- structure ----
  const turnBanner = el('div.turn-banner');
  const timerNode = el('div.timer', { hidden: true });
  const playersNode = el('div.players.scroll');
  const logList = el('div.log__list');
  const logNode = el('aside.log', {},
    el('div.log__head', {}, el('span', {}, 'Ship’s Log')),
    logList,
  );
  const actionBar = el('div.action-bar', { hidden: true });
  const holdNode = el('div.hold', { hidden: true });
  const toasts = el('div.toasts');

  const topRight = el('div.row', {},
    button(icon('book', { size: '1.05rem' }), { class: 'btn-icon', tip: 'How to play (H)', 'aria-label': 'How to play', onClick: onHowTo }),
    button(icon('gear', { size: '1.05rem' }), { class: 'btn-icon', tip: 'Settings (S)', 'aria-label': 'Settings', onClick: onSettings }),
    button(icon('leave', { size: '1.05rem' }), { class: 'btn-icon btn--danger', tip: 'Leave the table', 'aria-label': 'Leave the table', onClick: onLeave }),
  );

  const root = el('div.hud', {},
    el('div.hud__top', {},
      el('div.row', {}, turnBanner, timerNode),
      el('span.grow.pass-through'),
      topRight,
    ),
    el('div.hud__middle', {},
      playersNode,
      el('span.grow.pass-through'),
      logNode,
    ),
    el('div.hud__bottom', {},
      holdNode,
      el('span.grow.pass-through'),
      actionBar,
      el('span.grow.pass-through'),
    ),
  );

  mount.append(root);
  document.body.append(toasts);

  // ------------------------------------------------------------
  // Toasts
  // ------------------------------------------------------------

  function toast(text, kind = '', ms = 2800) {
    const node = el(`div.toast${kind ? `.toast--${kind}` : ''}`, {}, text);
    toasts.append(node);
    announce(text);
    setTimeout(() => {
      node.classList.add('is-leaving');
      setTimeout(() => node.remove(), 240);
    }, ms);
  }

  // ------------------------------------------------------------
  // The player whose seat is mine
  // ------------------------------------------------------------

  const me = () => view?.players.find((p) => p.id === session.myId) || null;
  const isMyTurn = () => {
    if (!view || view.phase === 'finished') return false;
    if (view.pending) return view.pending.playerId === session.myId;
    return view.players[view.current]?.id === session.myId;
  };

  // ------------------------------------------------------------
  // Gem picking
  // ------------------------------------------------------------

  function pendingCounts() {
    const counts = {};
    for (const gem of pending) counts[gem] = (counts[gem] || 0) + 1;
    return counts;
  }

  /** Whether another stone of this colour can go onto the pick. */
  function canAddGem(gem) {
    if (!view || !isMyTurn() || view.phase !== 'playing') return { ok: false, why: 'Not your turn.' };
    if (gem === GOLD) return { ok: false, why: 'Doubloons only come from stowing a card.' };
    const supply = view.supply[gem] || 0;
    if (supply < 1) return { ok: false, why: 'That pile is empty.' };

    const counts = pendingCounts();
    const distinct = Object.keys(counts).length;
    const total = pending.length;

    if (counts[gem] === 1 && distinct === 1) {
      // Second of the same colour — the "take two" move.
      if (supply < 4) return { ok: false, why: 'Need four or more in the chest to take two.' };
      return { ok: true };
    }
    if (counts[gem] >= 1) return { ok: false, why: 'You already have that colour.' };
    if (total >= 3) return { ok: false, why: 'Three gems at most.' };
    if (total === 2 && distinct === 1) return { ok: false, why: 'You are taking two of a kind.' };
    return { ok: true };
  }

  /**
   * Clicking a pile you have already picked puts the stone back — the
   * one exception being a lone colour that could still become a pair,
   * where the second click takes the pair instead.
   */
  function toggleGem(gem) {
    if (!view || !isMyTurn() || view.phase !== 'playing') {
      play('deny');
      toast('Wait for your turn.', 'bad', 1500);
      return;
    }

    const counts = pendingCounts();
    const held = counts[gem] || 0;
    const distinct = Object.keys(counts).length;
    const supply = view.supply[gem] || 0;

    if (held > 0) {
      const couldPair = held === 1 && distinct === 1 && supply >= 4;
      if (couldPair) {
        pending.push(gem);
        play('token');
      } else {
        // Drop the colour entirely. Removing one at a time would just
        // bounce between one and two on a lone colour.
        pending = pending.filter((g) => g !== gem);
        play('cardSlide');
      }
      refreshActionBar();
      refreshBoardHighlights();
      return;
    }

    addGem(gem);
  }

  function addGem(gem) {
    const check = canAddGem(gem);
    if (!check.ok) { play('deny'); toast(check.why, 'bad', 1800); return; }
    pending.push(gem);
    play('token');
    refreshActionBar();
    refreshBoardHighlights();
  }

  function clearPending() {
    if (pending.length === 0) return;
    pending = [];
    refreshActionBar();
    refreshBoardHighlights();
  }

  function confirmGems() {
    if (pending.length === 0) return;
    const counts = pendingCounts();
    const distinct = Object.keys(counts).length;
    const action = (distinct === 1 && pending.length === 2)
      ? { type: 'takeTwo', gem: pending[0] }
      : { type: 'takeThree', gems: [...new Set(pending)] };
    pending = [];
    // Empty the tray now rather than when the new state lands: the gems
    // are already on their way, and over a connection that gap is time
    // spent looking at a choice you have finished making.
    refreshActionBar();
    refreshBoardHighlights();
    session.submit(action);
  }

  // ------------------------------------------------------------
  // Board interaction
  // ------------------------------------------------------------

  function onBoardPick(pick, anchor) {
    closeInspector();
    if (!pick) return;

    if (pick.kind === 'token') {
      if (!isMyTurn()) { play('deny'); toast('Wait for your turn.', 'bad', 1500); return; }
      toggleGem(pick.token);
      return;
    }

    if (pick.kind === 'lord') {
      const lord = view?.lords.find((l) => l.id === pick.lordId);
      if (lord) showLordInspector(lord, anchor);
      return;
    }

    if (pick.kind === 'card') {
      const card = findBoardCard(pick.cardId);
      if (card) showCardInspector(card, 'board', anchor);
      return;
    }

    if (pick.kind === 'deck') {
      showDeckInspector(pick.tier, anchor);
    }
  }

  function onBoardHover(pick, anchor) {
    if (!pick || !settings.gameplay.tooltips) { unpinTip(); return; }
    if (inspector) return;

    const screen = anchor ? world.projectToScreen(anchor) : null;
    if (!screen || screen.behind) { unpinTip(); return; }

    let content = null;
    if (pick.kind === 'token') {
      const token = pick.token;
      const count = view?.supply[token] ?? 0;
      content = {
        title: GEM_INFO[token].label,
        body: token === GOLD
          ? `${count} left. Doubloons are wild — take one by stowing a card.`
          : `${count} left in the chest.`,
        note: token === GOLD ? null : (count >= 4 ? 'Click twice to take two of this colour.' : 'Too few left to take two.'),
      };
    } else if (pick.kind === 'card') {
      const card = findBoardCard(pick.cardId);
      const player = me();
      if (card && player) {
        const owed = netCostView(card, player);
        content = {
          title: card.name,
          body: `${TIER_INFO[card.tier].sub} · ${card.points} infamy · ${GEM_INFO[card.bonus].label} bonus`,
          note: Object.keys(owed).length === 0
            ? 'Your bonuses cover this entirely — it is free.'
            : (affordable(card, player) ? 'You can afford this.' : 'Not yet within reach.'),
          gems: owed,
        };
      }
    } else if (pick.kind === 'deck') {
      content = {
        title: TIER_INFO[pick.tier].name,
        body: `${view?.deckCounts?.[pick.tier] ?? 0} cards left in this deck.`,
        note: 'Stow the top card blind, and take a doubloon.',
      };
    } else if (pick.kind === 'lord') {
      const lord = view?.lords.find((l) => l.id === pick.lordId);
      if (lord) {
        content = {
          title: lord.name,
          body: `${lord.title} — worth ${LORD_POINTS} infamy. Needs these bonuses:`,
          gems: lord.req,
        };
      }
    }

    if (content) pinTip(content, screen.x, screen.y - 26, { above: true });
    else unpinTip();
  }

  function findBoardCard(cardId) {
    if (!view) return null;
    for (const tier of [1, 2, 3]) {
      const found = view.board[tier].find((c) => c && c.id === cardId);
      if (found) return found;
    }
    const player = me();
    return player?.reserved.find((c) => c.id === cardId) || null;
  }

  // ------------------------------------------------------------
  // Inspector popover
  // ------------------------------------------------------------

  function closeInspector() {
    inspector?.remove();
    inspector = null;
    unpinTip();
    refreshBoardHighlights();
  }

  function placeInspector(node, anchor) {
    const screen = anchor ? world.projectToScreen(anchor) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    document.body.append(node);
    const rect = node.getBoundingClientRect();
    const margin = 12;
    let left = screen.x - rect.width / 2;
    let top = screen.y - rect.height - 40;
    if (top < margin) top = screen.y + 40;
    left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
    top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function showCardInspector(card, from, anchor) {
    const player = me();
    if (!player) return;
    unpinTip();

    const owed = netCostView(card, player);
    const payment = paymentFor(card, player);
    const canBuy = isMyTurn() && view.phase === 'playing' && payment !== null;
    const canStow = isMyTurn() && view.phase === 'playing'
      && from === 'board' && player.reserved.length < MAX_RESERVED;

    const reasons = [];
    if (!isMyTurn()) reasons.push('It is not your turn.');
    else if (view.phase !== 'playing') reasons.push('Finish the current prompt first.');
    else if (!payment) reasons.push('You cannot cover that cost yet.');

    const node = el('div.inspector', {},
      el('div.inspector__head', {},
        el('div.inspector__name', {}, card.name),
        card.points > 0 ? el('div.inspector__points', { tip: '#infamy' }, String(card.points)) : null,
      ),
      el('div.inspector__meta', {},
        `${TIER_INFO[card.tier].sub} · gives a `,
        el('b', {}, `${GEM_INFO[card.bonus].label} bonus`),
      ),
      el('div.inspector__cost', {},
        el('div.inspector__cost-line', {},
          el('span.inspector__cost-label', {}, 'Printed'),
          costRow(card.cost, { size: 'sm' }),
        ),
        el('div.inspector__cost-line', {},
          el('span.inspector__cost-label', { tip: '#bonus' }, 'You pay'),
          Object.keys(owed).length
            ? costRow(owed, { size: 'sm' })
            : el('span.muted', {}, 'Nothing — your bonuses cover it.'),
        ),
        payment && payment[GOLD] > 0
          ? el('div.inspector__cost-line', {},
            el('span.inspector__cost-label', { tip: '#doubloon' }, 'Using'),
            costRow({ [GOLD]: payment[GOLD] }, { size: 'sm' }),
          )
          : null,
      ),
      el('div.inspector__actions', {},
        button('Buy it', {
          class: 'btn--go',
          disabled: !canBuy || null,
          onClick: () => {
            closeInspector();
            session.submit({ type: 'purchase', cardId: card.id, from, payment });
          },
        }),
        canStow || from === 'board'
          ? button('Stow it', {
            class: 'btn--gold',
            disabled: !canStow || null,
            onClick: () => {
              closeInspector();
              session.submit({ type: 'reserve', cardId: card.id });
            },
          })
          : null,
        button('Close', { class: 'btn--ghost', onClick: () => closeInspector() }),
      ),
      canStow
        ? el('div.inspector__hint', {}, 'Stowing keeps it from everyone else and pays you a doubloon.')
        : null,
      !canBuy && reasons.length ? el('div.inspector__why', {}, reasons[0]) : null,
      !canStow && canBuy === false && from === 'board' && player.reserved.length >= MAX_RESERVED
        ? el('div.inspector__why', {}, 'Your hold is full — three cards at most.')
        : null,
    );

    inspector = node;
    placeInspector(node, anchor);
    board.setSelected([`card:${card.id}`]);
  }

  function showDeckInspector(tier, anchor) {
    const player = me();
    if (!player) return;
    unpinTip();
    const canStow = isMyTurn() && view.phase === 'playing'
      && player.reserved.length < MAX_RESERVED && (view.deckCounts?.[tier] || 0) > 0;

    const node = el('div.inspector', {},
      el('div.inspector__head', {},
        el('div.inspector__name', {}, TIER_INFO[tier].name),
      ),
      el('div.inspector__meta', {}, `${view.deckCounts?.[tier] ?? 0} cards left`),
      el('p.muted', { style: { margin: '0 0 0.6rem', fontSize: '0.88rem' } },
        'Take the top card blind. Only you will see what it is, and you take a doubloon with it.'),
      el('div.inspector__actions', {},
        button('Stow blind', {
          class: 'btn--gold',
          disabled: !canStow || null,
          onClick: () => {
            closeInspector();
            session.submit({ type: 'reserve', fromDeck: true, tier });
          },
        }),
        button('Close', { class: 'btn--ghost', onClick: () => closeInspector() }),
      ),
      !canStow ? el('div.inspector__why', {},
        player.reserved.length >= MAX_RESERVED ? 'Your hold is full.' : 'Not your turn.') : null,
    );

    inspector = node;
    placeInspector(node, anchor);
    board.setSelected([`deck:${tier}`]);
  }

  function showLordInspector(lord, anchor) {
    unpinTip();
    const player = me();
    const bonuses = player ? bonusesOfView(player) : {};
    const lines = Object.entries(lord.req).map(([gem, need]) => {
      const have = bonuses[gem] || 0;
      const met = have >= need;
      return el('div.inspector__cost-line', {},
        gemChip(gem, need, { size: 'sm' }),
        el('span', { class: met ? 'muted' : '' }, `you have ${have}`),
        met ? icon('check', { size: '0.8rem' }) : null,
      );
    });

    const node = el('div.inspector', {},
      el('div.inspector__head', {},
        el('div.inspector__name', {}, lord.name),
        el('div.inspector__points', {}, '3'),
      ),
      el('div.inspector__meta', {}, lord.title),
      el('div.inspector__cost', {}, ...lines),
      el('p.muted', { style: { margin: '0 0 0.6rem', fontSize: '0.86rem' } },
        'Bonuses only — gems in your hand do not count.'),
      el('div.inspector__actions', {},
        button('Close', { class: 'btn--ghost', onClick: () => closeInspector() }),
      ),
    );

    inspector = node;
    placeInspector(node, anchor);
    board.setSelected([`lord:${lord.id}`]);
  }

  // ------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------

  function refreshBanner() {
    clear(turnBanner);
    if (!view) return;

    if (view.phase === 'finished') {
      turnBanner.className = 'turn-banner';
      turnBanner.append(
        el('span.turn-banner__emblem', { style: { background: 'var(--brass-dark)' } }, icon('crown', { size: '1.05rem' })),
        el('div', {},
          el('div.turn-banner__who', {}, 'Voyage over'),
          el('div.turn-banner__phase', {}, view.endReason === 'stalemate' ? 'The chest ran dry' : 'Final scores'),
        ),
      );
      return;
    }

    const actorId = view.pending ? view.pending.playerId : view.players[view.current].id;
    const actor = view.players.find((p) => p.id === actorId);
    const mine = actorId === session.myId;
    turnBanner.className = `turn-banner${mine ? ' turn-banner--mine' : ''}`;

    let phase = 'Take gems, stow a card, or buy one';
    if (view.phase === 'discard') {
      phase = mine ? 'Return your excess tokens' : 'Returning tokens';
    } else if (view.phase === 'chooseLord') {
      phase = mine ? 'Choose a Pirate Lord' : 'Choosing a Pirate Lord';
    } else if (view.endTriggered) {
      phase = 'Final round!';
    }

    const decor = seatDecor(actor?.seat ?? 0);
    turnBanner.append(
      el('span.turn-banner__emblem', { style: { background: decor.color } }, seatEmblem(actor?.seat ?? 0, { size: '1.05rem' })),
      el('div', {},
        el('div.turn-banner__who', {}, mine ? 'Your move, Captain' : `${actor?.name || '—'}’s move`),
        el('div.turn-banner__phase', { tip: view.endTriggered ? '#lastRound' : null }, phase),
      ),
    );
  }

  function refreshPlayers() {
    clear(playersNode);
    if (!view) return;
    const target = view.options.targetPoints;

    for (const player of view.players) {
      const decor = seatDecor(player.seat);
      const bonuses = bonusesOfView(player);
      const points = pointsOfView(player);
      const isActive = !view.pending
        ? view.players[view.current].id === player.id
        : view.pending.playerId === player.id;
      const isMe = player.id === session.myId;

      const classes = ['player-card'];
      if (isActive && view.phase !== 'finished') classes.push('player-card--active');
      if (isMe) classes.push('player-card--you');
      if (view.phase === 'finished' && view.winner === player.id) classes.push('player-card--winner');

      const gemRow = el('div.player-card__gems');
      for (const token of ALL_TOKENS) {
        const count = player.tokens[token] || 0;
        gemRow.append(gemChip(token, count, { dim: count === 0 }));
      }

      // Bonuses are the thing you actually plan around, so they get the
      // most room on the card -- and they wear the same seal the cards
      // on the table do, so there is only one of them to learn.
      const tally = el('div.bonus-tally', { tip: '#bonus' });
      tally.append(el('span.bonus-tally__label', {}, 'Bonuses'));
      const tallyRow = el('div.bonus-tally__row');
      for (const gem of GEMS) {
        const n = bonuses[gem];
        tallyRow.append(bonusDisc(gem, n, {
          empty: !n,
          tip: `${n} ${GEM_INFO[gem].label} bonus${n === 1 ? '' : 'es'}`,
        }));
      }
      tally.append(tallyRow);

      const held = tokenTotal(player.tokens);

      playersNode.append(el(`div.${classes.join('.')}`, { style: { '--seat-color': decor.color } },
        el('div.player-card__head', {},
          el('span.player-card__emblem', { style: { background: decor.color } }, seatEmblem(player.seat, { size: '0.9rem' })),
          el('span.player-card__name', {}, player.name),
          isMe ? el('span.player-card__you', {}, 'YOU') : null,
          player.isAI ? el('span.player-card__ai', {}, 'CPU') : null,
          infamySeal(points, { tip: `${points} of ${target} infamy` }),
        ),
        gemRow,
        tally,
        el('div.player-card__stat', {},
          el('span', { tip: '#handLimit' }, `${held}/${MAX_TOKENS_HELD} tokens`),
          el('span', {}, '·'),
          el('span', { tip: '#holdLimit' }, `${player.reserved.length}/${MAX_RESERVED} stowed`),
          player.lords.length
            ? el('span', { tip: '#lord' }, '· ', icon('skull', { size: '0.72rem' }), ` ${player.lords.length}`)
            : null,
        ),
      ));
    }
  }

  function refreshHold() {
    const player = me();
    if (!player) { holdNode.hidden = true; return; }
    holdNode.hidden = false;
    clear(holdNode);

    const cards = el('div.hold__cards');
    for (const card of player.reserved) {
      const blind = !!card.hidden;
      const canBuy = affordable(card, player);
      // The card itself, painted once and shown small. A hold card used
      // to be a colour-coded stand-in, which meant reading the same
      // card two different ways depending on where it was sitting.
      const node = el('button.hold__card', {
        class: `${blind ? 'hold__card--blind' : ''} ${canBuy && settings.gameplay.highlightAffordable ? 'hold__card--affordable' : ''}`,
        type: 'button',
        tip: {
          title: card.name,
          body: `${card.points} infamy · ${GEM_INFO[card.bonus].label} bonus`,
          note: blind ? 'Stowed blind — only you can see this one.' : null,
        },
        onClick: (event) => {
          play('click');
          const rect = event.currentTarget.getBoundingClientRect();
          showCardInspectorAtRect(card, 'reserve', rect);
        },
      },
        el('img.hold__card__face', {
          src: cardFaceImageUrl(card),
          alt: card.name,
          draggable: 'false',
        }),
        // Face up to you, face down to everyone else.
        blind
          ? el('span.hold__card__blind', { 'aria-label': 'Stowed blind' },
            icon('spyglass', { size: '0.55rem' }), el('span', {}, 'Blind'))
          : null,
      );
      cards.append(node);
    }
    for (let i = player.reserved.length; i < MAX_RESERVED; i++) {
      cards.append(el('div.hold__empty'));
    }

    holdNode.append(
      el('span.hold__label', { tip: '#reserve' }, 'Your Hold'),
      cards,
    );
  }

  function showCardInspectorAtRect(card, from, rect) {
    closeInspector();
    const player = me();
    if (!player) return;
    // Reuse the normal inspector but anchor it to a DOM rect.
    showCardInspector(card, from, null);
    if (inspector) {
      const box = inspector.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - box.width / 2;
      left = Math.max(12, Math.min(window.innerWidth - box.width - 12, left));
      inspector.style.left = `${left}px`;
      inspector.style.top = `${Math.max(12, rect.top - box.height - 14)}px`;
    }
  }

  function refreshActionBar() {
    if (!view || view.phase === 'finished') { actionBar.hidden = true; return; }
    if (!isMyTurn() || view.phase !== 'playing') {
      actionBar.hidden = true;
      return;
    }

    actionBar.hidden = false;
    clear(actionBar);

    const picks = el('div.action-bar__picks');
    for (let i = 0; i < 3; i++) {
      const gem = pending[i];
      picks.append(el(`div.action-bar__slot${gem ? '.action-bar__slot--filled' : ''}`, {},
        gem ? gemChip(gem, null, {}) : null,
      ));
    }

    const counts = pendingCounts();
    const distinct = Object.keys(counts).length;
    const isTwo = distinct === 1 && pending.length === 2;

    let hint = 'Click gem piles on the table, or press 1–5.';
    if (pending.length === 1) {
      const gem = pending[0];
      hint = (view.supply[gem] || 0) >= 4
        ? 'Two more colours — or this one again for a pair. Click it twice more to put it back.'
        : 'Two more colours. Click a picked pile to put it back.';
    }
    if (pending.length === 2 && !isTwo) hint = 'One more colour, or confirm as is.';
    if (isTwo) hint = 'Two of a kind. Ready when you are.';
    if (pending.length === 3) hint = 'Three colours. Ready when you are.';

    actionBar.append(
      el('span.action-bar__label', {}, 'Take gems'),
      picks,
      el('span.action-bar__hint', {}, hint),
      button('Confirm', {
        class: 'btn--go',
        disabled: pending.length === 0 || null,
        onClick: () => confirmGems(),
      }),
      button('Clear', {
        class: 'btn--ghost btn--sm',
        disabled: pending.length === 0 || null,
        onClick: () => { clearPending(); },
      }),
    );
  }

  function refreshBoardHighlights() {
    if (!board) return;
    const keys = pending.map((gem) => `token:${gem}`);
    if (inspector) {
      // The inspector sets its own selection; leave it be.
      return;
    }
    board.setSelected(keys);

    const dim = new Set();
    if (view && settings.gameplay.showLegalOnly && isMyTurn() && view.phase === 'playing') {
      const player = me();
      for (const token of ALL_TOKENS) {
        const picked = pending.includes(token);
        if (token === GOLD || (!picked && !canAddGem(token).ok)) dim.add(`token:${token}`);
      }
      for (const tier of [1, 2, 3]) {
        for (const card of view.board[tier]) {
          if (!card) continue;
          const buyable = affordable(card, player);
          const stowable = player.reserved.length < MAX_RESERVED;
          if (!buyable && !stowable) dim.add(`card:${card.id}`);
        }
      }
    } else if (view && !isMyTurn()) {
      for (const token of ALL_TOKENS) dim.add(`token:${token}`);
    }
    board.setDimmed(dim);
  }

  // ---- log ----

  let lastLogAt = -1;
  function refreshLog() {
    if (!view?.log) return;
    const fresh = view.log.filter((entry) => entry.at > lastLogAt);
    if (fresh.length === 0) return;
    lastLogAt = view.log[view.log.length - 1].at;

    for (const entry of fresh) {
      const node = el('div.log__entry');
      switch (entry.kind) {
        case 'start':
          node.append('The voyage begins: ', el('b', {}, entry.players.join(', ')));
          break;
        case 'take': {
          node.append(el('b', {}, entry.who), ' took ');
          for (const gem of entry.gems) node.append(gemChip(gem, null, { size: 'sm' }));
          break;
        }
        case 'undo': {
          node.append(el('b', {}, entry.who), ' put back ');
          for (const gem of entry.gems) node.append(gemChip(gem, null, { size: 'sm' }));
          break;
        }
        case 'buy':
          node.append(el('b', {}, entry.who), ' bought ', el('i', {}, entry.card),
            entry.points ? ` (+${entry.points})` : '');
          break;
        case 'reserve':
          node.append(el('b', {}, entry.who), ' stowed ', el('i', {}, entry.card), entry.gold ? ' and a doubloon' : '');
          break;
        case 'discard': {
          node.append(el('b', {}, entry.who), ' returned ');
          for (const [token, n] of Object.entries(entry.tokens)) {
            for (let i = 0; i < n; i++) node.append(gemChip(token, null, { size: 'sm' }));
          }
          break;
        }
        case 'lord':
          node.className = 'log__entry log__entry--lord';
          node.append(icon('skull', { size: '0.8rem' }), el('b', {}, entry.lord), ' joined ', el('b', {}, entry.who));
          break;
        case 'pass':
          node.append(el('b', {}, entry.who), ' could do nothing.');
          break;
        case 'end':
          node.className = 'log__entry log__entry--end';
          node.append(icon('crown', { size: '0.8rem' }), el('b', {}, entry.who), ' takes the day.');
          break;
        default:
          continue;
      }
      logList.append(node);
    }
    while (logList.children.length > 60) logList.firstChild.remove();
    logList.scrollTop = logList.scrollHeight;
  }

  function toggleLog() {
    logVisible = !logVisible;
    logNode.classList.toggle('log--collapsed', !logVisible);
    logList.hidden = !logVisible;
  }

  // ------------------------------------------------------------
  // Prompts (discard, choose a Lord, game over)
  // ------------------------------------------------------------

  function closePrompt() {
    promptOverlay?.remove();
    promptOverlay = null;
  }

  function showDiscardPrompt() {
    closePrompt();
    const player = me();
    if (!player) return;
    const excess = view.pending.excess;
    const undoable = !!view.pending.undo;
    let chosen = {};

    const grid = el('div.prompt-grid');
    const counter = el('p.center');
    const confirm = button('Return them', {
      class: 'btn--go',
      disabled: true,
      onClick: () => {
        closePrompt();
        session.submit({ type: 'discard', tokens: chosen });
      },
    });

    const totalChosen = () => Object.values(chosen).reduce((a, b) => a + b, 0);

    function redraw() {
      clear(grid);
      for (const token of ALL_TOKENS) {
        const have = player.tokens[token] || 0;
        if (have === 0) continue;
        const taken = chosen[token] || 0;
        grid.append(el('button.prompt-token', {
          type: 'button',
          disabled: (taken >= have || totalChosen() >= excess) && taken === 0 ? true : null,
          onClick: () => {
            if (taken < have && totalChosen() < excess) {
              chosen[token] = taken + 1;
            } else if (taken > 0) {
              chosen[token] = taken - 1;
              if (chosen[token] === 0) delete chosen[token];
            }
            play('token');
            redraw();
          },
        },
          gemChip(token, null, { size: 'lg' }),
          el('span.prompt-token__count', {}, `${have - taken} left`),
          taken ? el('span.prompt-token__taken', {}, `RETURN ${taken}`) : null,
        ));
      }
      counter.textContent = `${totalChosen()} of ${excess} chosen`;
      confirm.disabled = totalChosen() !== excess;
    }
    redraw();

    const modal = el('div.panel.modal', { style: { '--modal-w': '520px' } },
      el('h2.panel__title', {}, 'Too much treasure'),
      el('p.panel__sub', {},
        `You may only end a turn holding ${MAX_TOKENS_HELD} tokens. Hand back ${excess}`,
        undoable ? ' — or put the gems you just took back and choose again.' : '.'),
      grid,
      counter,
      el('div.modal__foot', {},
        // Reaching this prompt is usually a misclick, so the first
        // thing offered is a way out of it rather than a way through.
        // If the gems cannot go back -- a stow moved a card, and that
        // cannot be quietly unmoved -- the crew will choose instead.
        undoable
          ? button('Put them back', {
            class: 'btn--ghost',
            tip: 'Return the gems to the chest and take your turn again.',
            onClick: () => {
              play('cardSlide');
              closePrompt();
              session.submit({ type: 'undoTake' });
            },
          })
          : button('Let the crew decide', {
            class: 'btn--ghost',
            tip: 'Return whatever helps you least.',
            onClick: () => {
              closePrompt();
              session.submit({ type: 'discard', tokens: autoDiscard(player, excess) });
            },
          }),
        confirm,
      ),
    );

    promptOverlay = el('div.overlay', {}, modal);
    document.body.append(promptOverlay);
    trapFocus(modal);
  }

  /** Give back the tokens we have most of, gold last. */
  function autoDiscard(player, excess) {
    const pool = [];
    for (const token of ALL_TOKENS) {
      for (let i = 0; i < (player.tokens[token] || 0); i++) pool.push(token);
    }
    const counts = {};
    for (const token of pool) counts[token] = (counts[token] || 0) + 1;
    pool.sort((a, b) => {
      if (a === GOLD) return 1;
      if (b === GOLD) return -1;
      return counts[b] - counts[a];
    });
    const out = {};
    for (let i = 0; i < excess; i++) out[pool[i]] = (out[pool[i]] || 0) + 1;
    return out;
  }

  function showLordPrompt() {
    closePrompt();
    const options = view.pending.options
      .map((id) => view.lords.find((l) => l.id === id))
      .filter(Boolean);

    const grid = el('div.lord-choice');
    for (const lord of options) {
      grid.append(el('button.lord-option', {
        type: 'button',
        onClick: () => {
          play('lord');
          closePrompt();
          session.submit({ type: 'chooseLord', lordId: lord.id });
        },
      },
        el('div.lord-option__mark', {}, infamySeal(LORD_POINTS, { size: 'lg' })),
        el('div.lord-option__name', {}, lord.name),
        el('div.lord-option__title', {}, lord.title),
        el('div.lord-option__req', {},
          ...Object.entries(lord.req).map(([gem, n]) => bonusDisc(gem, n))),
      ));
    }

    const modal = el('div.panel.modal', { style: { '--modal-w': '560px' } },
      el('h2.panel__title', {}, 'Two Lords, one berth'),
      el('p.panel__sub', {}, 'More than one will have you. Only one may come aboard this turn.'),
      grid,
    );
    promptOverlay = el('div.overlay', {}, modal);
    document.body.append(promptOverlay);
    trapFocus(modal);
  }

  function showGameOver() {
    closePrompt();
    const table = view.finalStandings || [];
    const rows = el('div.results');
    table.forEach((entry, i) => {
      const player = view.players.find((p) => p.id === entry.id);
      const decor = seatDecor(player?.seat ?? i);
      rows.append(el('div.results__row', { class: i === 0 ? 'results__row--win' : '' },
        el('span.results__place', {}, i === 0 ? icon('crown', { size: '1rem' }) : `${i + 1}`),
        el('span.results__emblem', { style: { background: decor.color } }, seatEmblem(player?.seat ?? i, { size: '0.85rem' })),
        el('span.results__name', {}, entry.name, entry.isAI ? el('span.player-card__ai', {}, 'CPU') : null),
        el('span.results__detail', {}, `${entry.cards} cards · ${entry.lords} lords`),
        el('span.results__score', {}, String(entry.points)),
      ));
    });

    const won = table[0]?.id === session.myId;
    play(won ? 'victory' : 'defeat');

    const modal = el('div.panel.modal', { style: { '--modal-w': '560px' } },
      el('h2.panel__title', {}, won ? 'The day is yours!' : `${table[0]?.name || 'Someone'} takes the day`),
      el('p.panel__sub', {}, view.endReason === 'stalemate'
        ? 'The chest ran dry and nobody could move. Scores as they stood.'
        : 'Ties go to whoever bought fewer cards.'),
      rows,
      el('div.modal__foot', {},
        button('Leave the table', { class: 'btn--ghost', onClick: onLeave }),
        session.isHost
          ? button('Sail again', { class: 'btn--gold', onClick: () => { closePrompt(); onRematch(); } })
          : el('span.muted', {}, 'Waiting for the host to call another voyage…'),
      ),
    );
    promptOverlay = el('div.overlay', {}, modal);
    document.body.append(promptOverlay);
    trapFocus(modal);
  }

  // ------------------------------------------------------------
  // Timer
  // ------------------------------------------------------------

  let lastTickSecond = -1;
  function refreshTimer() {
    if (!deadline || !view || view.phase === 'finished') {
      timerNode.hidden = true;
      return;
    }
    const remaining = Math.max(0, deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const total = (view.options.turnTimer || 1) * 1000;
    timerNode.hidden = false;
    timerNode.style.setProperty('--pct', String(Math.max(0, Math.min(1, remaining / total))));
    timerNode.textContent = String(seconds);
    timerNode.className = `timer${seconds <= 5 ? ' timer--danger' : seconds <= 10 ? ' timer--warn' : ''}`;
    timerNode.dataset.tip = '#timer';

    if (isMyTurn() && seconds !== lastTickSecond && seconds <= 5 && seconds > 0) {
      play('tickUrgent');
    }
    lastTickSecond = seconds;
  }

  const timerInterval = setInterval(refreshTimer, 200);

  // ------------------------------------------------------------
  // Effects → animation & sound
  // ------------------------------------------------------------

  function playEffects(effects) {
    const speed = settings.gameplay.animationSpeed;
    for (const effect of effects) {
      switch (effect.type) {
        case 'tokens':
          effect.gems.forEach((gem, i) => setTimeout(() => play(gem === GOLD ? 'coin' : 'token'), i * 90));
          break;
        case 'reserve':
          play('reserve');
          if (effect.gold) setTimeout(() => play('coin'), 220);
          break;
        case 'purchase':
          play('purchase');
          break;
        case 'lord':
          play('lord');
          break;
        case 'discard':
        case 'undo':
          play('cardSlide');
          break;
        case 'gameOver':
          break;
      }
    }
  }

  // ------------------------------------------------------------
  // Public surface
  // ------------------------------------------------------------

  let previousActor = null;

  function setView(next, { effects = [], reset = false } = {}) {
    const wasMyTurn = isMyTurn();
    view = next;
    if (reset) { lastLogAt = -1; clear(logList); pending = []; }

    closeInspector();
    board.sync(view, { animate: !reset });

    refreshBanner();
    refreshPlayers();
    refreshHold();
    refreshLog();
    refreshActionBar();
    refreshBoardHighlights();
    refreshTimer();

    if (effects.length) playEffects(effects);

    // Prompts that belong to me.
    const actorId = view.pending ? view.pending.playerId : view.players[view.current]?.id;
    if (view.phase === 'finished') {
      showGameOver();
    } else if (view.phase === 'discard' && view.pending.playerId === session.myId) {
      showDiscardPrompt();
    } else if (view.phase === 'chooseLord' && view.pending.playerId === session.myId) {
      showLordPrompt();
    } else {
      closePrompt();
    }

    if (actorId === session.myId && previousActor !== session.myId && view.phase === 'playing') {
      play('turn');
      toast('Your move, Captain.', 'gold', 1600);
    }
    previousActor = actorId;
  }

  function setDeadline(value) {
    deadline = value || 0;
    lastTickSecond = -1;
    refreshTimer();
  }

  // ---- keyboard ----

  function onKeyDown(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (promptOverlay) return;

    const index = '12345'.indexOf(event.key);
    if (index >= 0) { toggleGem(GEMS[index]); return; }

    if (event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter') {
      confirmGems();
      return;
    }
    // Escape is handled centrally so it can fall through to the
    // settings panel when there is nothing here to cancel.
    if (event.key === 'l' || event.key === 'L') { toggleLog(); return; }
    if (event.key === ' ') {
      event.preventDefault();
      world.rig.resetView();
      toast('View recentred.', '', 1200);
    }
  }
  window.addEventListener('keydown', onKeyDown);

  const detachPick = board ? null : null;
  const hooks = { onBoardPick, onBoardHover };

  /** Back out of whatever is open. True if something was dismissed. */
  function consumeEscape() {
    if (promptOverlay) return true;   // discard and choose-Lord are not optional
    if (inspector) { closeInspector(); return true; }
    if (pending.length) { clearPending(); return true; }
    return false;
  }

  return {
    setView,
    setDeadline,
    toast,
    hooks,
    consumeEscape,
    refreshGameplaySettings() {
      refreshHold();
      refreshBoardHighlights();
    },
    destroy() {
      clearInterval(timerInterval);
      window.removeEventListener('keydown', onKeyDown);
      closeInspector();
      closePrompt();
      toasts.remove();
      root.remove();
    },
  };
}
