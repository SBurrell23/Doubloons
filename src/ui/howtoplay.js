// ============================================================
// How to Play — a short illustrated guide.
// The diagrams are inline SVG drawn here, so they theme with
// the rest of the UI and stay crisp at any size.
// ============================================================

import { el, button, clear, trapFocus, gemChip } from './dom.js';
import { play } from '../audio/sfx.js';
import { GEM_INFO, GEMS } from '../game/data.js';
import { icon } from './icons.js';

const NS = 'http://www.w3.org/2000/svg';

function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined) continue;
    node.setAttribute(key, String(value));
  }
  for (const child of children.flat(3)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** A faceted gem, matching the 3D pieces and the HUD chips. */
function gemShape(cx, cy, r, gem, label = null) {
  const info = GEM_INFO[gem];
  const points = [
    [cx, cy - r],
    [cx + r * 0.72, cy - r * 0.16],
    [cx + r * 0.46, cy + r * 0.86],
    [cx - r * 0.46, cy + r * 0.86],
    [cx - r * 0.72, cy - r * 0.16],
  ].map((p) => p.join(',')).join(' ');

  const group = svg('g', {},
    svg('polygon', { points, fill: info.ui, stroke: '#241a10', 'stroke-width': Math.max(1, r * 0.12) }),
    svg('polygon', {
      points: [
        [cx - r * 0.72, cy - r * 0.16],
        [cx, cy - r * 0.55],
        [cx + r * 0.72, cy - r * 0.16],
      ].map((p) => p.join(',')).join(' '),
      fill: '#ffffff', opacity: 0.35,
    }),
  );
  if (label !== null) {
    group.append(svg('text', {
      x: cx, y: cy + r * 0.38,
      'text-anchor': 'middle',
      'font-size': r * 1.05,
      'font-weight': '700',
      'font-family': 'Cinzel, Georgia, serif',
      fill: gem === 'pearl' || gem === 'doubloon' ? '#2c1c0a' : '#fff6de',
      stroke: gem === 'pearl' || gem === 'doubloon' ? '#fff' : 'rgba(20,12,4,0.8)',
      'stroke-width': r * 0.16,
      'paint-order': 'stroke',
    }, String(label)));
  }
  return group;
}

/** A miniature development card. */
function miniCard(x, y, w, h, { bonus = 'sapphire', points = 2, cost = { pearl: 3, ruby: 2 }, name = '' } = {}) {
  const info = GEM_INFO[bonus];
  const group = svg('g', {},
    svg('rect', { x, y, width: w, height: h, rx: w * 0.08, fill: '#e9dcbd', stroke: '#6b5222', 'stroke-width': 2 }),
    svg('path', {
      d: `M${x + 3} ${y + h * 0.26} L${x + 3} ${y + w * 0.08} Q${x + 3} ${y + 3} ${x + w * 0.1} ${y + 3}
          L${x + w - w * 0.1} ${y + 3} Q${x + w - 3} ${y + 3} ${x + w - 3} ${y + w * 0.08}
          L${x + w - 3} ${y + h * 0.26} Z`,
      fill: info.ui, stroke: '#6b5222', 'stroke-width': 1.5,
    }),
  );

  if (points > 0) {
    group.append(svg('text', {
      x: x + w * 0.16, y: y + h * 0.20,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': h * 0.17, 'font-weight': '700',
      'font-family': 'Cinzel, Georgia, serif',
      fill: '#f7eed9', stroke: 'rgba(20,12,4,0.9)', 'stroke-width': h * 0.02, 'paint-order': 'stroke',
    }, String(points)));
  }
  group.append(gemShape(x + w * 0.78, y + h * 0.14, w * 0.13, bonus));

  if (name) {
    group.append(svg('text', {
      x: x + w / 2, y: y + h * 0.42,
      'text-anchor': 'middle', 'font-size': h * 0.085, 'font-weight': '700',
      'font-family': 'Cinzel, Georgia, serif', fill: '#6b502f',
    }, name));
  }

  const entries = Object.entries(cost).filter(([, n]) => n > 0);
  entries.forEach(([gem, n], i) => {
    group.append(gemShape(x + w * 0.19, y + h * (0.85 - i * 0.17), w * 0.13, gem, n));
  });
  return group;
}

function label(x, y, text, { anchor = 'middle', size = 13, weight = 700, fill = '#5b4a34', italic = false } = {}) {
  return svg('text', {
    x, y, 'text-anchor': anchor, 'font-size': size, 'font-weight': weight,
    'font-family': 'Spectral, Georgia, serif',
    'font-style': italic ? 'italic' : 'normal',
    fill,
  }, text);
}

function arrow(x1, y1, x2, y2, { colour = '#6b5222', width = 3, dashed = false } = {}) {
  return svg('g', {},
    svg('defs', {},
      svg('marker', {
        id: `arrowhead-${Math.random().toString(36).slice(2, 8)}`,
      }),
    ),
    svg('line', {
      x1, y1, x2, y2, stroke: colour, 'stroke-width': width,
      'stroke-linecap': 'round',
      'stroke-dasharray': dashed ? '7 6' : null,
    }),
    svg('polygon', {
      points: arrowHead(x1, y1, x2, y2, width * 2.4),
      fill: colour,
    }),
  );
}

function arrowHead(x1, y1, x2, y2, size) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const a = [x2, y2];
  const b = [x2 - Math.cos(angle - 0.42) * size, y2 - Math.sin(angle - 0.42) * size];
  const c = [x2 - Math.cos(angle + 0.42) * size, y2 - Math.sin(angle + 0.42) * size];
  return [a, b, c].map((p) => p.join(',')).join(' ');
}

function figure(diagram, caption) {
  return el('figure.guide__figure', {}, diagram, caption ? el('figcaption', {}, caption) : null);
}

// ------------------------------------------------------------
// Diagrams
// ------------------------------------------------------------

function anatomyDiagram() {
  const root = svg('svg', { viewBox: '0 0 480 310', class: 'guide__svg', role: 'img', 'aria-label': 'The parts of a card' });
  root.append(miniCard(168, 22, 132, 196, {
    bonus: 'sapphire', points: 2, cost: { pearl: 3, ruby: 2 }, name: 'Azure Reef',
  }));

  root.append(arrow(128, 52, 164, 52));
  root.append(label(122, 47, 'Infamy it', { anchor: 'end', size: 13 }));
  root.append(label(122, 63, 'is worth', { anchor: 'end', size: 13 }));

  root.append(arrow(340, 52, 304, 50));
  root.append(label(346, 47, 'The bonus', { anchor: 'start', size: 13 }));
  root.append(label(346, 63, 'it gives', { anchor: 'start', size: 13 }));

  root.append(arrow(128, 196, 166, 190));
  root.append(label(122, 186, 'What it costs', { anchor: 'end', size: 13 }));
  root.append(label(122, 202, 'to buy', { anchor: 'end', size: 13 }));

  root.append(label(240, 262, 'Buy it, and that bonus is yours for the rest', { size: 13, italic: true }));
  root.append(label(240, 282, 'of the game.', { size: 13, italic: true }));
  return root;
}

function bonusDiagram() {
  const root = svg('svg', { viewBox: '0 0 460 230', class: 'guide__svg', role: 'img', 'aria-label': 'How bonuses discount a card' });

  root.append(label(72, 26, 'You already own', { size: 13 }));
  // Two sapphire cards owned.
  root.append(miniCard(20, 40, 52, 74, { bonus: 'sapphire', points: 0, cost: {}, name: '' }));
  root.append(miniCard(50, 52, 52, 74, { bonus: 'sapphire', points: 0, cost: {}, name: '' }));
  root.append(svg('g', {}, gemShape(72, 152, 15, 'sapphire', 2)));
  root.append(label(72, 190, 'two sapphire', { size: 12, italic: true }));
  root.append(label(72, 206, 'bonuses', { size: 12, italic: true }));

  // The card on offer.
  root.append(label(232, 26, 'This card costs', { size: 13 }));
  root.append(miniCard(190, 40, 86, 120, { bonus: 'emerald', points: 1, cost: { sapphire: 3 }, name: '' }));
  root.append(arrow(292, 100, 340, 100));

  // What you actually pay.
  root.append(label(392, 26, 'You pay', { size: 13 }));
  root.append(svg('g', {}, gemShape(392, 78, 22, 'sapphire', 1)));
  root.append(label(392, 138, '3 − 2 = 1', { size: 15, weight: 800, fill: '#2f6a52' }));
  root.append(label(392, 160, 'Only one gem', { size: 12, italic: true }));
  root.append(label(392, 176, 'leaves your hand.', { size: 12, italic: true }));
  return root;
}

function turnDiagram() {
  const root = svg('svg', { viewBox: '0 0 460 190', class: 'guide__svg', role: 'img', 'aria-label': 'The four turn options' });

  const panel = (x, title) => {
    root.append(svg('rect', {
      x, y: 14, width: 100, height: 152, rx: 12,
      fill: 'rgba(255,251,240,0.5)', stroke: '#6b5222', 'stroke-width': 1.5,
    }));
    root.append(label(x + 50, 36, title, { size: 11.5, weight: 700, fill: '#241a10' }));
  };

  panel(8, 'Take 3');
  ['pearl', 'emerald', 'ruby'].forEach((gem, i) => root.append(gemShape(32 + i * 26, 84, 15, gem)));
  root.append(label(58, 140, 'three different', { size: 11, italic: true }));
  root.append(label(58, 154, 'colours', { size: 11, italic: true }));

  panel(120, 'Take 2');
  root.append(gemShape(156, 78, 17, 'sapphire'));
  root.append(gemShape(184, 92, 17, 'sapphire'));
  root.append(label(170, 140, 'same colour, if', { size: 11, italic: true }));
  root.append(label(170, 154, '4+ are left', { size: 11, italic: true }));

  panel(232, 'Stow');
  root.append(miniCard(252, 56, 40, 56, { bonus: 'onyx', points: 0, cost: {}, name: '' }));
  root.append(gemShape(300, 84, 14, 'doubloon'));
  root.append(label(282, 140, 'save a card,', { size: 11, italic: true }));
  root.append(label(282, 154, 'take a doubloon', { size: 11, italic: true }));

  panel(344, 'Buy');
  root.append(miniCard(366, 56, 40, 56, { bonus: 'ruby', points: 1, cost: {}, name: '' }));
  root.append(label(394, 140, 'pay the cost,', { size: 11, italic: true }));
  root.append(label(394, 154, 'keep it forever', { size: 11, italic: true }));
  return root;
}

function lordDiagram() {
  const root = svg('svg', { viewBox: '0 0 440 210', class: 'guide__svg', role: 'img', 'aria-label': 'How a Pirate Lord joins you' });

  root.append(label(88, 24, 'Your bonuses', { size: 13 }));
  [['pearl', 3], ['ruby', 3], ['onyx', 3]].forEach(([gem, n], i) => {
    root.append(gemShape(36 + i * 52, 66, 20, gem, n));
  });
  root.append(label(88, 122, 'from cards you own —', { size: 11.5, italic: true }));
  root.append(label(88, 137, 'gems in hand do not count', { size: 11.5, italic: true }));

  root.append(arrow(200, 66, 248, 66));

  // The tile.
  root.append(svg('rect', { x: 262, y: 18, width: 150, height: 150, rx: 14, fill: '#e9dcbd', stroke: '#6b5222', 'stroke-width': 2 }));
  root.append(svg('circle', { cx: 292, cy: 48, r: 18, fill: '#7e2a22' }));
  root.append(label(292, 54, '3', { size: 20, weight: 800, fill: '#f0e2c2' }));
  root.append(svg('circle', { cx: 340, cy: 86, r: 17, fill: '#241a10' }));
  root.append(svg('path', { d: 'M316 76 Q340 52 364 76 Q340 66 316 76 Z', fill: '#241a10' }));
  root.append(label(337, 126, 'Dame Isolde Vane', { size: 11, weight: 800, fill: '#241a10' }));
  root.append(label(337, 142, 'the Threefold', { size: 10.5, italic: true }));
  root.append(label(337, 160, 'joins you — free, and', { size: 10.5, italic: true }));

  root.append(label(220, 196, 'A Lord arrives the moment you qualify. It costs no action and cannot be refused.', { size: 12, italic: true }));
  return root;
}

function endDiagram() {
  const root = svg('svg', { viewBox: '0 0 440 150', class: 'guide__svg', role: 'img', 'aria-label': 'How the game ends' });
  const seats = ['You', 'Bess', 'Pike', 'Gale'];
  seats.forEach((name, i) => {
    const x = 50 + i * 110;
    const reached = i === 1;
    root.append(svg('circle', {
      cx: x, cy: 52, r: 26,
      fill: reached ? '#dcb968' : 'rgba(255,251,240,0.55)',
      stroke: '#6b5222', 'stroke-width': 1.5,
    }));
    root.append(label(x, 58, reached ? '15' : String(9 + i), { size: 17, weight: 800, fill: '#241a10' }));
    root.append(label(x, 96, name, { size: 12, weight: 700 }));
    if (i < seats.length - 1) root.append(arrow(x + 32, 52, x + 78, 52, { width: 2.5, dashed: true }));
  });
  root.append(label(220, 128, 'Bess hits 15 — but the round is played out so everyone gets equal turns.', { size: 12, italic: true }));
  return root;
}

// ------------------------------------------------------------
// Pages
// ------------------------------------------------------------

function pGoal() {
  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'What you are trying to do'),
    el('p', {}, 'You are a pirate captain building a fleet and a reputation. Gems buy cards. Cards give you ',
      el('b', {}, 'infamy'), ' — and a permanent ', el('b', {}, 'bonus'), ' that makes every later card cheaper.'),
    el('p', {}, 'First captain to ', el('b', {}, '15 infamy'), ' triggers the final round. Highest total wins.'),
    figure(anatomyDiagram(), 'Every card does three things at once.'),
    el('div.guide__callout', {},
      el('b', {}, 'The whole game in one line: '),
      'cheap cards buy better cards, better cards buy the best ones.'),
  );
}

function pTurn() {
  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'Your turn — pick exactly one'),
    figure(turnDiagram(), 'One of these four, every turn. Never two.'),
    el('ol.guide__list', {},
      el('li', {}, el('b', {}, 'Take three gems'), ' of different colours. If fewer than three colours are left, take what there is.'),
      el('li', {}, el('b', {}, 'Take two gems'), ' of one colour — only when that pile still holds four or more.'),
      el('li', {}, el('b', {}, 'Stow a card'), ' into your hold so nobody else can buy it, and take a doubloon. Three in the hold at most.'),
      el('li', {}, el('b', {}, 'Buy a card'), ' from the table or out of your own hold.'),
    ),
    el('div.guide__callout.guide__callout--warn', {},
      el('b', {}, 'Ten tokens. '),
      'You may not end a turn holding more than ten, doubloons included. Go over and you hand the excess back.'),
  );
}

function pBonus() {
  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'Bonuses are the engine'),
    el('p', {}, 'A bonus is a gem you never spend. It comes off the price of every future card of that colour, every time, forever.'),
    figure(bonusDiagram(), 'Two sapphire bonuses turn a 3-sapphire card into a 1-sapphire card.'),
    el('p', {}, 'Stack enough bonuses and cards start costing nothing at all. That is how a slow opening turns into a fast finish — and why cheap tier I cards are worth buying even when they score zero.'),
    el('div.guide__callout', {},
      el('b', {}, 'Doubloons'), ' are the gold wilds. One stands in for any gem. The only way to get one is to stow a card, and there are just five in the game.'),
  );
}

function pLords() {
  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'Pirate Lords'),
    el('p', {}, 'Each Lord is worth ', el('b', {}, '3 infamy'), ' — the same as a very expensive card, for free.'),
    figure(lordDiagram(), 'Meet a Lord’s demand and they join at the end of your turn.'),
    el('ul.guide__list', {},
      el('li', {}, 'They count ', el('b', {}, 'bonuses only'), '. Gems in your hand are irrelevant.'),
      el('li', {}, 'Arriving costs no action, and you cannot decline.'),
      el('li', {}, 'Only one Lord per turn. If two qualify at once, you choose.'),
      el('li', {}, 'There is always one more Lord on the table than there are captains.'),
    ),
  );
}

function pEnd() {
  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'Ending the voyage'),
    figure(endDiagram(), 'Reaching the target starts the last lap — it does not stop play.'),
    el('ul.guide__list', {},
      el('li', {}, 'When someone reaches the target, the round is finished so everybody has had the same number of turns.'),
      el('li', {}, 'Highest infamy wins.'),
      el('li', {}, 'A tie goes to whoever bought ', el('b', {}, 'fewer'), ' cards — efficiency beats volume.'),
    ),
    el('div.guide__callout', {},
      el('b', {}, 'A word of advice: '),
      'do not chase the biggest cards early. Three cheap bonuses now will buy you a five-infamy legend later.'),
  );
}

function pReference() {
  const gemRow = el('div.guide__gems');
  for (const gem of GEMS) {
    gemRow.append(el('div.guide__gem', {},
      gemChip(gem, null, { size: 'lg' }),
      el('span', {}, GEM_INFO[gem].label),
    ));
  }
  gemRow.append(el('div.guide__gem', {},
    gemChip('doubloon', null, { size: 'lg' }),
    el('span', {}, 'Doubloon (wild)'),
  ));

  const rows = [
    ['Gems per colour', '4 with two captains · 5 with three · 7 with four'],
    ['Doubloons', '5, always'],
    ['Cards on the table', '4 face up from each of the three tiers'],
    ['Pirate Lords', 'One more than the number of captains'],
    ['Tokens you may hold', '10 at the end of your turn'],
    ['Cards in your hold', '3'],
    ['Take two of a colour', 'Only when 4 or more remain'],
    ['Target', '15 infamy by default'],
  ];
  const table = el('div.guide__table');
  for (const [k, v] of rows) {
    table.append(el('div.guide__table-row', {}, el('span.guide__table-key', {}, k), el('span', {}, v)));
  }

  return el('div.guide__page', {},
    el('h3.guide__heading', {}, 'Quick reference'),
    gemRow,
    table,
    el('h3.guide__heading', {}, 'At the table'),
    el('ul.guide__list', {},
      el('li', {}, 'Left-drag slides the view, right-drag swings it, the wheel zooms.'),
      el('li', {}, el('kbd', {}, 'W'), ' ', el('kbd', {}, 'A'), ' ', el('kbd', {}, 'S'), ' ', el('kbd', {}, 'D'),
        ' or the arrow keys slide the view. ', el('kbd', {}, 'Space'), ' returns you to the table.'),
      el('li', {}, 'Click a gem pile to pick it up, and click it again to put it back. ',
        el('kbd', {}, 'Esc'), ' clears the lot.'),
      el('li', {}, 'Click a card to see what it would cost you right now.'),
      el('li', {}, 'Hover anything you do not recognise — it will explain itself.'),
    ),
  );
}

const PAGES = [
  { id: 'goal', label: 'The Goal', icon: 'target', render: pGoal },
  { id: 'turn', label: 'Your Turn', icon: 'cutlasses', render: pTurn },
  { id: 'bonus', label: 'Bonuses', icon: 'gem', render: pBonus },
  { id: 'lords', label: 'Pirate Lords', icon: 'skull', render: pLords },
  { id: 'end', label: 'Winning', icon: 'crown', render: pEnd },
  { id: 'reference', label: 'Reference', icon: 'scroll', render: pReference },
];

let openGuide = null;

export function howToPlayOpen() { return !!openGuide; }

export function closeHowToPlay() { openGuide?.close(); }

export function openHowToPlay(initial = 'goal') {
  if (openGuide) { openGuide.showPage(initial); return openGuide; }

  let index = Math.max(0, PAGES.findIndex((p) => p.id === initial));
  const body = el('div.modal__body.scroll.guide__body');
  const tabBar = el('div.tabs', { role: 'tablist', 'aria-label': 'Guide sections' });
  const tabButtons = [];

  PAGES.forEach((page, i) => {
    const node = el('button.tab', {
      type: 'button', role: 'tab',
      'aria-selected': String(i === index),
      onClick: () => { play('click'); showIndex(i); },
      onPointerEnter: () => play('hover'),
    }, icon(page.icon, { size: '0.95rem' }), page.label);
    tabButtons.push(node);
    tabBar.append(node);
  });

  const prevBtn = button([icon('chevronLeft', { size: '0.8rem' }), 'Back'], {
    class: 'btn--ghost', onClick: () => showIndex(index - 1),
  });
  const nextBtn = button('Next', { class: 'btn--gold', onClick: () => showIndex(index + 1) });

  const modal = el('div.panel.modal.guide', { style: { '--modal-w': '1380px' } },
    el('div.modal__head', {},
      el('div.grow', {},
        el('h2.panel__title', {}, 'How to Play'),
        el('p.panel__sub', {}, 'Five minutes, and you will not need it again.'),
      ),
      button(icon('close', { size: '1rem' }), { class: 'btn--ghost btn-icon', 'aria-label': 'Close the guide', onClick: () => close() }),
    ),
    tabBar,
    body,
    el('div.modal__foot', {},
      el('span.guide__progress.grow', {}),
      prevBtn, nextBtn,
    ),
  );

  const overlay = el('div.overlay', {
    onPointerDown: (event) => { if (event.target === overlay) close(); },
  }, modal);

  const releaseFocus = trapFocus(modal);
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
    if (event.key === 'ArrowRight') showIndex(index + 1);
    if (event.key === 'ArrowLeft') showIndex(index - 1);
  });

  document.body.append(overlay);
  modal.querySelector('.tab')?.focus();

  function showIndex(next) {
    index = Math.max(0, Math.min(PAGES.length - 1, next));
    tabButtons.forEach((node, i) => node.setAttribute('aria-selected', String(i === index)));
    clear(body);
    body.append(PAGES[index].render());
    body.scrollTop = 0;
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === PAGES.length - 1 ? 'Got it' : 'Next';
    if (index < PAGES.length - 1) nextBtn.append(icon('chevronRight', { size: '0.8rem' }));
    modal.querySelector('.guide__progress').textContent = `${index + 1} of ${PAGES.length}`;
  }

  function close() {
    play('click');
    releaseFocus();
    overlay.remove();
    openGuide = null;
  }

  nextBtn.addEventListener('click', () => {
    if (index === PAGES.length - 1) close();
  });

  showIndex(index);
  openGuide = { close, showPage: (id) => showIndex(PAGES.findIndex((p) => p.id === id)) };
  return openGuide;
}
