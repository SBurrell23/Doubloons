// ============================================================
// Custom tooltips.
//
// Anything with data-tip gets one. Plain text works; a value
// starting with "#" looks up a richer explainer from the glossary
// below, which is how the game teaches its own vocabulary.
// ============================================================

import { el, clear, append, gemChip, bonusDisc } from './dom.js';

let layer = null;
let bubble = null;
let hideTimer = 0;
let currentKey = null;
let enabled = true;
let pinned = null;

// ------------------------------------------------------------
// Glossary — the teaching text, kept in one place
// ------------------------------------------------------------

export const GLOSSARY = {
  infamy: {
    title: 'Infamy',
    body: 'Your score. First captain to reach the target — 15 by default — triggers the last round.',
    note: 'Infamy comes from cards and from Pirate Lords.',
  },
  bonus: {
    title: 'Bonus',
    body: 'Every card you buy gives a permanent bonus of its colour. A bonus acts like a gem you never spend — it makes every future card of that colour cheaper, forever.',
    note: 'Bonuses are what make the late game fast.',
  },
  doubloon: {
    title: 'Doubloon (wild)',
    body: 'Gold. Stands in for any one gem when you pay. The only way to get one is to stow a card.',
    note: 'There are just 5 in the game.',
  },
  takeThree: {
    title: 'Take three gems',
    body: 'Take one gem each of three different colours. If fewer than three colours are left in the chest, take what there is.',
  },
  takeTwo: {
    title: 'Take two of a kind',
    body: 'Take two gems of the same colour — but only when that pile still holds four or more.',
  },
  reserve: {
    title: 'Stow a card',
    body: 'Put a card in your hold for later. Nobody else can buy it. You also take a doubloon, if any are left.',
    note: 'Three cards in the hold at most. The only way out of the hold is to buy it.',
  },
  reserveDeck: {
    title: 'Stow blind',
    body: 'Take the top card of a deck without showing it. Only you can see what it is.',
  },
  purchase: {
    title: 'Buy a card',
    body: 'Pay the cost shown, minus your bonuses. Doubloons cover anything you are short.',
  },
  lord: {
    title: 'Pirate Lords',
    body: 'Worth 3 Infamy each. A Lord joins you the moment your bonuses meet their demand — it costs no action and no gems, and you cannot turn one down.',
    note: 'Bonuses only. Gems in hand never count.',
  },
  handLimit: {
    title: 'Ten gems',
    body: 'You may end a turn holding ten tokens at most, doubloons included. Over that, you return the excess.',
  },
  holdLimit: {
    title: 'Hold limit',
    body: 'Three stowed cards at most.',
  },
  supply: {
    title: 'The chest',
    body: 'The shared pool of gems. How many there are depends on the number of captains: 4 each for two, 5 for three, 7 for four.',
  },
  lastRound: {
    title: 'Last round',
    body: 'When someone reaches the target, play continues until everyone has had the same number of turns. Then the highest Infamy wins.',
    note: 'Ties go to whoever bought fewer cards.',
  },
  timer: {
    title: 'Turn timer',
    body: 'When it runs out, a sensible move is played for you.',
  },
};

// ------------------------------------------------------------
// Layer
// ------------------------------------------------------------

function ensureLayer() {
  if (layer) return;
  layer = el('div.tooltip-layer');
  bubble = el('div.tooltip', { role: 'tooltip' });
  layer.append(bubble);
  document.body.append(layer);
}

function renderContent(content) {
  clear(bubble);
  if (typeof content === 'string') {
    bubble.append(el('div.tooltip__body', {}, content));
    return;
  }
  if (content.title) bubble.append(el('div.tooltip__title', {}, content.title));
  if (content.body) bubble.append(el('div.tooltip__body', {}, content.body));
  // After the sentence, not before it: a Lord's tile says "needs these
  // bonuses:" and the colon has to have something to point at.
  //
  // Gems are what you pay; bonuses are what you own. They are different
  // things and they are drawn differently everywhere else, so a Lord's
  // demands come through `bonuses` and wear the disc.
  if (content.gems) {
    const row = el('div.tooltip__gems');
    for (const [gem, count] of Object.entries(content.gems)) row.append(gemChip(gem, count, { size: 'sm' }));
    bubble.append(row);
  }
  if (content.bonuses) {
    const row = el('div.tooltip__gems');
    for (const [gem, count] of Object.entries(content.bonuses)) row.append(bonusDisc(gem, count, { size: 'sm' }));
    bubble.append(row);
  }
  if (content.lines) {
    const list = el('ul.tooltip__list');
    for (const line of content.lines) list.append(el('li', {}, line));
    bubble.append(list);
  }
  if (content.nodes) append(bubble, [content.nodes]);
  if (content.note) bubble.append(el('div.tooltip__note', {}, content.note));
}

function place(x, y, { above = false } = {}) {
  bubble.style.visibility = 'hidden';
  bubble.classList.add('is-visible');
  const rect = bubble.getBoundingClientRect();
  const margin = 10;

  let left = x - rect.width / 2;
  left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));

  let top = above ? y - rect.height - 14 : y + 18;
  let flipped = false;
  if (top < margin) { top = y + 18; flipped = true; }
  if (top + rect.height > window.innerHeight - margin) {
    top = Math.max(margin, y - rect.height - 14);
    flipped = true;
  }

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  bubble.classList.toggle('tooltip--below', !above || flipped);
  bubble.style.setProperty('--arrow-x', `${Math.max(14, Math.min(rect.width - 14, x - left))}px`);
  bubble.style.visibility = '';
}

/** Show a tooltip at a point on screen. */
export function showTip(content, x, y, options = {}) {
  if (!enabled && !options.force) return;
  ensureLayer();
  clearTimeout(hideTimer);
  renderContent(content);
  place(x, y, options);
  bubble.classList.add('is-visible');
}

export function hideTip() {
  if (!bubble) return;
  bubble.classList.remove('is-visible');
  currentKey = null;
}

export function setTooltipsEnabled(value) {
  enabled = value;
  if (!value) hideTip();
}

export function tooltipsEnabled() { return enabled; }

/** Resolve a data-tip value into content. */
export function resolveTip(raw) {
  if (!raw) return null;
  if (raw.startsWith('#')) return GLOSSARY[raw.slice(1)] || null;
  if (raw.startsWith('{')) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  return raw;
}

// ------------------------------------------------------------
// Global hover wiring
// ------------------------------------------------------------

export function installTooltips() {
  ensureLayer();

  const onOver = (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
    if (!target) {
      if (!pinned) scheduleHide();
      return;
    }
    const raw = target.dataset.tip;
    if (raw === currentKey && bubble.classList.contains('is-visible')) return;
    const content = resolveTip(raw);
    if (!content) return;
    currentKey = raw;
    const rect = target.getBoundingClientRect();
    const above = rect.top > window.innerHeight * 0.55;
    showTip(content, rect.left + rect.width / 2, above ? rect.top : rect.bottom, { above });
  };

  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideTip, 60);
  };

  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
    if (target && !pinned) scheduleHide();
  });
  document.addEventListener('pointerdown', () => { if (!pinned) hideTip(); });
  window.addEventListener('blur', hideTip);
  window.addEventListener('scroll', hideTip, true);

  // Keyboard users get the same explanations.
  document.addEventListener('focusin', (event) => {
    const target = event.target instanceof Element ? event.target.closest('[data-tip]') : null;
    if (!target) return;
    const content = resolveTip(target.dataset.tip);
    if (!content) return;
    const rect = target.getBoundingClientRect();
    showTip(content, rect.left + rect.width / 2, rect.bottom);
  });
  document.addEventListener('focusout', () => scheduleHide());
}

/** Keep a tooltip open regardless of hover — used by the 3D board. */
export function pinTip(content, x, y, options = {}) {
  pinned = true;
  showTip(content, x, y, { ...options, force: true });
}

export function unpinTip() {
  pinned = null;
  hideTip();
}
