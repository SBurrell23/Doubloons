// ============================================================
// Icons.
//
// Hand-drawn SVG, one 24×24 grid, inheriting currentColor.
// No emoji anywhere in this game.
// ============================================================

const NS = 'http://www.w3.org/2000/svg';

/*
 * The skull comes in two layers. As an icon it is one path with the
 * sockets cut out by the even-odd rule; as Infamy's mark it is a bone
 * silhouette with a dark outline and the features painted back on top,
 * which is the only way a skull reads on a red card, a blue card and
 * somebody's portrait all at once.
 */
/*
 * A high cranium that tapers to the cheekbones and hands down to a
 * narrower jaw, and sockets cut as slanted wedges rather than drilled
 * as circles -- they fall toward the nose, which is the whole of the
 * difference between a skull that scowls and a skull that gawps.
 */
export const SKULL_SILHOUETTE =
  'M12 1.3C7.7 1.3 4.6 5 4.6 9.7c0 2.6.8 4.6 2.2 6l1 1v2.9c0 1.7 1.3 3.1 3 3.1h2.4c1.7 0 3-1.4 3-3.1v-2.9l1-1c1.4-1.4 2.2-3.4 2.2-6C19.4 5 16.3 1.3 12 1.3z';
export const SKULL_FEATURES =
  'M6 7.9l5.2 2-.8 3.4-4.6-1z' +
  'M18 7.9l-5.2 2 .8 3.4 4.6-1z' +
  'M12 13.4l1.7 3.1h-3.4z' +
  'M9.9 17.5h1v3.2h-1z' +
  'M11.5 17.5h1v3.2h-1z' +
  'M13.1 17.5h1v3.2h-1z';

/** How heavy the outline is, on the 24-unit grid. */
export const SKULL_MARK_STROKE = 3.2;

/**
 * Where the jaw ends, as a share of the 24-unit box. What sits beside
 * the skull lines its feet up with this rather than with the middle.
 */
export const SKULL_MARK_FOOT = 22.7 / 24;

/** Bone, and the dark it is drawn against. */
export const MARK_BONE = '#f7ecd2';
export const MARK_INK = '#100a05';

/** Solid shapes, with holes cut by the even-odd rule. */
const FILLED = {
  skull: SKULL_SILHOUETTE + SKULL_FEATURES,

  crown:
    'M3 8.4l3.4 2.9L12 4.6l5.6 6.7L21 8.4l-1.7 9.2H4.7L3 8.4z' +
    'M6.3 15.1h11.4v1.1H6.3z',

  gem:
    'M12 2.4l6.6 4.1-2.2 13.1H7.6L5.4 6.5 12 2.4z' +
    'M12 5.1L8.3 7.4l1.5 9h4.4l1.5-9L12 5.1z',

  coin:
    'M12 2.6a9.4 9.4 0 1 0 0 18.8 9.4 9.4 0 0 0 0-18.8z' +
    'M12 4.9a7.1 7.1 0 1 1 0 14.2 7.1 7.1 0 0 1 0-14.2z' +
    'M12 6.6a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8z',

  chest:
    'M3.2 10.4h17.6v9.3H3.2z' +
    'M11 12.7h2v4.4h-2z' +
    'M12 3.4c-4.9 0-8.8 2.4-8.8 5.4v.4h17.6v-.4c0-3-3.9-5.4-8.8-5.4z' +
    'M10.9 5.6h2.2v3.6h-2.2z',
};

/** Line drawings. Stroked, round caps and joins. */
const STROKED = {
  anchor: [
    'M12 2.6a2.2 2.2 0 1 1 0 4.4 2.2 2.2 0 0 1 0-4.4z',
    'M12 7v13.6',
    'M7.6 9.6h8.8',
    'M4.2 13.9a8 8 0 0 0 15.6 0',
    'M4.2 13.9h2.9',
    'M19.8 13.9h-2.9',
  ],

  // Two sabres crossed: curved blade, crossguard, grip.
  cutlasses: [
    'M7.6 16.2C11 13.8 14.6 10 18.9 4.3',
    'M5.7 15l3.1 3.1',
    'M3.8 20.9l2.7-2.7',
    'M16.4 16.2C13 13.8 9.4 10 5.1 4.3',
    'M18.3 15l-3.1 3.1',
    'M20.2 20.9l-2.7-2.7',
  ],

  wheel: [
    'M12 4.2a7.8 7.8 0 1 1 0 15.6 7.8 7.8 0 0 1 0-15.6z',
    'M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2z',
    'M12 2.2v6.2M12 15.6v6.2',
    'M2.2 12h6.2M15.6 12h6.2',
    'M5.1 5.1l4.4 4.4M14.5 14.5l4.4 4.4',
    'M18.9 5.1l-4.4 4.4M9.5 14.5l-4.4 4.4',
  ],

  compass: [
    'M12 2.8a9.2 9.2 0 1 1 0 18.4 9.2 9.2 0 0 1 0-18.4z',
    'M15.6 8.4l-2 5.2-5.2 2 2-5.2 5.2-2z',
  ],

  book: [
    'M3.6 4.4h6.2c1.2 0 2.2 1 2.2 2.2v13c0-1-.9-1.8-2-1.8H3.6V4.4z',
    'M20.4 4.4h-6.2c-1.2 0-2.2 1-2.2 2.2v13c0-1 .9-1.8 2-1.8h6.4V4.4z',
    'M12 6.6v13',
  ],

  scroll: [
    'M6.4 3.6h11.2a2.4 2.4 0 0 1 2.4 2.4c0 1.3-1.1 2.4-2.4 2.4h-2.2',
    'M6.4 3.6A2.4 2.4 0 0 0 4 6v12a2.4 2.4 0 0 0 2.4 2.4h11.2A2.4 2.4 0 0 0 20 18V8.4',
    'M8 9.6h7M8 13h7M8 16.4h4.5',
  ],

  gear: [
    'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z',
    'M19.3 14.4a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9z',
  ],

  spyglass: [
    'M3.2 9.4l4.6-1.6 1.4 4.1-4.6 1.6a2.2 2.2 0 0 1-1.4-4.1z',
    'M7.8 7.8l6.8-2.4 1.9 5.5-6.8 2.4',
    'M14.6 5.4l4.6-1.6a2.4 2.4 0 0 1 1.6 4.6l-4.3 1.5',
    'M9.2 11.9l3.4 8.5',
    'M11 20.4h3.4',
  ],

  horn: [
    'M4 10.2h3.4L12 6.1v11.8l-4.6-4.1H4z',
    'M15.3 8.8a4.6 4.6 0 0 1 0 6.4',
    'M18 6.2a8.3 8.3 0 0 1 0 11.6',
  ],

  hatch: [
    'M13.6 3.4H5.6a1.8 1.8 0 0 0-1.8 1.8v13.6a1.8 1.8 0 0 0 1.8 1.8h8',
    'M15 16.4l4.6-4.4L15 7.6',
    'M9.4 12h10',
  ],

  target: [
    'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z',
    'M12 7.4a4.6 4.6 0 1 1 0 9.2 4.6 4.6 0 0 1 0-9.2z',
    'M12 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2z',
  ],

  flag: [
    'M5.4 21.2V2.8',
    'M5.4 4.2h13l-2.8 4.1 2.8 4.1h-13',
  ],

  close: ['M5.6 5.6l12.8 12.8', 'M18.4 5.6L5.6 18.4'],
  minus: ['M5 12h14'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M4.6 12.6l4.8 4.8L19.4 7.4'],
  chevronLeft: ['M15 4.8L7.8 12l7.2 7.2'],
  chevronRight: ['M9 4.8L16.2 12 9 19.2'],

  link: [
    'M10 13.4a4 4 0 0 0 6 .5l2.4-2.4a4 4 0 0 0-5.7-5.7l-1.4 1.4',
    'M14 10.6a4 4 0 0 0-6-.5L5.6 12.5a4 4 0 0 0 5.7 5.7l1.4-1.4',
  ],

  users: [
    'M8.6 11.4a3.4 3.4 0 1 1 0-6.8 3.4 3.4 0 0 1 0 6.8z',
    'M2.6 20c0-3.3 2.7-5.4 6-5.4s6 2.1 6 5.4',
    'M16 5.2a3.2 3.2 0 0 1 0 6.2',
    'M17 14.9c2.6.4 4.4 2.3 4.4 5.1',
  ],

  hourglass: [
    'M6.6 3.2h10.8',
    'M6.6 20.8h10.8',
    'M7.6 3.2v3.1c0 1.9 1.4 3.2 2.9 4.3 1 .7 1 1.1 0 1.8-1.5 1.1-2.9 2.4-2.9 4.3v3.1',
    'M16.4 3.2v3.1c0 1.9-1.4 3.2-2.9 4.3-1 .7-1 1.1 0 1.8 1.5 1.1 2.9 2.4 2.9 4.3v3.1',
  ],

  cannon: [
    'M3.4 14.6l13.2-5.2 1.6 4-13.2 5.2z',
    'M17.2 8.2l3.4-1.4 1.2 3-3.4 1.4',
    'M5.6 18.8a2 2 0 1 1-1.6-3.6',
  ],
};

const ALIASES = {
  settings: 'gear',
  guide: 'book',
  leave: 'hatch',
  sound: 'horn',
  graphics: 'spyglass',
  gameplay: 'cutlasses',
  controls: 'wheel',
  win: 'crown',
  lord: 'skull',
  reference: 'scroll',
  goal: 'target',
  turn: 'cutlasses',
  bonus: 'gem',
  timer: 'hourglass',
  copy: 'link',
  crew: 'users',
  play: 'cutlasses',
  host: 'flag',
};

export const ICON_NAMES = [...Object.keys(FILLED), ...Object.keys(STROKED)];

/**
 * The skull on its own 24x24 grid. Infamy is branded with it on the
 * cards, the Lord tiles, the player panels and the guide, and two of
 * those four draw their own SVG rather than calling icon().
 */
export const SKULL_PATH = FILLED.skull;

/**
 * Infamy's mark: a bone skull with a dark outline, on the 24x24 grid.
 * Built rather than drawn by icon() because it is two painted layers,
 * not one path inheriting a colour.
 */
export function skullMark({ size = '1em', className = '' } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', `icon skull-mark ${className}`.trim());
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');

  const body = document.createElementNS(NS, 'path');
  body.setAttribute('d', SKULL_SILHOUETTE);
  body.setAttribute('class', 'skull-mark__body');

  const face = document.createElementNS(NS, 'path');
  face.setAttribute('d', SKULL_FEATURES);
  face.setAttribute('class', 'skull-mark__face');
  face.setAttribute('fill-rule', 'evenodd');

  svg.append(body, face);
  return svg;
}

/** The same mark, painted into a 2D canvas and centred on (cx, cy). */
export function drawSkullMark(ctx, cx, cy, size) {
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(size / 24, size / 24);
  const body = new Path2D(SKULL_SILHOUETTE);
  ctx.lineJoin = 'round';
  ctx.lineWidth = SKULL_MARK_STROKE;
  ctx.strokeStyle = MARK_INK;
  ctx.stroke(body);
  ctx.fillStyle = MARK_BONE;
  ctx.fill(body);
  ctx.fillStyle = MARK_INK;
  ctx.fill(new Path2D(SKULL_FEATURES), 'evenodd');
  ctx.restore();
}

/**
 * Build an icon element.
 * `size` is a CSS length; the icon inherits the surrounding colour.
 */
export function icon(name, { size = '1.15em', title = null, strokeWidth = 1.7, className = '' } = {}) {
  const key = ALIASES[name] || name;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('focusable', 'false');
  if (title) {
    svg.setAttribute('role', 'img');
    const titleNode = document.createElementNS(NS, 'title');
    titleNode.textContent = title;
    svg.append(titleNode);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }

  if (FILLED[key]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', FILLED[key]);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    path.setAttribute('clip-rule', 'evenodd');
    svg.append(path);
    return svg;
  }

  const group = document.createElementNS(NS, 'g');
  group.setAttribute('fill', 'none');
  group.setAttribute('stroke', 'currentColor');
  group.setAttribute('stroke-width', String(strokeWidth));
  group.setAttribute('stroke-linecap', 'round');
  group.setAttribute('stroke-linejoin', 'round');
  for (const d of STROKED[key] || STROKED.close) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    group.append(path);
  }
  svg.append(group);
  return svg;
}

// ------------------------------------------------------------
// Seat emblems — four distinct marks, drawn the same way
// ------------------------------------------------------------

export const SEAT_EMBLEMS = ['skull', 'anchor', 'cutlasses', 'wheel'];

export function seatEmblem(index, options = {}) {
  return icon(SEAT_EMBLEMS[index % SEAT_EMBLEMS.length], options);
}

// ------------------------------------------------------------
// Canvas versions, for the 3D card and tile textures
// ------------------------------------------------------------

/**
 * Draw one of the seat emblems into a 2D canvas context, centred at
 * (cx, cy) and fitted to `size`. Used by the 3D texture painter.
 */
export function drawIconToCanvas(ctx, name, cx, cy, size, { fill = '#2b2118', strokeWidth = 1.7 } = {}) {
  const key = ALIASES[name] || name;
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(scale, scale);

  if (FILLED[key]) {
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(FILLED[key]), 'evenodd');
  } else {
    ctx.strokeStyle = fill;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const d of STROKED[key] || []) ctx.stroke(new Path2D(d));
  }
  ctx.restore();
}
