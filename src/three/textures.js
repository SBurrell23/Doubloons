// ============================================================
// Every texture in the game is painted here with Canvas2D.
// Nothing is loaded from disk.
// ============================================================

import * as THREE from 'three';
import { createNoise, rng } from './noise.js';
import { GEM_INFO, TIER_INFO, LORD_POINTS } from '../game/data.js';
import { drawSkullMark, MARK_BONE, MARK_INK, SKULL_MARK_FOOT } from '../ui/icons.js';
import { drawCardArt, ART_PALETTE } from './cardart/index.js';
import { LORD_ART } from './cardart/lords.js';

const noise = createNoise(20240714);
const cache = new Map();

function canvas(width, height) {
  const el = document.createElement('canvas');
  el.width = width;
  el.height = height;
  return { el, ctx: el.getContext('2d') };
}

function finish(el, { repeat = 1, srgb = true, aniso = 4 } = {}) {
  const texture = new THREE.CanvasTexture(el);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.anisotropy = aniso;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function memo(key, build) {
  if (!cache.has(key)) cache.set(key, build());
  return cache.get(key);
}

export function disposeTextures() {
  for (const value of cache.values()) {
    if (value?.dispose) value.dispose();
  }
  cache.clear();
}

/**
 * Drop everything with a gem painted into it, leaving the island's
 * sand and timber alone. Swapping the amethyst for a white stone has
 * to repaint ninety card faces and ten Lord tiles; it does not have to
 * repaint the beach.
 */
export function disposeGemArt() {
  for (const [key, value] of cache) {
    if (!/^(card|lord|face-url|back-url):/.test(key)) continue;
    if (value?.dispose) value.dispose();
    cache.delete(key);
  }
}

// ------------------------------------------------------------
// Surfaces
// ------------------------------------------------------------

/** Warm beach sand with grain and a few darker speckles. */
export function sandTexture(size = 512) {
  return memo(`sand${size}`, () => {
    const { el, ctx } = canvas(size, size);
    const image = ctx.createImageData(size, size);
    const data = image.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise.fbm(x / 26, y / 26, 0, 4) * 0.5 + 0.5;
        const grain = (Math.random() - 0.5) * 0.10;
        const v = Math.min(1, Math.max(0, n * 0.35 + 0.62 + grain));
        const i = (y * size + x) * 4;
        data[i] = 246 * v + 8;
        data[i + 1] = 226 * v + 10;
        data[i + 2] = 180 * v + 14;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    // Scattered shell fragments and pebbles.
    const rand = rng(7);
    for (let i = 0; i < 90; i++) {
      ctx.globalAlpha = 0.12 + rand() * 0.2;
      ctx.fillStyle = rand() > 0.5 ? '#fffaf0' : '#b79a68';
      ctx.beginPath();
      ctx.ellipse(rand() * size, rand() * size, 1 + rand() * 2.6, 1 + rand() * 1.8, rand() * 6.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return finish(el, { repeat: 1 });
  });
}

/** Bump map matching the sand, so the low sun rakes across it. */
export function sandBump(size = 256) {
  return memo(`sandBump${size}`, () => {
    const { el, ctx } = canvas(size, size);
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise.fbm(x / 14, y / 14, 5, 3) * 0.5 + 0.5;
        const v = Math.floor((n * 0.6 + Math.random() * 0.4) * 255);
        const i = (y * size + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return finish(el, { srgb: false });
  });
}

/** Planked wood. Used for the table top and the chest. */
export function woodTexture(opts = {}) {
  const { size = 512, planks = 6, base = '#8a5a2b', dark = '#5d3a19', light = '#a97240', vertical = false } = opts;
  const key = `wood${size}${planks}${base}${vertical}`;
  return memo(key, () => {
    const { el, ctx } = canvas(size, size);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    const rand = rng(31);
    const plankSize = size / planks;
    for (let p = 0; p < planks; p++) {
      const shade = 0.86 + rand() * 0.28;
      const x0 = vertical ? 0 : p * plankSize;
      const y0 = vertical ? p * plankSize : 0;
      const w = vertical ? size : plankSize;
      const h = vertical ? plankSize : size;

      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();

      ctx.globalAlpha = 1;
      ctx.fillStyle = base;
      ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = Math.min(0.5, Math.abs(shade - 1) * 2);
      ctx.fillStyle = shade > 1 ? light : dark;
      ctx.fillRect(x0, y0, w, h);
      ctx.globalAlpha = 1;

      // Grain lines running along the plank.
      const lines = 26;
      for (let g = 0; g < lines; g++) {
        const t = g / lines;
        ctx.strokeStyle = g % 3 === 0 ? dark : light;
        ctx.globalAlpha = 0.05 + rand() * 0.10;
        ctx.lineWidth = 0.6 + rand() * 1.8;
        ctx.beginPath();
        for (let s = 0; s <= size; s += 8) {
          const wobble = noise.fbm(s / 70, (p * 10 + t * 40) / 12, 2, 3) * plankSize * 0.16;
          const along = vertical ? s : s;
          const across = (vertical ? y0 : x0) + t * (vertical ? h : w) + wobble;
          if (vertical) {
            if (s === 0) ctx.moveTo(along, across); else ctx.lineTo(along, across);
          } else {
            if (s === 0) ctx.moveTo(across, along); else ctx.lineTo(across, along);
          }
        }
        ctx.stroke();
      }

      // A knot or two.
      if (rand() > 0.55) {
        const kx = x0 + rand() * w;
        const ky = y0 + rand() * h;
        const kr = 3 + rand() * 7;
        for (let r = kr * 2.4; r > 0; r -= 1.6) {
          ctx.globalAlpha = 0.10;
          ctx.strokeStyle = dark;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.ellipse(kx, ky, r, r * 0.62, 0.6, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Seam between planks.
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (vertical) { ctx.moveTo(0, y0); ctx.lineTo(size, y0); }
      else { ctx.moveTo(x0, 0); ctx.lineTo(x0, size); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return finish(el);
  });
}

/** Rough grey-brown rock. */
export function rockTexture(size = 256) {
  return memo(`rock${size}`, () => {
    const { el, ctx } = canvas(size, size);
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = noise.fbm(x / 18, y / 18, 11, 5) * 0.5 + 0.5;
        const m = noise.fbm(x / 5, y / 5, 3, 2) * 0.12;
        const v = Math.min(1, Math.max(0, n * 0.7 + 0.28 + m));
        const i = (y * size + x) * 4;
        image.data[i] = 128 * v + 26;
        image.data[i + 1] = 124 * v + 26;
        image.data[i + 2] = 116 * v + 24;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return finish(el);
  });
}

/** Palm bark: stacked fibrous rings. */
export function barkTexture(size = 256) {
  return memo(`bark${size}`, () => {
    const { el, ctx } = canvas(size, size);
    ctx.fillStyle = '#7d5a35';
    ctx.fillRect(0, 0, size, size);
    const rand = rng(91);
    for (let y = 0; y < size; y += 15) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#5f4226';
      ctx.fillRect(0, y, size, 3);
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#9b7546';
      ctx.fillRect(0, y + 4, size, 5);
      for (let i = 0; i < 10; i++) {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = rand() > 0.5 ? '#4b3320' : '#ad8654';
        ctx.fillRect(rand() * size, y + rand() * 12, 6 + rand() * 20, 2);
      }
    }
    ctx.globalAlpha = 1;
    return finish(el, { repeat: 1 });
  });
}

/** Caustic-ish detail for the shallows around the island. */
export function waterDetail(size = 256) {
  return memo(`water${size}`, () => {
    const { el, ctx } = canvas(size, size);
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = Math.abs(noise.fbm(x / 30, y / 30, 1, 3));
        const v = Math.pow(1 - Math.min(1, n * 2.2), 3);
        const i = (y * size + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.floor(v * 255);
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    return finish(el, { srgb: false });
  });
}

// ------------------------------------------------------------
// Gem drawing — shared by cards, tiles and UI
// ------------------------------------------------------------

/** Draw a faceted gem centred at (cx, cy) with the given radius. */
export function drawGem(ctx, cx, cy, r, gem, { outline = true } = {}) {
  const info = GEM_INFO[gem];
  const top = -r * 0.55;
  const shoulder = -r * 0.16;
  const points = [
    [0, -r], [r * 0.72, shoulder], [r * 0.46, r * 0.86],
    [-r * 0.46, r * 0.86], [-r * 0.72, shoulder],
  ];

  ctx.save();
  ctx.translate(cx, cy);

  const grad = ctx.createLinearGradient(0, -r, 0, r);
  grad.addColorStop(0, shade(info.ui, 1.35));
  grad.addColorStop(0.5, info.ui);
  grad.addColorStop(1, info.dark);

  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Crown facets.
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, shoulder);
  ctx.lineTo(0, top);
  ctx.lineTo(r * 0.72, shoulder);
  ctx.closePath();
  ctx.fillStyle = shade(info.ui, 1.5);
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // Table facet highlight.
  ctx.beginPath();
  ctx.moveTo(-r * 0.30, shoulder * 0.5);
  ctx.lineTo(0, top * 0.72);
  ctx.lineTo(r * 0.30, shoulder * 0.5);
  ctx.lineTo(0, r * 0.12);
  ctx.closePath();
  ctx.fillStyle = shade(info.ui, 1.85);
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;

  if (outline) {
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(30,18,6,0.75)';
    ctx.lineWidth = Math.max(1.5, r * 0.09);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * A gem with its count struck across the face. Splendor prints the
 * number on the stone, and reading it beside the stone costs a beat.
 */
export function drawGemWithCount(ctx, cx, cy, r, gem, amount) {
  drawGem(ctx, cx, cy, r, gem);
  ctx.save();

  // A dark lozenge behind the digit so it reads against any facet.
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = '#0c0703';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.1, r * 0.62, r * 0.52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#fff6df';
  ctx.strokeStyle = 'rgba(8,5,2,0.95)';
  ctx.lineWidth = Math.max(3, r * 0.17);
  ctx.font = `700 ${Math.round(r * 1.18)}px Cinzel, Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(String(amount), cx, cy + r * 0.12);
  ctx.fillText(String(amount), cx, cy + r * 0.12);
  ctx.restore();
}

/*
 * The two marks the whole game is read through.
 *
 * A bonus is a gem sunk in a dark disc with a brass ring; Infamy is a
 * bone skull with a dark outline, and how many. They started life on
 * the card face and nowhere else, which left the Lord tiles and the
 * player panels describing the same two things in three different
 * visual languages. They live here now, and everything that shows a
 * bonus or a score draws them from here -- see .bonus-disc and
 * .infamy-mark in the CSS for the DOM's half of the same pair.
 */
export const SEAL_FILL = 'rgba(18,11,5,0.78)';
export const SEAL_RING = '#dcb968';

function seal(ctx, cx, cy, r, ringWidth) {
  ctx.save();
  ctx.fillStyle = SEAL_FILL;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = SEAL_RING;
  ctx.lineWidth = ringWidth;
  ctx.stroke();
  ctx.restore();
}

/** A bonus: the stone itself, sunk in the seal. */
export function drawBonusDisc(ctx, cx, cy, r, gem, amount = null) {
  seal(ctx, cx, cy, r, Math.max(3, r * 0.08));
  const gemR = r * 0.72;
  if (amount === null) drawGem(ctx, cx, cy + r * 0.04, gemR, gem);
  else drawGemWithCount(ctx, cx, cy + r * 0.04, gemR, gem, amount);
}

/**
 * Infamy: one bone skull with a dark outline, and how many of them it
 * is worth. Drawn at the same size as the bonus disc on the other side
 * of the card, because the two are the things you compare cards by and
 * neither should be the smaller print.
 *
 * A bone skull outlined in dark reads on a red band, a blue band and a
 * Lord's portrait alike, which is why it is painted rather than tinted.
 *
 * `left` is the skull's left edge; `cy` is the middle of the mark.
 */
export function drawInfamyMark(ctx, left, cy, count, { size = 100 } = {}) {
  drawSkullMark(ctx, left + size / 2, cy, size);

  // One skull is one Infamy; it does not need telling twice.
  if (count <= 1) return size;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.1);
  ctx.strokeStyle = MARK_INK;
  ctx.fillStyle = MARK_BONE;

  // The count stands on the jaw rather than floating beside the eyes,
  // and the times sign is drawn separately: set as one string the x
  // sits right up against the digit.
  const baseline = cy - size / 2 + size * SKULL_MARK_FOOT;
  let x = left + size * 0.86;
  const stamp = (text, fontSize) => {
    ctx.font = `700 ${Math.round(fontSize)}px Cinzel, Georgia, serif`;
    ctx.strokeText(text, x, baseline);
    ctx.fillText(text, x, baseline);
    x += ctx.measureText(text).width;
  };
  stamp('\u00d7', size * 0.44);
  x += size * 0.06;
  stamp(String(count), size * 0.62);

  ctx.restore();
  return x - left;
}

/** Gold coin face, for doubloons. */
export function drawDoubloon(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  grad.addColorStop(0, '#ffe9a8');
  grad.addColorStop(0.55, '#f0c34c');
  grad.addColorStop(1, '#9a6d18');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#6b4a10';
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(107,74,16,0.55)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();

  // A compass rose, struck in the middle. It used to be a skull, which
  // is now what Infamy is counted in -- a coin wearing one read like a
  // point rather than a currency.
  compassRose(ctx, 0, 0, r * 0.52, 'rgba(96,66,14,0.8)', '#f2d27e');
  ctx.restore();
}

/**
 * An eight-point rose. Long points north, south, east and west, short
 * ones between, each split down the middle so the two halves catch the
 * light differently -- which is what makes a flat drawing look struck.
 */
function compassRose(ctx, cx, cy, r, dark, light) {
  const point = (angle, length, width) => {
    const tip = [cx + Math.cos(angle) * length, cy + Math.sin(angle) * length];
    const l = [cx + Math.cos(angle + Math.PI / 2) * width, cy + Math.sin(angle + Math.PI / 2) * width];
    const rt = [cx + Math.cos(angle - Math.PI / 2) * width, cy + Math.sin(angle - Math.PI / 2) * width];
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(...tip); ctx.lineTo(...l); ctx.lineTo(cx, cy); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(...tip); ctx.lineTo(...rt); ctx.lineTo(cx, cy); ctx.closePath();
    ctx.fill();
  };

  for (let i = 0; i < 4; i++) point(i * Math.PI / 2, r, r * 0.17);
  for (let i = 0; i < 4; i++) point(Math.PI / 4 + i * Math.PI / 2, r * 0.6, r * 0.12);

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

// ------------------------------------------------------------
// Parchment backdrop shared by cards and tiles
// ------------------------------------------------------------

function parchment(ctx, w, h, seed = 3) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#f6e6c4');
  grad.addColorStop(0.5, '#efd9ad');
  grad.addColorStop(1, '#e2c795');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const rand = rng(seed);
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.03 + rand() * 0.05;
    ctx.fillStyle = rand() > 0.5 ? '#8a6a3a' : '#fff6e0';
    const r = 2 + rand() * 18;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Aged edges.
  ctx.globalAlpha = 1;
  const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.72);
  edge.addColorStop(0, 'rgba(120,84,40,0)');
  edge.addColorStop(1, 'rgba(96,62,26,0.42)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const CARD_W = 420;
export const CARD_H = 588;

const TIER_ACCENT = { 1: '#6b8f3a', 2: '#2f6f96', 3: '#8d3a6b' };

/**
 * A development card face. `card` is a card object from data.js.
 */
/** Where a card's illustration lives on its face. */
export const ART_PANEL = { x: 32, y: 194, w: 356, h: 198 };

/** Where a Pirate Lord's portrait lives on their tile. */
export const LORD_W = 420;
export const LORD_H = 540;
export const LORD_ART_PANEL = { x: 44, y: 116, w: 332, h: 206 };

export function cardFaceCanvas(card) {
  const { el, ctx } = canvas(CARD_W, CARD_H);
  const info = GEM_INFO[card.bonus];
  parchment(ctx, CARD_W, CARD_H, card.id.length + card.points * 7);

  // --- border: a dark rule with a thin brass inner line ---
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 12;
  roundRect(ctx, 6, 6, CARD_W - 12, CARD_H - 12, 14);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(176,141,69,0.75)';
  ctx.lineWidth = 3;
  roundRect(ctx, 20, 20, CARD_W - 40, CARD_H - 40, 8);
  ctx.stroke();

  // --- header band in the bonus colour ---
  const band = 126;
  ctx.save();
  roundRect(ctx, 12, 12, CARD_W - 24, band, 10);
  ctx.clip();
  const bandGrad = ctx.createLinearGradient(0, 12, 0, 12 + band);
  bandGrad.addColorStop(0, shade(info.ui, 1.2));
  bandGrad.addColorStop(1, info.dark);
  ctx.fillStyle = bandGrad;
  ctx.fillRect(12, 12, CARD_W - 24, band);
  ctx.restore();
  ctx.strokeStyle = '#241a10';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(12, 12 + band);
  ctx.lineTo(CARD_W - 12, 12 + band);
  ctx.stroke();

  // --- infamy, top-left, the same size as the bonus opposite it ---
  if (card.points > 0) {
    drawInfamyMark(ctx, 30, 12 + band / 2, card.points, { size: 100 });
  }

  // --- bonus gem, top-right, sunk in the same seal so it separates
  // from the band behind it (which is the same colour) ---
  drawBonusDisc(ctx, CARD_W - 86, 12 + band / 2, 50, card.bonus);

  // --- name ---
  // Sized to the space rather than guessed from the character count: a
  // long name used to wrap, and a wrapped name's first line climbed up
  // into the header band.
  ctx.fillStyle = '#241a10';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = fitFont(ctx, card.name, CARD_W - 60, [33, 30, 27, 24, 21], (px) =>
    `600 ${px}px Cinzel, Georgia, serif`);
  wrapText(ctx, card.name, CARD_W / 2, 166, CARD_W - 60, fontSize + 5);

  // --- illustration ---
  const { x: ax, y: ay, w: aw, h: ah } = ART_PANEL;
  ctx.save();
  ctx.translate(ax, ay);
  drawCardArt(ctx, card, aw, ah, info.ui);
  ctx.restore();

  // A hairline frame around the art, open at the top so it reads as
  // part of the card rather than a pasted-in picture.
  ctx.strokeStyle = 'rgba(74,58,40,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ax, ay + ah);
  ctx.lineTo(ax + aw, ay + ah);
  ctx.stroke();

  // --- cost: a horizontal strip along the foot ---
  // Laid across rather than stacked up the side, so a four-colour cost
  // can never climb into the name or the header.
  const costs = Object.entries(card.cost).filter(([, n]) => n > 0);
  const stripY = CARD_H - 154;
  const stripH = 122;

  ctx.fillStyle = 'rgba(18,11,5,0.6)';
  roundRect(ctx, 30, stripY, CARD_W - 60, stripH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(176,141,69,0.7)';
  ctx.lineWidth = 3;
  roundRect(ctx, 30, stripY, CARD_W - 60, stripH, 10);
  ctx.stroke();

  const cellW = (CARD_W - 60) / costs.length;
  const pipR = Math.min(52, cellW * 0.42);
  costs.forEach(([gem, amount], i) => {
    const cx = 30 + cellW * (i + 0.5);
    drawGemWithCount(ctx, cx, stripY + stripH / 2, pipR, gem, amount);

    // A divider between cells.
    if (i > 0) {
      ctx.strokeStyle = 'rgba(176,141,69,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30 + cellW * i, stripY + 14);
      ctx.lineTo(30 + cellW * i, stripY + stripH - 14);
      ctx.stroke();
    }
  });

  return el;
}

export function cardFaceTexture(card) {
  return memo(`card:${card.id}`, () => finish(cardFaceCanvas(card), { aniso: 8 }));
}

/** The back of a deck — one per tier. */
export function cardBackCanvas(tier) {
  const { el, ctx } = canvas(CARD_W, CARD_H);
  const accent = TIER_ACCENT[tier];
  const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
  grad.addColorStop(0, '#26507a');
  grad.addColorStop(1, '#14304c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Rope border
  ctx.strokeStyle = '#d9b978';
  ctx.lineWidth = 8;
  roundRect(ctx, 20, 20, CARD_W - 40, CARD_H - 40, 22);
  ctx.stroke();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(217,185,120,0.55)';
  roundRect(ctx, 34, 34, CARD_W - 68, CARD_H - 68, 16);
  ctx.stroke();
  ctx.setLineDash([]);

  // Ship's wheel motif.
  const cx = CARD_W / 2;
  const cy = CARD_H / 2 - 20;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 96, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
    ctx.lineTo(cx + Math.cos(a) * 126, cy + Math.sin(a) * 126);
    ctx.lineWidth = 10;
    ctx.stroke();
  }
  ctx.fillStyle = '#d9b978';
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();

  // Tier numeral.
  ctx.fillStyle = '#f3dfae';
  ctx.font = '600 44px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TIER_INFO[tier].sub, cx, CARD_H - 74);

  return el;
}

/**
 * The card face as an image the DOM can show. Your hold used to draw
 * its own small approximation of a card; it shows the real one now,
 * just smaller, so what is in your hand looks like what is on the
 * table.
 */
export function cardFaceImageUrl(card) {
  return memo(`face-url:${card.id}`, () => cardFaceCanvas(card).toDataURL());
}

export function cardBackImageUrl(tier) {
  return memo(`back-url:${tier}`, () => cardBackCanvas(tier).toDataURL());
}

export function cardBackTexture(tier) {
  return memo(`back:${tier}`, () => finish(cardBackCanvas(tier), { aniso: 8 }));
}

/** A Pirate Lord tile. */
export function lordCanvas(lord) {
  const size = LORD_W;
  const { el, ctx } = canvas(LORD_W, LORD_H);
  parchment(ctx, LORD_W, LORD_H, lord.id.length * 5);

  ctx.strokeStyle = '#6b4a10';
  ctx.lineWidth = 12;
  roundRect(ctx, 8, 8, LORD_W - 16, LORD_H - 16, 24);
  ctx.stroke();
  ctx.strokeStyle = '#d9b978';
  ctx.lineWidth = 4;
  roundRect(ctx, 22, 22, LORD_W - 44, LORD_H - 44, 18);
  ctx.stroke();

  // Portrait. Falls back to a tricorn silhouette if this Lord has no
  // drawing yet.
  const { x: px, y: py, w: pw, h: ph } = LORD_ART_PANEL;
  ctx.save();
  ctx.translate(px, py);
  ctx.beginPath();
  ctx.rect(0, 0, pw, ph);
  ctx.clip();
  const portrait = LORD_ART[lord.name];
  let drew = false;
  if (typeof portrait === 'function') {
    try {
      portrait(ctx, pw, ph, { ...ART_PALETTE, accent: '#9c2b2b' });
      drew = true;
    } catch (error) {
      console.warn(`[lordart] ${lord.name} failed to draw`, error);
    }
  }
  if (!drew) drawCaptainSilhouette(ctx, pw / 2, ph * 0.62, ph * 0.36);
  ctx.restore();

  // A hairline under the portrait, so it sits in the tile.
  ctx.strokeStyle = 'rgba(107,74,16,0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py + ph);
  ctx.lineTo(px + pw, py + ph);
  ctx.stroke();

  // What it is worth, in its own band above the portrait: three skulls,
  // centred, because a Lord is always worth three and a row of them is
  // read without reading anything. It used to be stamped across the
  // picture, which is fine for a warrant and less fine for the one
  // drawing on the tile.
  {
    const pip = 62;
    const step = pip * 1.04;
    const startX = size / 2 - ((LORD_POINTS - 1) * step) / 2;
    for (let i = 0; i < LORD_POINTS; i++) drawSkullMark(ctx, startX + i * step, 68, pip);
  }
  ctx.strokeStyle = 'rgba(107,74,16,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 108);
  ctx.lineTo(px + pw, 108);
  ctx.stroke();

  // Name. Alignment is set here rather than inherited from whatever
  // drew last -- that is how the name ended up running off the edge.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#3a2410';
  const nameSize = fitFont(ctx, lord.name, size - 80, [27, 24, 21], (px) =>
    `600 ${px}px Cinzel, Georgia, serif`);
  wrapText(ctx, lord.name, size / 2, 356, size - 80, nameSize + 5);
  ctx.fillStyle = '#6b4a10';
  ctx.font = 'italic 21px Spectral, Georgia, serif';
  ctx.fillText(lord.title, size / 2, 390);

  // Requirements -- bonuses, so they wear the bonus seal. Clear of the
  // title above them and clear of the border below, which the tile was
  // made taller to afford.
  const reqs = Object.entries(lord.req);
  const gap = 104;
  const startX = size / 2 - ((reqs.length - 1) * gap) / 2;
  reqs.forEach(([gem, n], i) => {
    drawBonusDisc(ctx, startX + i * gap, 460, 44, gem, n);
  });

  return el;
}

export function lordTexture(lord) {
  return memo(`lord:${lord.id}`, () => finish(lordCanvas(lord), { aniso: 8 }));
}

function drawCaptainSilhouette(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#2f2419';

  // Shoulders
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.75, r * 0.15, 0, r * 0.15);
  ctx.quadraticCurveTo(r * 0.75, r * 0.15, r * 1.05, r * 0.95);
  ctx.closePath();
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(0, -r * 0.18, r * 0.44, 0, Math.PI * 2);
  ctx.fill();

  // Tricorn hat
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.44);
  ctx.quadraticCurveTo(-r * 0.30, -r * 1.18, 0, -r * 1.12);
  ctx.quadraticCurveTo(r * 0.30, -r * 1.18, r * 0.95, -r * 0.44);
  ctx.quadraticCurveTo(0, -r * 0.14, -r * 0.95, -r * 0.44);
  ctx.closePath();
  ctx.fill();

  // Skull badge on the hat
  ctx.fillStyle = '#e8d6a8';
  ctx.beginPath();
  ctx.arc(0, -r * 0.62, r * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The largest of `sizes` that fits `text` on one line. Falls back to
 * the smallest, which wrapText then breaks if it still has to.
 */
function fitFont(ctx, text, maxWidth, sizes, font) {
  for (const px of sizes) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) return px;
  }
  return sizes[sizes.length - 1];
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const offset = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, x, y + offset + i * lineHeight));
  return lines.length;
}

export { wrapText, roundRect, shade };

// ------------------------------------------------------------
// Doubloon faces
// ------------------------------------------------------------

/** Draw the struck design: a skull ringed by a beaded border. */
function paintCoin(ctx, size, colours) {
  const c = size / 2;
  const r = size * 0.5;

  ctx.fillStyle = colours.field;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();

  // Raised rim and the beading just inside it.
  ctx.strokeStyle = colours.high;
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.94, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colours.low;
  ctx.lineWidth = size * 0.02;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? colours.high : colours.low;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * r * 0.88, c + Math.sin(a) * r * 0.88, size * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }

  // A compass rose in relief, where the skull and crossbones used to
  // be. Infamy is counted in skulls now, and a coin that wore one read
  // like a score rather than a currency.
  compassRose(ctx, c, c, size * 0.3, colours.deep, colours.high);
}

/** The gold colour map for a doubloon. */
export function coinFaceTexture(size = 256) {
  return memo(`coinFace${size}`, () => {
    const { el, ctx } = canvas(size, size);
    ctx.clearRect(0, 0, size, size);
    const grad = ctx.createRadialGradient(size * 0.36, size * 0.32, size * 0.05, size / 2, size / 2, size * 0.55);
    grad.addColorStop(0, '#f8d97f');
    grad.addColorStop(0.5, '#cd9a2c');
    grad.addColorStop(1, '#7e5410');
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, '#f6d987');
    g.addColorStop(1, '#b07f22');
    paintCoin(ctx, size, { field: grad, high: '#f2cf6b', low: '#8a6118', deep: '#563a08' });
    return finish(el, { aniso: 8 });
  });
}

/** Height map for the same design, so the relief catches the light. */
export function coinReliefTexture(size = 256) {
  return memo(`coinRelief${size}`, () => {
    const { el, ctx } = canvas(size, size);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    paintCoin(ctx, size, { field: '#6e6e6e', high: '#ffffff', low: '#3a3a3a', deep: '#000000' });
    return finish(el, { srgb: false });
  });
}
