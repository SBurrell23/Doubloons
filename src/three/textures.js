// ============================================================
// Every texture in the game is painted here with Canvas2D.
// Nothing is loaded from disk.
// ============================================================

import * as THREE from 'three';
import { createNoise, rng } from './noise.js';
import { GEM_INFO, TIER_INFO } from '../game/data.js';

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

  // A crude skull stamped in the middle.
  ctx.fillStyle = 'rgba(96,66,14,0.8)';
  ctx.beginPath();
  ctx.arc(0, -r * 0.08, r * 0.30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 0.20, r * 0.12, r * 0.40, r * 0.20);
  ctx.fillStyle = '#f2d27e';
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.10, r * 0.085, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.10, r * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
export function cardFaceCanvas(card) {
  const { el, ctx } = canvas(CARD_W, CARD_H);
  const info = GEM_INFO[card.bonus];
  parchment(ctx, CARD_W, CARD_H, card.id.length + card.points * 7);

  // --- watermark: an engraved compass rose, well behind everything ---
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.strokeStyle = '#4a3016';
  ctx.lineWidth = 4;
  const wx = CARD_W / 2;
  const wy = 400;
  ctx.beginPath();
  ctx.arc(wx, wy, 108, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(wx, wy, 76, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const long = i % 2 === 0 ? 132 : 92;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(a) * long, wy + Math.sin(a) * long);
    ctx.stroke();
  }
  ctx.restore();

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

  // --- infamy, top-left, on a dark seal so it reads at any distance ---
  if (card.points > 0) {
    const px = 78;
    const py = 12 + band / 2;
    ctx.fillStyle = 'rgba(18,11,5,0.75)';
    ctx.beginPath();
    ctx.arc(px, py, 47, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dcb968';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#ffeec2';
    ctx.font = '700 62px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(card.points), px, py + 3);
  }

  // --- bonus gem, top-right, on a dark disc so it separates from
  // the band behind it (which is the same colour) ---
  {
    const gx = CARD_W - 86;
    const gy = 12 + band / 2;
    ctx.fillStyle = 'rgba(18,11,5,0.7)';
    ctx.beginPath();
    ctx.arc(gx, gy, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#dcb968';
    ctx.lineWidth = 4;
    ctx.stroke();
    drawGem(ctx, gx, gy + 2, 36, card.bonus);
  }

  // --- name ---
  ctx.fillStyle = '#241a10';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontSize = card.name.length > 17 ? 30 : 35;
  ctx.font = `600 ${fontSize}px Cinzel, Georgia, serif`;
  wrapText(ctx, card.name, CARD_W / 2, 198, CARD_W - 64, fontSize + 8);

  // --- tier mark ---
  ctx.strokeStyle = TIER_ACCENT[card.tier];
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - 72, 254);
  ctx.lineTo(CARD_W / 2 - 30, 254);
  ctx.moveTo(CARD_W / 2 + 30, 254);
  ctx.lineTo(CARD_W / 2 + 72, 254);
  ctx.stroke();
  ctx.fillStyle = TIER_ACCENT[card.tier];
  for (let i = 0; i < card.tier; i++) {
    ctx.save();
    ctx.translate(CARD_W / 2 - (card.tier - 1) * 13 + i * 26, 254);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  // --- cost: a dark plaque down the left edge ---
  const costs = Object.entries(card.cost).filter(([, n]) => n > 0);
  const pipR = 33;
  const step = pipR * 2 + 12;
  const plaqueH = costs.length * step + 12;
  const plaqueY = CARD_H - 32 - plaqueH;
  const cx = 78;

  ctx.fillStyle = 'rgba(18,11,5,0.6)';
  roundRect(ctx, 32, plaqueY, 156, plaqueH, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(176,141,69,0.7)';
  ctx.lineWidth = 3;
  roundRect(ctx, 32, plaqueY, 156, plaqueH, 10);
  ctx.stroke();

  costs.forEach(([gem, amount], i) => {
    const cy = plaqueY + 12 + pipR + i * step;
    drawGem(ctx, cx, cy, pipR, gem);
    // The count sits beside the gem so it never fights the facets.
    ctx.fillStyle = '#fff3d6';
    ctx.strokeStyle = 'rgba(10,6,2,0.95)';
    ctx.lineWidth = 7;
    ctx.font = '700 46px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(amount), cx + pipR + 28, cy + 2);
    ctx.fillText(String(amount), cx + pipR + 28, cy + 2);
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

export function cardBackTexture(tier) {
  return memo(`back:${tier}`, () => finish(cardBackCanvas(tier), { aniso: 8 }));
}

/** A Pirate Lord tile. */
export function lordCanvas(lord) {
  const size = 420;
  const { el, ctx } = canvas(size, size);
  parchment(ctx, size, size, lord.id.length * 5);

  ctx.strokeStyle = '#6b4a10';
  ctx.lineWidth = 12;
  roundRect(ctx, 8, 8, size - 16, size - 16, 24);
  ctx.stroke();
  ctx.strokeStyle = '#d9b978';
  ctx.lineWidth = 4;
  roundRect(ctx, 22, 22, size - 44, size - 44, 18);
  ctx.stroke();

  // Three infamy, top-left in a wax seal.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#9c2b2b';
  ctx.beginPath();
  ctx.arc(74, 74, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffe9c0';
  ctx.font = '700 46px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('3', 74, 78);

  // Portrait: a simple silhouette in a tricorn.
  drawCaptainSilhouette(ctx, size / 2, 176, 74);

  // Name.
  ctx.fillStyle = '#3a2410';
  ctx.font = '600 27px Cinzel, Georgia, serif';
  wrapText(ctx, lord.name, size / 2, 256, size - 70, 34);
  ctx.fillStyle = '#6b4a10';
  ctx.font = 'italic 21px Spectral, Georgia, serif';
  ctx.fillText(lord.title, size / 2, 300);

  // Requirements.
  const reqs = Object.entries(lord.req);
  const gap = 96;
  const startX = size / 2 - ((reqs.length - 1) * gap) / 2;
  reqs.forEach(([gem, n], i) => {
    const x = startX + i * gap;
    drawGem(ctx, x, 360, 28, gem);
    ctx.fillStyle = '#3a2410';
    ctx.strokeStyle = 'rgba(255,246,224,0.9)';
    ctx.lineWidth = 5;
    ctx.font = '700 32px Cinzel, Georgia, serif';
    ctx.strokeText(String(n), x, 402);
    ctx.fillText(String(n), x, 402);
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
