// ============================================================
// Card illustrations.
//
// Every card carries a small drawn scene, painted with Canvas2D
// into the art panel of its face. One function per card, keyed
// by card name, split across the three tiers.
//
// Each function is called with the context already translated so
// that (0, 0) is the panel's top-left corner, and clipped to the
// panel, so a drawing can never escape its frame.
// ============================================================

import { TIER1_ART } from './tier1.js';
import { TIER2_ART } from './tier2.js';
import { TIER3_ART } from './tier3.js';

const ART = { ...TIER1_ART, ...TIER2_ART, ...TIER3_ART };

/**
 * Ink colours shared by every illustration, so the whole deck reads as
 * one hand. Drawings may use the bonus colour for a single accent.
 */
export const ART_PALETTE = {
  ink: '#2b2118',
  inkSoft: '#6b5946',
  line: '#4a3a28',
  paper: '#e7d8b6',
  paperDark: '#cdb888',
  sea: '#2f6f8f',
  seaDeep: '#1b4560',
  sky: '#bcd9e8',
  sail: '#f2e7cd',
  wood: '#7a5433',
  woodDark: '#4a3120',
  metal: '#8d8d96',
  metalDark: '#55555e',
  gold: '#c8a03f',
  flame: '#d4622c',
  leaf: '#4e7f3a',
};

/**
 * Paint a card's illustration. Returns true if the card had one.
 * `w` and `h` are the panel's size in pixels.
 */
export function drawCardArt(ctx, card, w, h, accent) {
  const draw = ART[card.name];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  let drawn = false;
  if (typeof draw === 'function') {
    try {
      draw(ctx, w, h, { ...ART_PALETTE, accent });
      drawn = true;
    } catch (error) {
      // A broken drawing must never take the card down with it.
      console.warn(`[cardart] ${card.name} failed to draw`, error);
    }
  }
  if (!drawn) drawFallback(ctx, w, h, accent);

  ctx.restore();
  return drawn;
}

/** A compass rose, for any card whose drawing is missing. */
function drawFallback(ctx, w, h, accent) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.34;
  ctx.strokeStyle = ART_PALETTE.line;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = accent || ART_PALETTE.line;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a + 0.35) * r * 0.24, cy + Math.sin(a + 0.35) * r * 0.24);
    ctx.lineTo(cx + Math.cos(a - 0.35) * r * 0.24, cy + Math.sin(a - 0.35) * r * 0.24);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function hasArt(name) {
  return typeof ART[name] === 'function';
}

export function artCount() {
  return Object.keys(ART).length;
}
