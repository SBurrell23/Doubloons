// Minimal DOM helpers. No framework; the UI is small enough.

import { play } from '../audio/sfx.js';
import { icon, skullMark } from './icons.js';

/**
 * el('div.foo#bar', { attrs }, ...children)
 * Attributes: class, id, text, html, style (object), on* handlers,
 * data-* and aria-* pass straight through.
 */
export function el(spec, props = null, ...children) {
  let tag = 'div';
  let classes = [];
  let id = null;

  const match = String(spec).match(/^([a-zA-Z0-9-]*)((?:[.#][^.#]+)*)$/);
  if (match) {
    if (match[1]) tag = match[1];
    for (const token of match[2].match(/[.#][^.#]+/g) || []) {
      if (token[0] === '.') classes.push(token.slice(1));
      else id = token.slice(1);
    }
  } else {
    tag = spec;
  }

  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  if (id) node.id = id;

  if (props && (Array.isArray(props) || props instanceof Node || typeof props === 'string')) {
    children.unshift(props);
    props = null;
  }

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') node.className = [node.className, value].filter(Boolean).join(' ');
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key === 'style' && typeof value === 'object') applyStyle(node, value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'tip') {
        node.dataset.tip = typeof value === 'string' ? value : JSON.stringify(value);
      } else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, value);
    }
  }

  append(node, children);
  return node;
}

/**
 * Object.assign onto a CSSStyleDeclaration silently drops custom
 * properties — they only land through setProperty — so every
 * `--var` passed as a style was being thrown away.
 */
function applyStyle(node, style) {
  for (const [prop, value] of Object.entries(style)) {
    if (value === null || value === undefined) continue;
    if (prop.startsWith('--')) node.style.setProperty(prop, String(value));
    else node.style[prop] = value;
  }
}

export function append(parent, children) {
  for (const child of children.flat(4)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** A button that also makes a noise. */
export function button(label, props = {}) {
  const { onClick, sound = 'click', ...rest } = props;
  const node = el('button.btn', {
    type: 'button',
    ...rest,
    onClick: (event) => {
      if (node.disabled) return;
      play(sound);
      onClick?.(event);
    },
    onPointerEnter: () => { if (!node.disabled) play('hover'); },
  });
  if (typeof label === 'string') node.append(label);
  else append(node, [label]);
  return node;
}

/** A segmented control. options: [{ value, label, tip }] */
export function segmented({ value, options, onChange, name }) {
  const root = el('div.segmented', { role: 'group', 'aria-label': name || 'options' });
  const buttons = new Map();
  for (const option of options) {
    const node = el('button.segmented__option', {
      type: 'button',
      'aria-pressed': String(option.value === value),
      tip: option.tip || null,
      onClick: () => {
        play('click');
        for (const [val, btn] of buttons) btn.setAttribute('aria-pressed', String(val === option.value));
        onChange?.(option.value);
      },
      onPointerEnter: () => play('hover'),
    }, option.label);
    buttons.set(option.value, node);
    root.append(node);
  }
  root.setValue = (next) => {
    for (const [val, btn] of buttons) btn.setAttribute('aria-pressed', String(val === next));
  };
  return root;
}

export function slider({ value, min = 0, max = 1, step = 0.01, format, onInput, label }) {
  const readout = el('span.slider-row__value', {}, format ? format(value) : String(value));
  const input = el('input.slider', {
    type: 'range',
    min: String(min), max: String(max), step: String(step),
    value: String(value),
    'aria-label': label || 'value',
    onInput: (e) => {
      const next = Number(e.target.value);
      input.style.setProperty('--pct', `${((next - min) / (max - min)) * 100}%`);
      readout.textContent = format ? format(next) : String(next);
      onInput?.(next);
    },
  });
  input.style.setProperty('--pct', `${((value - min) / (max - min)) * 100}%`);
  const row = el('div.slider-row', {}, input, readout);
  row.setValue = (next) => {
    input.value = String(next);
    input.style.setProperty('--pct', `${((next - min) / (max - min)) * 100}%`);
    readout.textContent = format ? format(next) : String(next);
  };
  return row;
}

export function toggle({ value, label, onChange, tip }) {
  const input = el('input', {
    type: 'checkbox',
    checked: value || null,
    onChange: (e) => { play('click'); onChange?.(e.target.checked); },
  });
  const root = el('label.toggle', { tip: tip || null },
    input,
    el('span.toggle__track'),
    el('span.toggle__label', {}, label),
  );
  root.setValue = (next) => { input.checked = !!next; };
  return root;
}

export function field(label, control, hint) {
  return el('div.field', {},
    el('span.field__label', {}, label),
    control,
    hint ? el('span.field__hint', {}, hint) : null,
  );
}

/** A gem chip with an optional count. */
export function gemChip(gem, count = null, { size = '', dim = false, tip = null } = {}) {
  const classes = ['gem', `gem--${gem}`];
  if (size) classes.push(`gem--${size}`);
  if (dim) classes.push('gem--empty');
  return el(`span.${classes.join('.')}`, { tip },
    count === null ? null : el('span', {}, String(count)),
  );
}

/**
 * A bonus, drawn the way the cards draw it: the stone sunk in a dark
 * disc with a brass ring. The player panels and the Lord tiles used to
 * each have their own idea of what a bonus looked like; this is the
 * card's, which is the one people learn first.
 *
 * `drawBonusDisc` in three/textures.js is the same thing in Canvas2D.
 */
export function bonusDisc(gem, count = null, { size = '', tip = null, empty = false } = {}) {
  const classes = ['bonus-disc'];
  if (size) classes.push(`bonus-disc--${size}`);
  if (empty) classes.push('bonus-disc--none');
  return el(`span.${classes.join('.')}`, { tip },
    el(`span.bonus-disc__gem.gem.gem--${gem}`),
    count === null ? null : el('span.bonus-disc__n', {}, String(count)),
  );
}

/**
 * Infamy: the skull, and how many. `×3` on anything that is worth
 * three — a card, a Lord — and a plain total on anything that has
 * three, like a player's running score.
 *
 * drawInfamyMark() paints the same mark on the cards and Lord tiles.
 */
function infamyMark(points, { times, size, tip }) {
  const classes = ['infamy-mark'];
  if (times) classes.push('infamy-mark--times');
  if (size) classes.push(`infamy-mark--${size}`);
  return el(`span.${classes.join('.')}`, {
    tip, role: 'img', 'aria-label': `${points} Infamy`,
  },
    skullMark({ size: '1em', className: 'infamy-mark__skull' }),
    // The times sign carries its own trailing space; kerned against the
    // digit it reads as one glyph. One skull is one Infamy, and saying
    // so twice is worse than not saying it at all.
    times && points > 1 ? el('span.infamy-mark__times', {}, '\u00d7') : null,
    times && points <= 1 ? null : el('span.infamy-mark__n', {}, String(points)),
  );
}

/** What a thing is worth: skull ×3. */
export function infamyTimes(points, { size = '', tip = null } = {}) {
  return infamyMark(points, { times: true, size, tip });
}

/** What somebody has: skull 17. */
export function infamyCount(points, { size = '', tip = null } = {}) {
  return infamyMark(points, { times: false, size, tip });
}

/** Format a cost object as a row of gem chips. */
export function costRow(cost, { size = 'sm', bonuses = null } = {}) {
  const row = el('span.gem-row');
  for (const [gem, amount] of Object.entries(cost)) {
    if (!amount) continue;
    const discount = bonuses ? Math.min(amount, bonuses[gem] || 0) : 0;
    const net = amount - discount;
    const chip = gemChip(gem, net > 0 ? net : 0, { size, dim: net === 0 });
    if (discount > 0) chip.title = `${amount} − ${discount} bonus`;
    row.append(chip);
  }
  return row;
}

let liveRegion = null;

/** Announce something to screen readers without a visual change. */
export function announce(message) {
  if (!liveRegion) {
    liveRegion = el('div.sr-only', { role: 'status', 'aria-live': 'polite' });
    document.body.append(liveRegion);
  }
  liveRegion.textContent = message;
}

/** Trap focus inside a modal while it is open. */
export function trapFocus(container) {
  const selector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const onKey = (event) => {
    if (event.key !== 'Tab') return;
    const items = [...container.querySelectorAll(selector)].filter((n) => !n.disabled && n.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}
