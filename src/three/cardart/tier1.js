// ============================================================
// Tier I card art — "Deckhands & Cargo".
//
// Forty small engravings: the humble end of the deck, where the
// subjects are people, tools and cargo rather than ships and
// legends. Everything is drawn in the same hand — heavy outlines,
// flat fills, a little hatching for shadow — so that the tier
// reads as one plate of chart marginalia.
//
// Each function receives a context already translated to the art
// panel's top-left corner and clipped to it, the panel size, and
// the shared palette with `accent` set to the card's gem colour.
// ============================================================

// ------------------------------------------------------------
// Shared marks
// ------------------------------------------------------------

/** Fill the current path (optionally) and then outline it in ink. */
function ink(ctx, p, fill, lw = 3, stroke) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke || p.line;
  ctx.stroke();
}

/** Diagonal engraver's hatch across a rectangle. Clip first to contain it. */
function hatch(ctx, p, x, y, bw, bh, step = 8, alpha = 0.28, color) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color || p.inkSoft;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = -bh; i < bw; i += step) {
    ctx.moveTo(x + i, y + bh);
    ctx.lineTo(x + i + bh, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** A rounded bar between two points — hafts, barrels, limbs, hooks. */
function capsule(ctx, x0, y0, x1, y1, r) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.beginPath();
  ctx.arc(x0, y0, r, a + Math.PI / 2, a - Math.PI / 2);
  ctx.arc(x1, y1, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}

/** An undulating line — horizons, water, slack rope. Leaves the path open. */
function wave(ctx, y, x0, x1, amp, segs = 6) {
  const s = (x1 - x0) / segs;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  for (let i = 0; i < segs; i++) {
    const x = x0 + i * s;
    ctx.quadraticCurveTo(x + s * 0.5, y + (i % 2 ? amp : -amp), x + s, y);
  }
}

/** A small filled disc — pips, floats, beads, rivets. */
function dot(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

// ------------------------------------------------------------
// The plate
// ------------------------------------------------------------

export const TIER1_ART = {
  // ---------------- pearl ----------------

  'Sailmender': (ctx, w, h, p) => {
    // A bolt of canvas, torn and being drawn together again.
    ctx.beginPath();
    ctx.moveTo(w * 0.03, h * 0.42);
    ctx.lineTo(w * 0.47, h * 0.34);
    ctx.lineTo(w * 0.53, h * 0.99);
    ctx.lineTo(w * 0.07, h * 1.0);
    ctx.closePath();
    ink(ctx, p, p.sail, 3.2);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.03, h * 0.42);
    ctx.lineTo(w * 0.47, h * 0.34);
    ctx.lineTo(w * 0.53, h * 0.99);
    ctx.lineTo(w * 0.07, h * 1.0);
    ctx.closePath();
    ctx.clip();
    hatch(ctx, p, w * 0.02, h * 0.5, w * 0.55, h * 0.55, 12, 0.16);
    ctx.restore();
    // The tear, running down the cloth.
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 0.37);
    ctx.lineTo(w * 0.21, h * 0.54);
    ctx.lineTo(w * 0.3, h * 0.7);
    ctx.lineTo(w * 0.24, h * 0.85);
    ctx.lineTo(w * 0.29, h * 1.0);
    ink(ctx, p, null, 2.6);
    // Stitches closing it.
    for (let i = 0; i < 5; i++) {
      const y = h * (0.44 + i * 0.13);
      const x = w * (0.25 + Math.sin(i * 1.7) * 0.025);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.06, y - h * 0.035);
      ctx.lineTo(x + w * 0.06, y + h * 0.035);
      ink(ctx, p, null, 2.4, p.inkSoft);
    }
    // Thread leading up to the eye.
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.44);
    ctx.bezierCurveTo(w * 0.52, h * 0.44, w * 0.7, h * 0.36, w * 0.88, h * 0.22);
    ink(ctx, p, null, 2.2, p.inkSoft);
    dot(ctx, w * 0.62, h * 0.4, Math.min(w, h) * 0.032, p.accent);
    // The sailmaker's needle: a tapered spike of steel.
    ctx.beginPath();
    ctx.moveTo(w * 0.41, h * 0.66);
    ctx.lineTo(w * 0.87, h * 0.1);
    ctx.lineTo(w * 0.95, h * 0.22);
    ctx.closePath();
    ink(ctx, p, p.metal, 3);
    ctx.beginPath();
    ctx.ellipse(w * 0.895, h * 0.185, w * 0.018, h * 0.026, 0.72, 0, Math.PI * 2);
    ink(ctx, p, p.paper, 2.2);
  },

  'Bosun': (ctx, w, h, p) => {
    const cx = w * 0.42;
    hatch(ctx, p, w * 0.58, 0, w * 0.5, h, 10, 0.16);

    // Shoulders.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.29, h * 1.02);
    ctx.quadraticCurveTo(cx - w * 0.21, h * 0.62, cx - w * 0.09, h * 0.55);
    ctx.lineTo(cx + w * 0.09, h * 0.55);
    ctx.quadraticCurveTo(cx + w * 0.22, h * 0.63, cx + w * 0.3, h * 1.02);
    ctx.closePath();
    ink(ctx, p, p.ink, 3.2);

    // Head and knitted cap.
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.35, w * 0.085, h * 0.17, 0, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.095, h * 0.28);
    ctx.quadraticCurveTo(cx, h * 0.04, cx + w * 0.095, h * 0.28);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3);

    // Beard, and a rim of light along the near shoulder.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, h * 0.42);
    ctx.quadraticCurveTo(cx, h * 0.62, cx + w * 0.07, h * 0.42);
    ctx.closePath();
    ink(ctx, p, p.inkSoft, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.24, h * 0.98);
    ctx.quadraticCurveTo(cx - w * 0.17, h * 0.66, cx - w * 0.08, h * 0.6);
    ink(ctx, p, null, 2.2, p.paperDark);

    // Coil of rope worn across the chest.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, h * 0.64);
    ctx.quadraticCurveTo(cx + w * 0.02, h * 0.94, cx + w * 0.26, h * 0.7);
    ink(ctx, p, null, 7.5, p.line);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, h * 0.64);
    ctx.quadraticCurveTo(cx + w * 0.02, h * 0.94, cx + w * 0.26, h * 0.7);
    ink(ctx, p, null, 4, p.paperDark);
    dot(ctx, cx + w * 0.085, h * 0.42, Math.min(w, h) * 0.026, p.accent);
  },

  'Salt Cook': (ctx, w, h, p) => {
    const cx = w * 0.46;
    const py = h * 0.6;
    // Steam.
    for (let i = 0; i < 3; i++) {
      const x = cx + (i - 1) * w * 0.11;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.42);
      ctx.bezierCurveTo(x - w * 0.05, h * 0.3, x + w * 0.05, h * 0.22, x - w * 0.01, h * 0.08);
      ink(ctx, p, null, 2.4, p.inkSoft);
    }
    // Cauldron, deep-bellied.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, py);
    ctx.bezierCurveTo(cx - w * 0.23, py + h * 0.38, cx + w * 0.23, py + h * 0.38, cx + w * 0.19, py);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 3.4);
    ctx.beginPath();
    ctx.ellipse(cx, py, w * 0.19, h * 0.05, 0, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 3.2);
    ctx.beginPath();
    ctx.ellipse(cx, py, w * 0.14, h * 0.035, 0, 0, Math.PI * 2);
    ink(ctx, p, p.accent, 2.2);
    // Ladle leaning in the pot.
    capsule(ctx, cx + w * 0.11, py - h * 0.02, cx + w * 0.3, h * 0.12, Math.min(w, h) * 0.018);
    ink(ctx, p, p.wood, 2.6);
    // Trivet legs, splayed under the belly of the pot.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.16, py + h * 0.12);
      ctx.lineTo(cx + s * w * 0.26, h * 0.99);
      ink(ctx, p, null, 3.2, p.metalDark);
    }
    // Fire underneath.
    for (let i = -1; i <= 1; i++) {
      const fx = cx + i * w * 0.07;
      ctx.beginPath();
      ctx.moveTo(fx - w * 0.035, h * 0.95);
      ctx.quadraticCurveTo(fx - w * 0.01, h * 0.86, fx, h * 0.76);
      ctx.quadraticCurveTo(fx + w * 0.02, h * 0.87, fx + w * 0.035, h * 0.95);
      ctx.closePath();
      ink(ctx, p, p.flame, 2.2);
    }
  },

  'Rope Coil': (ctx, w, h, p) => {
    const cx = w * 0.44;
    const cy = h * 0.6;
    // Flat coil, seen in three-quarter: three fat nested turns.
    for (let i = 0; i < 3; i++) {
      const rx = w * (0.3 - i * 0.085);
      const ry = h * (0.28 - i * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ink(ctx, p, null, 9, p.line);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ink(ctx, p, null, 5.5, p.paperDark);
      // Twist ticks around each turn.
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + i * 0.3;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        ctx.beginPath();
        ctx.moveTo(x - Math.cos(a + 1.2) * w * 0.012, y - Math.sin(a + 1.2) * h * 0.02);
        ctx.lineTo(x + Math.cos(a + 1.2) * w * 0.012, y + Math.sin(a + 1.2) * h * 0.02);
        ink(ctx, p, null, 1.6, p.line);
      }
    }
    // The bitter end, trailing off and knotted.
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.3, cy);
    ctx.bezierCurveTo(w * 0.86, cy - h * 0.06, w * 0.8, h * 0.26, w * 0.94, h * 0.2);
    ink(ctx, p, null, 6.5, p.line);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.3, cy);
    ctx.bezierCurveTo(w * 0.86, cy - h * 0.06, w * 0.8, h * 0.26, w * 0.94, h * 0.2);
    ink(ctx, p, null, 3.4, p.paperDark);
    // Whipped end, and the eye spliced into it.
    ctx.beginPath();
    ctx.ellipse(w * 0.85, h * 0.22, w * 0.036, h * 0.058, -0.5, 0, Math.PI * 2);
    ink(ctx, p, null, 7, p.line);
    ctx.beginPath();
    ctx.ellipse(w * 0.85, h * 0.22, w * 0.036, h * 0.058, -0.5, 0, Math.PI * 2);
    ink(ctx, p, null, 3.6, p.accent);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.76 + i * 0.02), h * (0.3 - i * 0.02));
      ctx.lineTo(w * (0.79 + i * 0.02), h * (0.36 - i * 0.02));
      ink(ctx, p, null, 1.8, p.line);
    }
  },

  'Spyglass': (ctx, w, h, p) => {
    const ax = w * 0.1;
    const ay = h * 0.84;
    const bx = w * 0.9;
    const by = h * 0.2;
    const L = (t) => [ax + (bx - ax) * t, ay + (by - ay) * t];
    // Three draw tubes, widening towards the object glass.
    capsule(ctx, ...L(0.62), ...L(1.0), h * 0.15);
    ink(ctx, p, p.metal, 3.2);
    capsule(ctx, ...L(0.3), ...L(0.66), h * 0.115);
    ink(ctx, p, p.metalDark, 3.2);
    capsule(ctx, ...L(0.0), ...L(0.34), h * 0.085);
    ink(ctx, p, p.metal, 3.2);
    // Leather grip on the middle tube.
    ctx.save();
    capsule(ctx, ...L(0.34), ...L(0.6), h * 0.112);
    ctx.clip();
    ctx.beginPath();
    ctx.fillStyle = p.wood;
    ctx.fill();
    hatch(ctx, p, w * 0.2, h * 0.3, w * 0.4, h * 0.5, 7, 0.4, p.woodDark);
    ctx.restore();
    capsule(ctx, ...L(0.34), ...L(0.6), h * 0.112);
    ink(ctx, p, null, 2.8);
    // Object glass, catching the light.
    const [ox, oy] = L(0.98);
    ctx.beginPath();
    ctx.ellipse(ox, oy, w * 0.028, h * 0.14, -0.62, 0, Math.PI * 2);
    ink(ctx, p, p.accent, 2.8);
  },

  'Moonlit Cask': (ctx, w, h, p) => {
    // Moon, low and full-bellied behind the cargo.
    const mx = w * 0.74;
    const my = h * 0.36;
    const mr = Math.min(w, h) * 0.32;
    ctx.beginPath();
    ctx.arc(mx, my, mr, Math.PI * 0.36, Math.PI * 1.64);
    ctx.arc(mx - mr * 0.5, my, mr * 0.98, Math.PI * 1.6, Math.PI * 0.4, true);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.8, p.inkSoft);
    // Horizon.
    wave(ctx, h * 0.78, 0, w, h * 0.02, 7);
    ink(ctx, p, null, 2.4, p.inkSoft);
    // Cask, standing on the strand.
    const cx = w * 0.36;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.12, h * 0.36);
    ctx.bezierCurveTo(cx - w * 0.2, h * 0.6, cx - w * 0.2, h * 0.68, cx - w * 0.12, h * 0.92);
    ctx.lineTo(cx + w * 0.12, h * 0.92);
    ctx.bezierCurveTo(cx + w * 0.2, h * 0.68, cx + w * 0.2, h * 0.6, cx + w * 0.12, h * 0.36);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.36, w * 0.12, h * 0.055, 0, 0, Math.PI * 2);
    ink(ctx, p, p.woodDark, 3);
    for (const t of [0.5, 0.78]) {
      const bulge = w * (0.12 + Math.sin((t - 0.36) * 2.2) * 0.075);
      ctx.beginPath();
      ctx.moveTo(cx - bulge, h * t);
      ctx.lineTo(cx + bulge, h * t);
      ink(ctx, p, null, 3.2, p.metalDark);
    }
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.42);
    ctx.lineTo(cx, h * 0.9);
    ink(ctx, p, null, 1.8, p.woodDark);
  },

  'Bone Dice': (ctx, w, h, p) => {
    const cube = (x, y, s, fill) => {
      // Top face.
      ctx.beginPath();
      ctx.moveTo(x, y - s * 0.6);
      ctx.lineTo(x + s, y);
      ctx.lineTo(x, y + s * 0.6);
      ctx.lineTo(x - s, y);
      ctx.closePath();
      ink(ctx, p, fill, 3);
      // Left face.
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x, y + s * 0.6);
      ctx.lineTo(x, y + s * 1.6);
      ctx.lineTo(x - s, y + s);
      ctx.closePath();
      ink(ctx, p, p.paperDark, 3);
      // Right face.
      ctx.beginPath();
      ctx.moveTo(x + s, y);
      ctx.lineTo(x, y + s * 0.6);
      ctx.lineTo(x, y + s * 1.6);
      ctx.lineTo(x + s, y + s);
      ctx.closePath();
      ink(ctx, p, p.inkSoft, 3);
    };
    const s = Math.min(w, h) * 0.2;
    // Shadow on the deck.
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.ellipse(w * 0.48, h * 0.92, w * 0.3, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.inkSoft;
    ctx.fill();
    ctx.restore();

    cube(w * 0.33, h * 0.36, s, p.sail);
    dot(ctx, w * 0.33, h * 0.36, s * 0.14, p.ink);
    dot(ctx, w * 0.27, h * 0.47, s * 0.13, p.ink);
    dot(ctx, w * 0.27, h * 0.58, s * 0.13, p.ink);
    dot(ctx, w * 0.385, h * 0.55, s * 0.13, p.paper);

    cube(w * 0.68, h * 0.5, s * 0.86, p.sail);
    dot(ctx, w * 0.635, h * 0.48, s * 0.12, p.ink);
    dot(ctx, w * 0.725, h * 0.52, s * 0.12, p.ink);
    dot(ctx, w * 0.68, h * 0.5, s * 0.12, p.accent);
    dot(ctx, w * 0.735, h * 0.68, s * 0.12, p.paper);
  },

  'Pearl Diver': (ctx, w, h, p) => {
    // Water, suggested by a few drifting lines.
    for (let i = 0; i < 4; i++) {
      wave(ctx, h * (0.1 + i * 0.17), w * 0.02, w * 0.3, h * 0.022, 2);
      ink(ctx, p, null, 2, p.sea);
    }
    const m = Math.min(w, h);
    // Diver, driving head-down for the bottom.
    capsule(ctx, w * 0.42, h * 0.56, w * 0.34, h * 0.2, m * 0.085);
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.arc(w * 0.45, h * 0.67, m * 0.085, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3.2);
    // Legs, kicking up out of frame.
    capsule(ctx, w * 0.34, h * 0.22, w * 0.28, h * -0.04, m * 0.045);
    ink(ctx, p, p.ink, 2.8);
    capsule(ctx, w * 0.35, h * 0.22, w * 0.45, h * 0.02, m * 0.045);
    ink(ctx, p, p.ink, 2.8);
    // Arms, reaching down for the shell.
    capsule(ctx, w * 0.43, h * 0.54, w * 0.62, h * 0.74, m * 0.036);
    ink(ctx, p, p.ink, 2.8);
    capsule(ctx, w * 0.41, h * 0.58, w * 0.56, h * 0.84, m * 0.032);
    ink(ctx, p, p.ink, 2.8);
    // Bubbles trailing behind him.
    for (const b of [[0.26, 0.56, 0.03], [0.2, 0.4, 0.022], [0.24, 0.26, 0.016], [0.16, 0.16, 0.012]]) {
      ctx.beginPath();
      ctx.arc(w * b[0], h * b[1], m * b[2], 0, Math.PI * 2);
      ink(ctx, p, null, 2, p.sea);
    }
    // The oyster below, open on its prize.
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 0.88, w * 0.12, h * 0.1, 0.2, Math.PI, Math.PI * 2);
    ctx.closePath();
    ink(ctx, p, p.paperDark, 3);
    ctx.beginPath();
    ctx.ellipse(w * 0.78, h * 0.88, w * 0.12, h * 0.09, 0.2, 0, Math.PI);
    ctx.closePath();
    ink(ctx, p, p.sail, 3);
    dot(ctx, w * 0.78, h * 0.85, Math.min(w, h) * 0.05, p.accent);
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.85, Math.min(w, h) * 0.05, 0, Math.PI * 2);
    ink(ctx, p, null, 2.2);
  },

  // ---------------- sapphire ----------------

  'Helmsman': (ctx, w, h, p) => {
    const cx = w * 0.62;
    const cy = h * 0.52;
    const r = Math.min(w, h) * 0.42;
    // Eight spokes with their handles, drawn first so the rim caps them.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      capsule(ctx, cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2,
        cx + Math.cos(a) * r * 1.34, cy + Math.sin(a) * r * 1.34, r * 0.085);
      ink(ctx, p, p.wood, 2.8);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ink(ctx, p, null, 10, p.line);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ink(ctx, p, null, 6, p.woodDark);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 3);
    dot(ctx, cx, cy, r * 0.09, p.accent);
    // The helmsman's forearm, reaching in to take a spoke.
    capsule(ctx, w * 0.03, h * 1.0, cx - r * 0.82, cy + r * 0.66, Math.min(w, h) * 0.062);
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.arc(cx - r * 0.84, cy + r * 0.68, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // Cuff.
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.86);
    ctx.lineTo(w * 0.17, h * 1.0);
    ink(ctx, p, null, 2.6, p.paperDark);
  },

  'Tide Charts': (ctx, w, h, p) => {
    // A chart unrolled, curling at both ends.
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.26);
    ctx.lineTo(w * 0.9, h * 0.2);
    ctx.lineTo(w * 0.92, h * 0.84);
    ctx.lineTo(w * 0.08, h * 0.9);
    ctx.closePath();
    ink(ctx, p, p.sail, 3.2);
    // Coastline.
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.76);
    ctx.bezierCurveTo(w * 0.32, h * 0.6, w * 0.34, h * 0.42, w * 0.52, h * 0.38);
    ctx.bezierCurveTo(w * 0.68, h * 0.35, w * 0.7, h * 0.58, w * 0.88, h * 0.52);
    ink(ctx, p, null, 3, p.sea);
    // Soundings and rhumb lines.
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.18 + i * 0.16), h * 0.84);
      ctx.lineTo(w * (0.3 + i * 0.13), h * 0.3);
      ink(ctx, p, null, 1.3, p.inkSoft);
    }
    for (let i = 0; i < 9; i++) {
      dot(ctx, w * (0.18 + (i % 3) * 0.06), h * (0.58 + Math.floor(i / 3) * 0.1), 1.8, p.inkSoft);
    }
    // Compass star in the corner.
    const sx = w * 0.79;
    const sy = h * 0.68;
    const sr = Math.min(w, h) * 0.13;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 ? sr * 0.34 : sr;
      ctx[i ? 'lineTo' : 'moveTo'](sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ink(ctx, p, p.accent, 2.4);
    // Dividers laid across the sheet.
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.12);
    ctx.lineTo(w * 0.26, h * 0.7);
    ctx.moveTo(w * 0.36, h * 0.12);
    ctx.lineTo(w * 0.46, h * 0.66);
    ink(ctx, p, null, 3.4, p.metalDark);
    dot(ctx, w * 0.36, h * 0.12, Math.min(w, h) * 0.035, p.metal);
  },

  'Rain Barrel': (ctx, w, h, p) => {
    // Slanting rain across the whole plate.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = p.sea;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = -6; i < 22; i++) {
      const x = w * (i / 18);
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w * 0.05, h * 0.55);
    }
    ctx.stroke();
    ctx.restore();

    const cx = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, h * 0.42);
    ctx.bezierCurveTo(cx - w * 0.24, h * 0.66, cx - w * 0.24, h * 0.76, cx - w * 0.16, h * 0.97);
    ctx.lineTo(cx + w * 0.16, h * 0.97);
    ctx.bezierCurveTo(cx + w * 0.24, h * 0.76, cx + w * 0.24, h * 0.66, cx + w * 0.15, h * 0.42);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * w * 0.06, h * 0.46);
      ctx.lineTo(cx + i * w * 0.075, h * 0.95);
      ink(ctx, p, null, 1.6, p.woodDark);
    }
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, h * 0.72);
    ctx.lineTo(cx + w * 0.22, h * 0.72);
    ink(ctx, p, null, 3.2, p.metalDark);
    // Brim-full of rainwater.
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.42, w * 0.15, h * 0.075, 0, 0, Math.PI * 2);
    ink(ctx, p, p.accent, 3.2);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.03, h * 0.42, w * 0.06, h * 0.03, 0, 0, Math.PI * 2);
    ink(ctx, p, null, 2, p.sky);
    // Splashes off the rim.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.15, h * 0.4);
      ctx.quadraticCurveTo(cx + s * w * 0.21, h * 0.3, cx + s * w * 0.24, h * 0.37);
      ink(ctx, p, null, 2.2, p.sea);
    }
  },

  'Blue Lantern': (ctx, w, h, p) => {
    const cx = w * 0.44;
    // Glow, radiating.
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * w * 0.17, h * 0.56 + Math.sin(a) * h * 0.26);
      ctx.lineTo(cx + Math.cos(a) * w * 0.26, h * 0.56 + Math.sin(a) * h * 0.42);
      ctx.stroke();
    }
    ctx.restore();
    // Bail and hook.
    ctx.beginPath();
    ctx.arc(cx, h * 0.2, w * 0.07, Math.PI, 0);
    ink(ctx, p, null, 3, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.13);
    ctx.lineTo(cx, 0);
    ink(ctx, p, null, 2.6, p.metalDark);
    // Crown and base.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.22);
    ctx.lineTo(cx + w * 0.06, h * 0.22);
    ctx.lineTo(cx + w * 0.13, h * 0.36);
    ctx.lineTo(cx - w * 0.13, h * 0.36);
    ctx.closePath();
    ink(ctx, p, p.metal, 3);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.14, h * 0.78);
    ctx.lineTo(cx + w * 0.14, h * 0.78);
    ctx.lineTo(cx + w * 0.16, h * 0.88);
    ctx.lineTo(cx - w * 0.16, h * 0.88);
    ctx.closePath();
    ink(ctx, p, p.metal, 3);
    // The glazed body.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.115, h * 0.36);
    ctx.lineTo(cx + w * 0.115, h * 0.36);
    ctx.lineTo(cx + w * 0.125, h * 0.78);
    ctx.lineTo(cx - w * 0.125, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.accent, 3.4);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.04, h * 0.36);
      ctx.lineTo(cx + s * w * 0.045, h * 0.78);
      ink(ctx, p, null, 2.4, p.metalDark);
    }
    // The flame within.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.03, h * 0.66);
    ctx.quadraticCurveTo(cx, h * 0.52, cx + w * 0.03, h * 0.66);
    ctx.closePath();
    ink(ctx, p, p.sail, 2.2);
  },

  'Deep Sounder': (ctx, w, h, p) => {
    const lx = w * 0.62;
    // The sea, in long flat strokes to the left.
    for (let i = 0; i < 3; i++) {
      wave(ctx, h * (0.2 + i * 0.2), w * 0.04, w * 0.44, h * 0.022, 3);
      ink(ctx, p, null, 2.2, p.sea);
    }
    // Sounding line with its marks.
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.04, 0);
    ctx.quadraticCurveTo(lx + w * 0.02, h * 0.4, lx, h * 0.68);
    ink(ctx, p, null, 3, p.line);
    // Depth marks knotted into the line.
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const x = lx - w * 0.04 + w * 0.045 * Math.sin(t * Math.PI);
      const y = h * 0.62 * t;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.028, y + h * 0.018);
      ctx.lineTo(x + w * 0.028, y - h * 0.018);
      ink(ctx, p, null, 3.4, i === 3 ? p.accent : p.paperDark);
    }
    // The lead: a long plummet, tapering to a point.
    ctx.beginPath();
    ctx.arc(lx, h * 0.66, Math.min(w, h) * 0.035, 0, Math.PI * 2);
    ink(ctx, p, null, 2.6, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.042, h * 0.7);
    ctx.lineTo(lx + w * 0.042, h * 0.7);
    ctx.quadraticCurveTo(lx + w * 0.026, h * 0.9, lx, h * 0.97);
    ctx.quadraticCurveTo(lx - w * 0.026, h * 0.9, lx - w * 0.042, h * 0.7);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 3.4);
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.026, h * 0.78);
    ctx.quadraticCurveTo(lx - w * 0.016, h * 0.88, lx - w * 0.006, h * 0.93);
    ink(ctx, p, null, 2.2, p.metal);
    // Seabed.
    wave(ctx, h * 0.96, w * 0.3, w * 1.02, h * 0.03, 4);
    ink(ctx, p, null, 3, p.seaDeep);
    hatch(ctx, p, w * 0.3, h * 0.95, w * 0.7, h * 0.08, 7, 0.4, p.seaDeep);
  },

  'Storm Whistle': (ctx, w, h, p) => {
    const bx = w * 0.3;
    const by = h * 0.72;
    // Sound, breaking out of the mouth.
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(bx + w * 0.02, by - h * 0.06, Math.min(w, h) * (0.2 + i * 0.16), -Math.PI * 0.85, -Math.PI * 0.2);
      ink(ctx, p, null, 2.4, p.accent);
    }
    // The buoy and its wind-way.
    ctx.beginPath();
    ctx.arc(bx, by, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 3.2);
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.01, by - Math.min(w, h) * 0.12);
    ctx.lineTo(bx + w * 0.035, by - Math.min(w, h) * 0.12);
    ink(ctx, p, null, 3, p.metalDark);
    // Wind pipe running up to the right.
    capsule(ctx, bx + Math.min(w, h) * 0.08, by - h * 0.03, w * 0.78, h * 0.3, Math.min(w, h) * 0.045);
    ink(ctx, p, p.metal, 3.2);
    // Keel plate beneath the pipe.
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.09, by + h * 0.03);
    ctx.lineTo(w * 0.66, h * 0.44);
    ctx.lineTo(w * 0.62, h * 0.62);
    ctx.lineTo(bx + w * 0.07, h * 0.86);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 2.8);
    // Ring and lanyard.
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.25, Math.min(w, h) * 0.05, 0, Math.PI * 2);
    ink(ctx, p, null, 3, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(w * 0.86, h * 0.21);
    ctx.quadraticCurveTo(w * 0.98, h * 0.14, w * 0.94, h * 0.02);
    ink(ctx, p, null, 2.4, p.inkSoft);
  },

  'Kelp Net': (ctx, w, h, p) => {
    // Head rope with its floats.
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.2);
    ctx.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.96, h * 0.22);
    ink(ctx, p, null, 3.4);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = w * (0.1 + t * 0.8);
      const y = h * (0.2 - Math.sin(t * Math.PI) * 0.1 + t * 0.02);
      ctx.beginPath();
      ctx.arc(x, y, Math.min(w, h) * 0.045, 0, Math.PI * 2);
      ink(ctx, p, i === 2 ? p.accent : p.wood, 2.6);
    }
    // The mesh, hanging in a slack bag.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.2);
    ctx.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.96, h * 0.22);
    ctx.quadraticCurveTo(w * 0.86, h * 0.98, w * 0.46, h * 0.98);
    ctx.quadraticCurveTo(w * 0.1, h * 0.96, w * 0.04, h * 0.2);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = p.inkSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -8; i < 16; i++) {
      ctx.moveTo(w * (i * 0.1), h * 1.05);
      ctx.lineTo(w * (i * 0.1) + w * 0.5, h * 0.05);
      ctx.moveTo(w * (i * 0.1), h * 0.05);
      ctx.lineTo(w * (i * 0.1) + w * 0.5, h * 1.05);
    }
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.2);
    ctx.quadraticCurveTo(w * 0.1, h * 0.96, w * 0.46, h * 0.98);
    ctx.quadraticCurveTo(w * 0.86, h * 0.98, w * 0.96, h * 0.22);
    ink(ctx, p, null, 3.4);
    // Kelp caught in the mesh.
    for (const k of [[0.26, 1.1], [0.58, 0.9]]) {
      ctx.beginPath();
      ctx.moveTo(w * k[0], h * 0.96);
      ctx.bezierCurveTo(w * (k[0] + 0.12), h * 0.7, w * (k[0] - 0.08), h * 0.5, w * (k[0] + 0.06), h * 0.24);
      ink(ctx, p, null, 5, p.leaf);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(w * (k[0] + 0.04 + i * 0.01), h * (0.8 - i * 0.2), w * 0.03, h * 0.045, k[1], 0, Math.PI * 2);
        ink(ctx, p, p.leaf, 2);
      }
    }
  },

  'Wavecutter': (ctx, w, h, p) => {
    wave(ctx, h * 0.86, 0, w, h * 0.03, 6);
    ink(ctx, p, null, 2.6, p.seaDeep);
    // Bowsprit, thrust out over the sea.
    capsule(ctx, w * 0.3, h * 0.36, w * 0.02, h * 0.08, Math.min(w, h) * 0.032);
    ink(ctx, p, p.woodDark, 2.8);
    // The hull: a narrow wedge of a bow, cutting to the left.
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.34);
    ctx.bezierCurveTo(w * 0.3, h * 0.56, w * 0.42, h * 0.78, w * 0.99, h * 0.82);
    ctx.lineTo(w * 0.99, h * 0.4);
    ctx.bezierCurveTo(w * 0.64, h * 0.42, w * 0.4, h * 0.38, w * 0.28, h * 0.34);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    // Sheer line and planking.
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.4);
    ctx.bezierCurveTo(w * 0.64, h * 0.48, w * 0.8, h * 0.48, w * 0.99, h * 0.47);
    ink(ctx, p, null, 2.6, p.woodDark);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.3 + i * 0.03), h * (0.48 + i * 0.12));
      ctx.bezierCurveTo(w * 0.6, h * (0.58 + i * 0.1), w * 0.8, h * (0.6 + i * 0.09), w * 0.99, h * (0.58 + i * 0.1));
      ink(ctx, p, null, 1.7, p.woodDark);
    }
    // Stem post and the hawse eye.
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.34);
    ctx.bezierCurveTo(w * 0.3, h * 0.56, w * 0.34, h * 0.68, w * 0.44, h * 0.78);
    ink(ctx, p, null, 3.2, p.woodDark);
    dot(ctx, w * 0.36, h * 0.52, Math.min(w, h) * 0.04, p.accent);
    ctx.beginPath();
    ctx.arc(w * 0.36, h * 0.52, Math.min(w, h) * 0.04, 0, Math.PI * 2);
    ink(ctx, p, null, 2.2);
    // The wave, thrown up and curling over from the stem.
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.96);
    ctx.bezierCurveTo(w * 0.04, h * 0.6, w * 0.14, h * 0.36, w * 0.3, h * 0.44);
    ctx.bezierCurveTo(w * 0.18, h * 0.44, w * 0.16, h * 0.62, w * 0.2, h * 0.72);
    ctx.bezierCurveTo(w * 0.14, h * 0.62, w * 0.1, h * 0.76, w * 0.14, h * 0.98);
    ctx.closePath();
    ink(ctx, p, p.sea, 3.2);
    for (const s of [[0.22, 0.26], [0.13, 0.2], [0.3, 0.16]]) {
      ctx.beginPath();
      ctx.arc(w * s[0], h * s[1], Math.min(w, h) * 0.025, 0, Math.PI * 2);
      ink(ctx, p, null, 2, p.sea);
    }
  },

  // ---------------- emerald ----------------

  'Jungle Scout': (ctx, w, h, p) => {
    // Great leaves crowding in from both sides.
    const frond = (x, y, dir) => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dir * w * 0.14, y - h * 0.3, x + dir * w * 0.26, y - h * 0.5);
      ink(ctx, p, null, 3, p.leaf);
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const bx = x + dir * w * (0.14 * 2 * t - 0.14 * t * t) * 1.1;
        const by = y - h * (0.3 * 2 * t - 0.1 * t * t);
        // Broad blades of leaf, springing from the stem both ways.
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + dir * w * 0.11, by - h * 0.02, bx + dir * w * 0.14, by + h * 0.1);
        ctx.quadraticCurveTo(bx + dir * w * 0.05, by + h * 0.06, bx, by + h * 0.03);
        ctx.closePath();
        ink(ctx, p, p.leaf, 2);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx - dir * w * 0.06, by - h * 0.11, bx - dir * w * 0.12, by - h * 0.09);
        ctx.quadraticCurveTo(bx - dir * w * 0.05, by - h * 0.04, bx, by + h * 0.02);
        ctx.closePath();
        ink(ctx, p, p.leaf, 2);
      }
    };
    frond(w * 0.08, h * 1.0, 1);
    frond(w * 0.94, h * 1.0, -1);
    // The scout, crouched between them.
    const cx = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.09, h * 0.92);
    ctx.quadraticCurveTo(cx - w * 0.11, h * 0.56, cx - w * 0.02, h * 0.48);
    ctx.lineTo(cx + w * 0.07, h * 0.52);
    ctx.quadraticCurveTo(cx + w * 0.12, h * 0.74, cx + w * 0.09, h * 0.92);
    ctx.closePath();
    ink(ctx, p, p.ink, 3);
    ctx.beginPath();
    ctx.arc(cx, h * 0.38, Math.min(w, h) * 0.08, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // Broad hat.
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.32, w * 0.11, h * 0.045, -0.08, 0, Math.PI * 2);
    ink(ctx, p, p.woodDark, 3);
    // Machete held out low.
    capsule(ctx, cx + w * 0.06, h * 0.66, cx + w * 0.2, h * 0.58, Math.min(w, h) * 0.03);
    ink(ctx, p, p.wood, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.19, h * 0.54);
    ctx.quadraticCurveTo(cx + w * 0.32, h * 0.4, cx + w * 0.34, h * 0.26);
    ctx.quadraticCurveTo(cx + w * 0.26, h * 0.4, cx + w * 0.17, h * 0.6);
    ctx.closePath();
    ink(ctx, p, p.metal, 2.8);
    dot(ctx, cx - w * 0.03, h * 0.38, Math.min(w, h) * 0.02, p.accent);
  },

  'Parrot Lookout': (ctx, w, h, p) => {
    const bx = w * 0.42;
    const by = h * 0.36;
    // Perch, a lashed spar.
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.86);
    ctx.lineTo(w * 0.96, h * 0.78);
    ink(ctx, p, null, 8, p.line);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.86);
    ctx.lineTo(w * 0.96, h * 0.78);
    ink(ctx, p, null, 5, p.wood);
    // Body and tail.
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.07, by + h * 0.04);
    ctx.bezierCurveTo(bx - w * 0.12, by + h * 0.36, bx - w * 0.02, by + h * 0.5, bx + w * 0.04, by + h * 0.46);
    ctx.bezierCurveTo(bx + w * 0.14, by + h * 0.3, bx + w * 0.1, by + h * 0.04, bx + w * 0.04, by - h * 0.06);
    ctx.closePath();
    ink(ctx, p, p.leaf, 3.2);
    ctx.beginPath();
    ctx.moveTo(bx + w * 0.02, by + h * 0.44);
    ctx.lineTo(bx + w * 0.3, h * 1.0);
    ctx.lineTo(bx + w * 0.14, h * 1.0);
    ctx.lineTo(bx - w * 0.01, by + h * 0.44);
    ctx.closePath();
    ink(ctx, p, p.accent, 3);
    // Head, crest and beak.
    ctx.beginPath();
    ctx.arc(bx - w * 0.01, by - h * 0.08, Math.min(w, h) * 0.105, 0, Math.PI * 2);
    ink(ctx, p, p.leaf, 3.2);
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.05, by - h * 0.22);
    ctx.quadraticCurveTo(bx + w * 0.01, by - h * 0.46, bx + w * 0.07, by - h * 0.26);
    ctx.closePath();
    ink(ctx, p, p.leaf, 2.6);
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.05, by - h * 0.14);
    ctx.quadraticCurveTo(bx - w * 0.15, by - h * 0.08, bx - w * 0.06, by + h * 0.04);
    ctx.quadraticCurveTo(bx - w * 0.035, by - h * 0.03, bx - w * 0.05, by - h * 0.14);
    ctx.closePath();
    ink(ctx, p, p.paperDark, 2.8);
    dot(ctx, bx + w * 0.005, by - h * 0.13, Math.min(w, h) * 0.022, p.ink);
    // Wing.
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.04, by + h * 0.06);
    ctx.quadraticCurveTo(bx + w * 0.1, by + h * 0.14, bx + w * 0.02, by + h * 0.42);
    ink(ctx, p, null, 2.4, p.woodDark);
    // Feet on the spar.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(bx + s * w * 0.02, by + h * 0.44);
      ctx.lineTo(bx + s * w * 0.03, h * 0.82);
      ink(ctx, p, null, 2.6, p.woodDark);
    }
  },

  'Lime Crate': (ctx, w, h, p) => {
    const cx = w * 0.45;
    // Crate, three-quarter.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, h * 0.48);
    ctx.lineTo(cx + w * 0.16, h * 0.42);
    ctx.lineTo(cx + w * 0.16, h * 0.9);
    ctx.lineTo(cx - w * 0.22, h * 0.96);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    for (let i = 1; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.22, h * (0.48 + i * 0.16));
      ctx.lineTo(cx + w * 0.16, h * (0.42 + i * 0.16));
      ink(ctx, p, null, 2, p.woodDark);
    }
    // Side face.
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.16, h * 0.42);
    ctx.lineTo(cx + w * 0.3, h * 0.32);
    ctx.lineTo(cx + w * 0.3, h * 0.8);
    ctx.lineTo(cx + w * 0.16, h * 0.9);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3.2);
    // Top edge.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, h * 0.48);
    ctx.lineTo(cx - w * 0.09, h * 0.38);
    ctx.lineTo(cx + w * 0.3, h * 0.32);
    ctx.lineTo(cx + w * 0.16, h * 0.42);
    ctx.closePath();
    ink(ctx, p, p.paperDark, 3);
    // Limes heaped above and one loose on the deck.
    const lime = (x, y, r, fill) => {
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.08, r, 0.2, 0, Math.PI * 2);
      ink(ctx, p, fill, 3);
      ctx.beginPath();
      ctx.moveTo(x + r * 0.2, y - r * 0.9);
      ctx.quadraticCurveTo(x + r * 0.9, y - r * 1.5, x + r * 1.1, y - r * 0.7);
      ctx.closePath();
      ink(ctx, p, p.leaf, 2);
    };
    const r = Math.min(w, h) * 0.085;
    lime(cx - w * 0.1, h * 0.28, r, p.leaf);
    lime(cx + w * 0.04, h * 0.22, r, p.leaf);
    lime(cx + w * 0.17, h * 0.26, r, p.accent);
    lime(cx + w * 0.36, h * 0.88, r * 0.9, p.leaf);
  },

  'Vine Rigging': (ctx, w, h, p) => {
    // Two shrouds running up the plate, wrapped in creeper.
    const shroud = (x0, x1) => {
      ctx.beginPath();
      ctx.moveTo(x0, h * 1.02);
      ctx.quadraticCurveTo((x0 + x1) / 2, h * 0.5, x1, -h * 0.02);
      ink(ctx, p, null, 7, p.line);
      ctx.beginPath();
      ctx.moveTo(x0, h * 1.02);
      ctx.quadraticCurveTo((x0 + x1) / 2, h * 0.5, x1, -h * 0.02);
      ink(ctx, p, null, 4, p.paperDark);
    };
    shroud(w * 0.14, w * 0.42);
    shroud(w * 0.66, w * 0.86);
    // Ratlines between them.
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      ctx.beginPath();
      ctx.moveTo(w * (0.14 + 0.28 * t + 0.03), h * (1.02 - t * 1.04));
      ctx.lineTo(w * (0.66 + 0.2 * t - 0.02), h * (1.02 - t * 1.04) - h * 0.02);
      ink(ctx, p, null, 2.4, p.inkSoft);
    }
    // The vine, coiling across everything.
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.96);
    ctx.bezierCurveTo(w * 0.5, h * 0.82, w * 0.2, h * 0.44, w * 0.56, h * 0.34);
    ctx.bezierCurveTo(w * 0.86, h * 0.26, w * 0.7, h * 0.1, w * 0.94, h * 0.06);
    ink(ctx, p, null, 4, p.leaf);
    const leaf = (x, y, a) => {
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.045, h * 0.05, a, 0, Math.PI * 2);
      ink(ctx, p, p.leaf, 2.4);
    };
    leaf(w * 0.24, h * 0.8, 0.5);
    leaf(w * 0.34, h * 0.54, -0.4);
    leaf(w * 0.62, h * 0.4, 0.8);
    leaf(w * 0.8, h * 0.16, -0.3);
    // A curling tendril, the one bright note.
    ctx.beginPath();
    ctx.moveTo(w * 0.46, h * 0.62);
    ctx.bezierCurveTo(w * 0.58, h * 0.6, w * 0.56, h * 0.76, w * 0.48, h * 0.74);
    ctx.quadraticCurveTo(w * 0.44, h * 0.72, w * 0.5, h * 0.68);
    ink(ctx, p, null, 2.6, p.accent);
  },

  'Green Glass': (ctx, w, h, p) => {
    // A drift of sand.
    ctx.beginPath();
    ctx.moveTo(0, h * 0.98);
    ctx.quadraticCurveTo(w * 0.34, h * 0.64, w * 0.72, h * 0.8);
    ctx.quadraticCurveTo(w * 0.88, h * 0.86, w, h * 0.82);
    ctx.lineTo(w, h);
    ctx.closePath();
    ink(ctx, p, p.paperDark, 3);
    // The bottle, half sunk, lying to the right.
    const x0 = w * 0.22;
    const y0 = h * 0.62;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - h * 0.17);
    ctx.lineTo(w * 0.56, y0 - h * 0.22);
    ctx.quadraticCurveTo(w * 0.64, y0 - h * 0.21, w * 0.66, y0 - h * 0.1);
    ctx.lineTo(w * 0.82, y0 - h * 0.09);
    ctx.lineTo(w * 0.82, y0 + h * 0.03);
    ctx.lineTo(w * 0.66, y0 + h * 0.04);
    ctx.quadraticCurveTo(w * 0.64, y0 + h * 0.15, w * 0.56, y0 + h * 0.16);
    ctx.lineTo(x0, y0 + h * 0.12);
    ctx.quadraticCurveTo(w * 0.14, y0 - h * 0.02, x0, y0 - h * 0.17);
    ctx.closePath();
    ink(ctx, p, p.leaf, 3.4);
    // Highlight down the shoulder.
    ctx.beginPath();
    ctx.moveTo(w * 0.28, y0 - h * 0.12);
    ctx.lineTo(w * 0.54, y0 - h * 0.16);
    ink(ctx, p, null, 3, p.accent);
    ctx.beginPath();
    ctx.moveTo(w * 0.26, y0 + h * 0.06);
    ctx.lineTo(w * 0.5, y0 + h * 0.1);
    ink(ctx, p, null, 2, p.woodDark);
    // Cork.
    ctx.beginPath();
    ctx.moveTo(w * 0.82, y0 - h * 0.085);
    ctx.lineTo(w * 0.92, y0 - h * 0.075);
    ctx.lineTo(w * 0.92, y0 + h * 0.02);
    ctx.lineTo(w * 0.82, y0 + h * 0.025);
    ctx.closePath();
    ink(ctx, p, p.wood, 3);
    // Rolled note inside.
    ctx.beginPath();
    ctx.moveTo(w * 0.3, y0 - h * 0.02);
    ctx.lineTo(w * 0.48, y0 - h * 0.05);
    ink(ctx, p, null, 5, p.sail);
  },

  'Turtle Shell': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const cy = h * 0.56;
    const rx = w * 0.32;
    const ry = h * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ink(ctx, p, p.leaf, 3.6);
    // Marginal scutes around the rim.
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rx * 0.76, cy + Math.sin(a) * ry * 0.76);
      ctx.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
      ink(ctx, p, null, 2.4, p.woodDark);
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.76, ry * 0.76, 0, 0, Math.PI * 2);
    ink(ctx, p, null, 3, p.woodDark);
    // Central row of five vertebral scutes.
    for (let i = -2; i <= 2; i++) {
      const y = cy + i * ry * 0.28;
      const s = 1 - Math.abs(i) * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx, y - ry * 0.16 * s);
      ctx.lineTo(cx + rx * 0.17 * s, y);
      ctx.lineTo(cx, y + ry * 0.16 * s);
      ctx.lineTo(cx - rx * 0.17 * s, y);
      ctx.closePath();
      ink(ctx, p, i === 0 ? p.accent : null, 2.6, p.woodDark);
    }
    // Flanking costal scutes.
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + s * rx * 0.44, cy + i * ry * 0.4, rx * 0.16, ry * 0.16, 0, 0, Math.PI * 2);
        ink(ctx, p, null, 2.2, p.woodDark);
      }
    }
    hatch(ctx, p, w * 0.14, h * 0.86, w * 0.7, h * 0.12, 8, 0.3);
  },

  'Fern Charm': (ctx, w, h, p) => {
    const cx = w * 0.5;
    // Hanging ring and cord.
    ctx.beginPath();
    ctx.arc(cx, h * 0.12, Math.min(w, h) * 0.07, 0, Math.PI * 2);
    ink(ctx, p, null, 3.4, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.19);
    ctx.lineTo(cx, h * 0.34);
    ink(ctx, p, null, 2.6, p.inkSoft);
    // Binding, with small beads.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.05, h * 0.34);
    ctx.lineTo(cx + w * 0.05, h * 0.34);
    ctx.lineTo(cx + w * 0.04, h * 0.44);
    ctx.lineTo(cx - w * 0.04, h * 0.44);
    ctx.closePath();
    ink(ctx, p, p.wood, 2.8);
    dot(ctx, cx - w * 0.075, h * 0.3, Math.min(w, h) * 0.028, p.accent);
    dot(ctx, cx + w * 0.075, h * 0.28, Math.min(w, h) * 0.024, p.paperDark);
    // The frond, arching down.
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.44);
    ctx.quadraticCurveTo(cx + w * 0.04, h * 0.76, cx - w * 0.02, h * 0.97);
    ink(ctx, p, null, 3, p.leaf);
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      const bx = cx + w * (0.08 * t - 0.06 * t * t);
      const by = h * (0.46 + t * 0.46);
      const len = w * (0.22 - t * 0.15);
      for (const s of [-1, 1]) {
        // Each leaflet a lens of leaf, notched along its outer edge.
        ctx.beginPath();
        ctx.moveTo(bx, by - h * 0.012);
        ctx.quadraticCurveTo(bx + s * len * 0.6, by - h * 0.07, bx + s * len, by + h * 0.01);
        ctx.quadraticCurveTo(bx + s * len * 0.55, by + h * 0.03, bx, by + h * 0.03);
        ctx.closePath();
        ink(ctx, p, p.leaf, 2.4);
      }
    }
  },

  'Mangrove Guide': (ctx, w, h, p) => {
    // Waterline low across the plate.
    wave(ctx, h * 0.82, 0, w, h * 0.022, 7);
    ink(ctx, p, null, 2.6, p.sea);
    // Stilt roots, bowing out of the water like flying buttresses.
    const root = (x, spread) => {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(x, h * 0.34);
        ctx.bezierCurveTo(x + s * spread * 1.1, h * 0.42, x + s * spread * 1.35, h * 0.6, x + s * spread * 1.1, h * 0.88);
        ink(ctx, p, null, 4, p.woodDark);
      }
      ctx.beginPath();
      ctx.moveTo(x, h * 0.86);
      ctx.bezierCurveTo(x - w * 0.02, h * 0.66, x + w * 0.02, h * 0.5, x, h * 0.3);
      ink(ctx, p, null, 5.5, p.woodDark);
    };
    root(w * 0.2, w * 0.13);
    root(w * 0.78, w * 0.12);
    // Canopy of leaves along the top.
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.3);
    ctx.quadraticCurveTo(w * 0.5, -h * 0.12, w * 0.98, h * 0.3);
    ink(ctx, p, null, 3.4, p.leaf);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const x = w * (0.04 + t * 0.92);
      const y = h * (0.3 - Math.sin(t * Math.PI) * 0.26);
      ctx.beginPath();
      ctx.ellipse(x, y - h * 0.04, w * 0.04, h * 0.06, (t - 0.5) * 1.4, 0, Math.PI * 2);
      ink(ctx, p, p.leaf, 2.4);
    }
    // A poled skiff slipping through the arch.
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.78);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.66, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.78);
    ctx.lineTo(w * 0.52, h * 0.6);
    ink(ctx, p, null, 5, p.ink);
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.46);
    ctx.lineTo(w * 0.44, h * 0.9);
    ink(ctx, p, null, 2.6, p.accent);
  },

  // ---------------- ruby ----------------

  'Powder Monkey': (ctx, w, h, p) => {
    const cx = w * 0.46;
    hatch(ctx, p, w * 0.02, h * 0.3, w * 0.28, h * 0.5, 8, 0.22);
    // Leaning forward at a run.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.1, h * 0.72);
    ctx.quadraticCurveTo(cx - w * 0.04, h * 0.42, cx + w * 0.08, h * 0.38);
    ctx.lineTo(cx + w * 0.13, h * 0.5);
    ctx.quadraticCurveTo(cx + w * 0.04, h * 0.64, cx - w * 0.02, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.ink, 3);
    ctx.beginPath();
    ctx.arc(cx + w * 0.13, h * 0.3, Math.min(w, h) * 0.075, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // Legs, mid-stride.
    capsule(ctx, cx - w * 0.07, h * 0.72, cx - w * 0.19, h * 0.94, Math.min(w, h) * 0.04);
    ink(ctx, p, p.ink, 2.8);
    capsule(ctx, cx - w * 0.03, h * 0.75, cx + w * 0.11, h * 0.92, Math.min(w, h) * 0.04);
    ink(ctx, p, p.ink, 2.8);
    // Arms clamped round the cartridge.
    capsule(ctx, cx + w * 0.02, h * 0.5, cx + w * 0.2, h * 0.58, Math.min(w, h) * 0.032);
    ink(ctx, p, p.ink, 2.6);
    // The powder cartridge itself.
    capsule(ctx, cx + w * 0.16, h * 0.66, cx + w * 0.36, h * 0.5, Math.min(w, h) * 0.085);
    ink(ctx, p, p.paperDark, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.2, h * 0.73);
    ctx.lineTo(cx + w * 0.26, h * 0.57);
    ctx.moveTo(cx + w * 0.26, h * 0.67);
    ctx.lineTo(cx + w * 0.32, h * 0.51);
    ink(ctx, p, null, 2.6, p.accent);
    // Tarred cap.
    ctx.beginPath();
    ctx.arc(cx + w * 0.13, h * 0.24, Math.min(w, h) * 0.078, Math.PI * 1.1, Math.PI * 2.05);
    ctx.closePath();
    ink(ctx, p, p.flame, 2.6);
  },

  'Gunners Mate': (ctx, w, h, p) => {
    // Cannon on its truck, muzzle to the right.
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.34);
    ctx.lineTo(w * 0.46, h * 0.36);
    ctx.lineTo(w * 0.46, h * 0.3);
    ctx.lineTo(w * 0.84, h * 0.32);
    ctx.lineTo(w * 0.84, h * 0.54);
    ctx.lineTo(w * 0.46, h * 0.56);
    ctx.lineTo(w * 0.46, h * 0.5);
    ctx.lineTo(w * 0.12, h * 0.56);
    ctx.quadraticCurveTo(w * 0.04, h * 0.45, w * 0.12, h * 0.34);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 3.4);
    ctx.beginPath();
    ctx.ellipse(w * 0.84, h * 0.43, w * 0.022, h * 0.115, 0, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 2.8);
    // Cascabel and trunnion.
    ctx.beginPath();
    ctx.arc(w * 0.07, h * 0.45, Math.min(w, h) * 0.035, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 2.6);
    ctx.beginPath();
    ctx.arc(w * 0.44, h * 0.53, Math.min(w, h) * 0.04, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 2.6);
    // Truck carriage.
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.56);
    ctx.lineTo(w * 0.66, h * 0.56);
    ctx.lineTo(w * 0.62, h * 0.78);
    ctx.lineTo(w * 0.22, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.2);
    for (const x of [0.28, 0.58]) {
      ctx.beginPath();
      ctx.arc(w * x, h * 0.82, Math.min(w, h) * 0.085, 0, Math.PI * 2);
      ink(ctx, p, p.woodDark, 3);
      dot(ctx, w * x, h * 0.82, Math.min(w, h) * 0.022, p.metal);
    }
    // Linstock with a lit match.
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.98);
    ctx.lineTo(w * 0.26, h * 0.1);
    ink(ctx, p, null, 3.4, p.wood);
    ctx.beginPath();
    ctx.moveTo(w * 0.24, h * 0.16);
    ctx.quadraticCurveTo(w * 0.32, h * 0.06, w * 0.28, h * 0.02);
    ink(ctx, p, null, 3, p.flame);
    dot(ctx, w * 0.27, h * 0.09, Math.min(w, h) * 0.035, p.accent);
  },

  'Rum Cask': (ctx, w, h, p) => {
    const cx = w * 0.52;
    const cy = h * 0.46;
    // Cask on its side, hoops standing proud.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.26, cy - h * 0.22);
    ctx.quadraticCurveTo(cx, cy - h * 0.36, cx + w * 0.26, cy - h * 0.22);
    ctx.quadraticCurveTo(cx + w * 0.3, cy, cx + w * 0.26, cy + h * 0.22);
    ctx.quadraticCurveTo(cx, cy + h * 0.36, cx - w * 0.26, cy + h * 0.22);
    ctx.quadraticCurveTo(cx - w * 0.3, cy, cx - w * 0.26, cy - h * 0.22);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.26, cy, w * 0.055, h * 0.24, 0, 0, Math.PI * 2);
    ink(ctx, p, p.woodDark, 3);
    for (const x of [-0.12, 0.08, 0.24]) {
      ctx.beginPath();
      ctx.ellipse(cx + w * x, cy, w * 0.035, h * (0.3 - Math.abs(x) * 0.22), 0, 0, Math.PI * 2);
      ink(ctx, p, null, 2.6, p.metalDark);
    }
    // Spigot and the pour.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.3, cy + h * 0.04);
    ctx.lineTo(cx - w * 0.38, cy + h * 0.08);
    ink(ctx, p, null, 5, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.38, cy + h * 0.1);
    ctx.quadraticCurveTo(cx - w * 0.39, cy + h * 0.3, cx - w * 0.36, cy + h * 0.4);
    ink(ctx, p, null, 3, p.accent);
    // Cup beneath.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.44, cy + h * 0.42);
    ctx.lineTo(cx - w * 0.28, cy + h * 0.42);
    ctx.lineTo(cx - w * 0.31, cy + h * 0.66);
    ctx.lineTo(cx - w * 0.41, cy + h * 0.66);
    ctx.closePath();
    ink(ctx, p, p.metal, 3);
    // Chocks.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.1 - w * 0.06, cy + h * 0.32);
      ctx.lineTo(cx + s * w * 0.1 + w * 0.06, cy + h * 0.32);
      ctx.lineTo(cx + s * w * 0.1 + w * 0.09, cy + h * 0.5);
      ctx.lineTo(cx + s * w * 0.1 - w * 0.09, cy + h * 0.5);
      ctx.closePath();
      ink(ctx, p, p.woodDark, 2.6);
    }
  },

  'Red Sash': (ctx, w, h, p) => {
    // A length of cloth, sagging as it crosses the plate.
    ctx.beginPath();
    ctx.moveTo(w * 0.0, h * 0.1);
    ctx.bezierCurveTo(w * 0.14, h * 0.32, w * 0.24, h * 0.36, w * 0.36, h * 0.42);
    ctx.lineTo(w * 0.32, h * 0.62);
    ctx.bezierCurveTo(w * 0.2, h * 0.54, w * 0.1, h * 0.46, w * 0.0, h * 0.32);
    ctx.closePath();
    ink(ctx, p, p.flame, 3.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.56, h * 0.42);
    ctx.bezierCurveTo(w * 0.72, h * 0.3, w * 0.86, h * 0.3, w * 1.0, h * 0.2);
    ctx.lineTo(w * 1.0, h * 0.4);
    ctx.bezierCurveTo(w * 0.86, h * 0.5, w * 0.72, h * 0.5, w * 0.58, h * 0.62);
    ctx.closePath();
    ink(ctx, p, p.flame, 3.2);
    // Tails, falling from the knot.
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.62);
    ctx.bezierCurveTo(w * 0.36, h * 0.76, w * 0.34, h * 0.86, w * 0.26, h * 0.99);
    ctx.lineTo(w * 0.4, h * 0.99);
    ctx.bezierCurveTo(w * 0.46, h * 0.84, w * 0.5, h * 0.74, w * 0.52, h * 0.62);
    ctx.closePath();
    ink(ctx, p, p.flame, 3);
    ctx.beginPath();
    ctx.moveTo(w * 0.52, h * 0.62);
    ctx.bezierCurveTo(w * 0.56, h * 0.74, w * 0.62, h * 0.8, w * 0.66, h * 0.9);
    ctx.lineTo(w * 0.54, h * 0.94);
    ctx.bezierCurveTo(w * 0.5, h * 0.82, w * 0.46, h * 0.72, w * 0.46, h * 0.64);
    ctx.closePath();
    ink(ctx, p, p.flame, 3);
    // The knot, bunched tight in the middle.
    ctx.beginPath();
    ctx.ellipse(w * 0.46, h * 0.5, w * 0.078, h * 0.19, -0.42, 0, Math.PI * 2);
    ink(ctx, p, p.accent, 3.4);
    for (const k of [[0.39, 0.46, 0.53, 0.4], [0.4, 0.6, 0.54, 0.54]]) {
      ctx.beginPath();
      ctx.moveTo(w * k[0], h * k[1]);
      ctx.quadraticCurveTo(w * (k[0] + k[2]) / 2, h * ((k[1] + k[3]) / 2 + 0.04), w * k[2], h * k[3]);
      ink(ctx, p, null, 2.6, p.woodDark);
    }
    // Folds in the cloth.
    for (const f of [[0.08, 0.22, 0.12, 0.42], [0.2, 0.32, 0.23, 0.52], [0.72, 0.33, 0.74, 0.45], [0.88, 0.28, 0.9, 0.4]]) {
      ctx.beginPath();
      ctx.moveTo(w * f[0], h * f[1]);
      ctx.lineTo(w * f[2], h * f[3]);
      ink(ctx, p, null, 2, p.woodDark);
    }
  },

  'Fire Pot': (ctx, w, h, p) => {
    const cx = w * 0.46;
    const cy = h * 0.66;
    // Flame boiling out of the neck.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, h * 0.4);
    ctx.bezierCurveTo(cx - w * 0.14, h * 0.24, cx - w * 0.02, h * 0.24, cx - w * 0.01, h * 0.04);
    ctx.bezierCurveTo(cx + w * 0.08, h * 0.22, cx + w * 0.16, h * 0.26, cx + w * 0.07, h * 0.4);
    ctx.closePath();
    ink(ctx, p, p.flame, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.025, h * 0.4);
    ctx.quadraticCurveTo(cx - w * 0.01, h * 0.22, cx + w * 0.025, h * 0.36);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.2);
    // Neck.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.38);
    ctx.lineTo(cx + w * 0.06, h * 0.38);
    ctx.lineTo(cx + w * 0.05, h * 0.5);
    ctx.lineTo(cx - w * 0.05, h * 0.5);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3);
    // Round clay body.
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.16, h * 0.24, 0, 0, Math.PI * 2);
    ink(ctx, p, p.wood, 3.4);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.16, h * 0.24, 0, 0, Math.PI * 2);
    ctx.clip();
    hatch(ctx, p, cx - w * 0.02, cy - h * 0.2, w * 0.24, h * 0.5, 7, 0.4, p.woodDark);
    ctx.restore();
    // Rope handle and slow match.
    ctx.beginPath();
    ctx.arc(cx, cy - h * 0.06, w * 0.19, Math.PI * 0.86, Math.PI * 0.14, true);
    ink(ctx, p, null, 3, p.inkSoft);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.16, cy - h * 0.1);
    ctx.quadraticCurveTo(cx + w * 0.34, cy - h * 0.2, cx + w * 0.4, cy - h * 0.46);
    ink(ctx, p, null, 2.6, p.inkSoft);
    dot(ctx, cx + w * 0.4, cy - h * 0.5, Math.min(w, h) * 0.03, p.flame);
    hatch(ctx, p, w * 0.2, h * 0.9, w * 0.55, h * 0.1, 8, 0.3);
  },

  'Signal Flare': (ctx, w, h, p) => {
    // Night sky, hatched thin.
    hatch(ctx, p, 0, 0, w, h * 0.7, 14, 0.14);
    for (const s of [[0.12, 0.2], [0.24, 0.5], [0.86, 0.14], [0.68, 0.1]]) {
      dot(ctx, w * s[0], h * s[1], 1.8, p.inkSoft);
    }
    // Horizon and a distant hull.
    wave(ctx, h * 0.82, 0, w, h * 0.018, 6);
    ink(ctx, p, null, 2.6, p.seaDeep);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.8);
    ctx.lineTo(w * 0.3, h * 0.8);
    ctx.lineTo(w * 0.26, h * 0.88);
    ctx.lineTo(w * 0.14, h * 0.88);
    ctx.closePath();
    ink(ctx, p, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.8);
    ctx.lineTo(w * 0.2, h * 0.66);
    ink(ctx, p, null, 2.4, p.ink);
    // The flare's track, climbing right.
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.78);
    ctx.bezierCurveTo(w * 0.44, h * 0.68, w * 0.56, h * 0.46, w * 0.66, h * 0.3);
    ink(ctx, p, null, 3, p.flame);
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      dot(ctx, w * (0.26 + t * 0.34), h * (0.76 - t * 0.38), 2.4 - t, p.flame);
    }
    // The burst.
    const bx = w * 0.7;
    const by = h * 0.24;
    const br = Math.min(w, h) * 0.2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = i % 2 ? br * 0.36 : br;
      ctx[i ? 'lineTo' : 'moveTo'](bx + Math.cos(a) * rr, by + Math.sin(a) * rr);
    }
    ctx.closePath();
    ink(ctx, p, p.accent, 3);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(bx + Math.cos(a) * br * 1.2, by + Math.sin(a) * br * 1.2);
      ctx.lineTo(bx + Math.cos(a) * br * 1.6, by + Math.sin(a) * br * 1.6);
      ink(ctx, p, null, 2, p.flame);
    }
  },

  'Cutlass': (ctx, w, h, p) => {
    // Blade, sweeping from the lower left to the upper right.
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.66);
    ctx.bezierCurveTo(w * 0.56, h * 0.44, w * 0.78, h * 0.22, w * 0.97, h * 0.1);
    ctx.quadraticCurveTo(w * 0.88, h * 0.3, w * 0.44, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.metal, 3.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.68);
    ctx.bezierCurveTo(w * 0.58, h * 0.48, w * 0.78, h * 0.28, w * 0.93, h * 0.16);
    ink(ctx, p, null, 1.8, p.metalDark);
    // Shell guard and knuckle bow.
    ctx.beginPath();
    ctx.ellipse(w * 0.32, h * 0.72, w * 0.075, h * 0.16, -0.75, 0, Math.PI * 2);
    ink(ctx, p, p.metalDark, 3.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.6);
    ctx.quadraticCurveTo(w * 0.12, h * 0.66, w * 0.16, h * 0.92);
    ink(ctx, p, null, 4, p.metalDark);
    // Grip and pommel.
    capsule(ctx, w * 0.28, h * 0.78, w * 0.14, h * 0.94, Math.min(w, h) * 0.05);
    ink(ctx, p, p.wood, 3);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(w * (0.28 - 0.14 * t) - w * 0.03, h * (0.78 + 0.16 * t) - h * 0.03);
      ctx.lineTo(w * (0.28 - 0.14 * t) + w * 0.03, h * (0.78 + 0.16 * t) + h * 0.04);
      ink(ctx, p, null, 2, p.woodDark);
    }
    ctx.beginPath();
    ctx.arc(w * 0.13, h * 0.95, Math.min(w, h) * 0.055, 0, Math.PI * 2);
    ink(ctx, p, p.accent, 3);
  },

  'Scarlet Flag': (ctx, w, h, p) => {
    // Staff.
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 1.0);
    ctx.lineTo(w * 0.13, h * 0.06);
    ink(ctx, p, null, 5, p.wood);
    ctx.beginPath();
    ctx.moveTo(w * 0.13, h * 0.06);
    ctx.lineTo(w * 0.1, h * 0.14);
    ctx.lineTo(w * 0.16, h * 0.14);
    ctx.closePath();
    ink(ctx, p, p.metal, 2.6);
    // The flag, streaming out with a swallow tail.
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.16);
    ctx.bezierCurveTo(w * 0.42, h * 0.06, w * 0.62, h * 0.3, w * 0.94, h * 0.16);
    ctx.lineTo(w * 0.78, h * 0.42);
    ctx.lineTo(w * 0.94, h * 0.56);
    ctx.bezierCurveTo(w * 0.62, h * 0.7, w * 0.42, h * 0.46, w * 0.15, h * 0.6);
    ctx.closePath();
    ink(ctx, p, p.flame, 3.4);
    // Folds in the cloth.
    for (const f of [0.3, 0.46, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(w * f, h * (0.12 + (f - 0.3) * 0.2));
      ctx.quadraticCurveTo(w * (f + 0.03), h * 0.36, w * f, h * (0.58 + (f - 0.3) * 0.1));
      ink(ctx, p, null, 2, p.woodDark);
    }
    // A band of the card's colour along the hoist.
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.17);
    ctx.lineTo(w * 0.24, h * 0.15);
    ctx.lineTo(w * 0.25, h * 0.58);
    ctx.lineTo(w * 0.155, h * 0.59);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.6);
    // Halyard, slack below.
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.62);
    ctx.quadraticCurveTo(w * 0.3, h * 0.86, w * 0.5, h * 0.8);
    ink(ctx, p, null, 2.2, p.inkSoft);
  },

  // ---------------- onyx ----------------

  'Night Watch': (ctx, w, h, p) => {
    hatch(ctx, p, 0, 0, w, h * 0.68, 6, 0.3, p.ink);
    for (const s of [[0.1, 0.12], [0.3, 0.3], [0.52, 0.1], [0.9, 0.36]]) {
      dot(ctx, w * s[0], h * s[1], 2, p.paper);
    }
    // Rail.
    ctx.beginPath();
    ctx.moveTo(0, h * 0.84);
    ctx.lineTo(w, h * 0.8);
    ink(ctx, p, null, 4, p.woodDark);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(w * (0.06 + i * 0.18), h * 0.83);
      ctx.lineTo(w * (0.06 + i * 0.18), h * 1.0);
      ink(ctx, p, null, 2.6, p.woodDark);
    }
    // The watchman, seen from behind.
    const cx = w * 0.62;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, h * 0.98);
    ctx.quadraticCurveTo(cx - w * 0.12, h * 0.48, cx - w * 0.02, h * 0.42);
    ctx.lineTo(cx + w * 0.07, h * 0.44);
    ctx.quadraticCurveTo(cx + w * 0.14, h * 0.6, cx + w * 0.12, h * 0.98);
    ctx.closePath();
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.arc(cx, h * 0.3, Math.min(w, h) * 0.085, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.24, w * 0.085, h * 0.04, 0.06, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // Arm and the one light aboard.
    capsule(ctx, cx - w * 0.06, h * 0.52, cx - w * 0.2, h * 0.62, Math.min(w, h) * 0.03);
    ink(ctx, p, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.62);
    ctx.lineTo(w * 0.42, h * 0.68);
    ink(ctx, p, null, 2.4, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.68);
    ctx.lineTo(w * 0.48, h * 0.68);
    ctx.lineTo(w * 0.5, h * 0.86);
    ctx.lineTo(w * 0.34, h * 0.86);
    ctx.closePath();
    ink(ctx, p, p.accent, 3);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(w * 0.42, h * 0.77, Math.min(w, h) * 0.24, 0, Math.PI * 2);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
  },

  'Tar Bucket': (ctx, w, h, p) => {
    const cx = w * 0.46;
    // Bucket, staved and hooped.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, h * 0.42);
    ctx.lineTo(cx + w * 0.19, h * 0.42);
    ctx.lineTo(cx + w * 0.14, h * 0.94);
    ctx.lineTo(cx - w * 0.14, h * 0.94);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * w * 0.075, h * 0.44);
      ctx.lineTo(cx + i * w * 0.055, h * 0.92);
      ink(ctx, p, null, 1.6, p.woodDark);
    }
    for (const y of [0.56, 0.78]) {
      ctx.beginPath();
      ctx.moveTo(cx - w * (0.19 - (y - 0.42) * 0.1), h * y);
      ctx.lineTo(cx + w * (0.19 - (y - 0.42) * 0.1), h * y);
      ink(ctx, p, null, 3, p.metalDark);
    }
    // Tar, thick and black, with a drip over the rim.
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.42, w * 0.19, h * 0.07, 0, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.16, h * 0.44);
    ctx.quadraticCurveTo(cx + w * 0.2, h * 0.6, cx + w * 0.16, h * 0.72);
    ctx.quadraticCurveTo(cx + w * 0.12, h * 0.6, cx + w * 0.13, h * 0.44);
    ctx.closePath();
    ink(ctx, p, p.ink, 2.4);
    // Bail.
    ctx.beginPath();
    ctx.arc(cx, h * 0.42, w * 0.19, Math.PI * 1.02, Math.PI * 1.98);
    ink(ctx, p, null, 3, p.metalDark);
    // Tar brush, standing in the bucket.
    capsule(ctx, cx - w * 0.07, h * 0.42, cx - w * 0.2, h * 0.16, Math.min(w, h) * 0.026);
    ink(ctx, p, p.wood, 2.8);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.26, h * 0.16);
    ctx.lineTo(cx - w * 0.15, h * 0.11);
    ctx.lineTo(cx - w * 0.14, h * 0.05);
    ctx.lineTo(cx - w * 0.25, h * 0.1);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.27, h * 0.2);
    ctx.lineTo(cx - w * 0.14, h * 0.14);
    ctx.lineTo(cx - w * 0.13, h * 0.05);
    ctx.lineTo(cx - w * 0.26, h * 0.1);
    ctx.closePath();
    ink(ctx, p, p.ink, 2.8);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - w * (0.235 - i * 0.032), h * (0.115 - i * 0.015));
      ctx.lineTo(cx - w * (0.245 - i * 0.032), h * (0.19 - i * 0.015));
      ink(ctx, p, null, 1.6, p.inkSoft);
    }
  },

  'Black Sash': (ctx, w, h, p) => {
    // Close on the waist: coat skirts either side, cropped top and bottom.
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * -0.02);
    ctx.quadraticCurveTo(w * 0.24, h * 0.4, w * 0.2, h * 1.02);
    ctx.lineTo(w * 0.76, h * 1.02);
    ctx.quadraticCurveTo(w * 0.74, h * 0.4, w * 0.7, h * -0.02);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3.4);
    hatch(ctx, p, w * 0.5, h * 0.05, w * 0.3, h * 0.9, 9, 0.22);
    // The sash, wound twice about the waist.
    ctx.beginPath();
    ctx.moveTo(w * 0.22, h * 0.32);
    ctx.quadraticCurveTo(w * 0.48, h * 0.42, w * 0.75, h * 0.3);
    ctx.lineTo(w * 0.75, h * 0.52);
    ctx.quadraticCurveTo(w * 0.48, h * 0.64, w * 0.21, h * 0.54);
    ctx.closePath();
    ink(ctx, p, p.ink, 3.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.21, h * 0.46);
    ctx.quadraticCurveTo(w * 0.48, h * 0.56, w * 0.75, h * 0.44);
    ink(ctx, p, null, 2.2, p.inkSoft);
    // Knot at the hip, with its tails hanging.
    ctx.beginPath();
    ctx.ellipse(w * 0.68, h * 0.44, w * 0.075, h * 0.14, -0.3, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.7, h * 0.54);
    ctx.bezierCurveTo(w * 0.74, h * 0.7, w * 0.72, h * 0.84, w * 0.78, h * 1.0);
    ctx.lineTo(w * 0.64, h * 1.0);
    ctx.bezierCurveTo(w * 0.62, h * 0.82, w * 0.62, h * 0.68, w * 0.62, h * 0.54);
    ctx.closePath();
    ink(ctx, p, p.ink, 3.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.68, h * 0.6);
    ctx.quadraticCurveTo(w * 0.7, h * 0.8, w * 0.71, h * 0.98);
    ink(ctx, p, null, 2, p.inkSoft);
    // A dull buckle, catching what light there is.
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.36);
    ctx.lineTo(w * 0.44, h * 0.39);
    ctx.lineTo(w * 0.44, h * 0.55);
    ctx.lineTo(w * 0.34, h * 0.52);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.8);
  },

  'Shadow Skiff': (ctx, w, h, p) => {
    // Flat black water.
    for (let i = 0; i < 5; i++) {
      wave(ctx, h * (0.62 + i * 0.09), 0, w, h * 0.014, 5);
      ink(ctx, p, null, 2 + i * 0.3, p.seaDeep);
    }
    // The skiff, a pure silhouette.
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.52);
    ctx.quadraticCurveTo(w * 0.2, h * 0.44, w * 0.26, h * 0.5);
    ctx.lineTo(w * 0.78, h * 0.5);
    ctx.quadraticCurveTo(w * 0.9, h * 0.46, w * 0.92, h * 0.4);
    ctx.quadraticCurveTo(w * 0.86, h * 0.68, w * 0.5, h * 0.7);
    ctx.quadraticCurveTo(w * 0.2, h * 0.7, w * 0.12, h * 0.52);
    ctx.closePath();
    ink(ctx, p, p.ink, 3.2);
    // The rower.
    ctx.beginPath();
    ctx.moveTo(w * 0.44, h * 0.5);
    ctx.quadraticCurveTo(w * 0.46, h * 0.32, w * 0.54, h * 0.3);
    ctx.lineTo(w * 0.58, h * 0.5);
    ctx.closePath();
    ink(ctx, p, p.ink, 3);
    ctx.beginPath();
    ctx.arc(w * 0.52, h * 0.24, Math.min(w, h) * 0.06, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // Oars biting the water.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.4);
      ctx.lineTo(w * (0.5 + s * 0.34), h * (0.62 + s * 0.06));
      ink(ctx, p, null, 3, p.ink);
    }
    // The long reflection.
    hatch(ctx, p, w * 0.14, h * 0.7, w * 0.7, h * 0.26, 7, 0.32, p.ink);
    dot(ctx, w * 0.9, h * 0.42, Math.min(w, h) * 0.03, p.accent);
  },

  'Iron Hook': (ctx, w, h, p) => {
    // Leather cuff, strapped and buckled.
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.26);
    ctx.lineTo(w * 0.3, h * 0.36);
    ctx.lineTo(w * 0.26, h * 0.8);
    ctx.lineTo(w * 0.02, h * 0.68);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.26);
    ctx.lineTo(w * 0.3, h * 0.36);
    ctx.lineTo(w * 0.26, h * 0.8);
    ctx.lineTo(w * 0.02, h * 0.68);
    ctx.closePath();
    ctx.clip();
    hatch(ctx, p, 0, h * 0.2, w * 0.35, h * 0.65, 7, 0.4, p.woodDark);
    ctx.restore();
    for (const y of [0.44, 0.66]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.03, h * (y - 0.06));
      ctx.lineTo(w * 0.29, h * y);
      ink(ctx, p, null, 3, p.woodDark);
      dot(ctx, w * 0.24, h * (y - 0.01), Math.min(w, h) * 0.02, p.metal);
    }
    // Socket.
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.36);
    ctx.lineTo(w * 0.4, h * 0.42);
    ctx.lineTo(w * 0.37, h * 0.74);
    ctx.lineTo(w * 0.25, h * 0.78);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 3.2);
    // The hook itself, a heavy crescent of iron.
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.44);
    ctx.bezierCurveTo(w * 0.72, h * 0.32, w * 0.94, h * 0.5, w * 0.84, h * 0.82);
    ctx.bezierCurveTo(w * 0.82, h * 0.46, w * 0.62, h * 0.44, w * 0.37, h * 0.64);
    ctx.closePath();
    ink(ctx, p, p.metal, 3.4);
    // Point.
    ctx.beginPath();
    ctx.moveTo(w * 0.84, h * 0.82);
    ctx.lineTo(w * 0.76, h * 0.98);
    ctx.lineTo(w * 0.8, h * 0.74);
    ctx.closePath();
    ink(ctx, p, p.metalDark, 2.6);
    dot(ctx, w * 0.45, h * 0.51, Math.min(w, h) * 0.028, p.accent);
  },

  'Coal Store': (ctx, w, h, p) => {
    // The heap, angular lumps piled up in the corner of the hold.
    const lumps = [
      [0.24, 0.7, 0.13], [0.38, 0.62, 0.15], [0.54, 0.68, 0.14],
      [0.68, 0.64, 0.12], [0.45, 0.46, 0.12], [0.3, 0.52, 0.11], [0.6, 0.5, 0.1],
      [0.46, 0.32, 0.09],
    ];
    for (const l of lumps) {
      const x = w * l[0];
      const y = h * l[1];
      const r = Math.min(w, h) * l[2];
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + l[0] * 3;
        const rr = r * (0.7 + ((i * 7 + l[2] * 100) % 5) / 12);
        ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
      }
      ctx.closePath();
      ink(ctx, p, p.ink, 2.8);
      ctx.beginPath();
      ctx.moveTo(x - r * 0.4, y - r * 0.2);
      ctx.lineTo(x + r * 0.1, y - r * 0.5);
      ink(ctx, p, null, 2, p.inkSoft);
    }
    dot(ctx, w * 0.46, h * 0.3, Math.min(w, h) * 0.03, p.accent);
    // The bin boards, standing in front of the heap.
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.64);
    ctx.lineTo(w * 0.09, h * 0.82);
    ctx.lineTo(w * 0.91, h * 0.78);
    ctx.lineTo(w * 0.96, h * 0.6);
    ctx.lineTo(w * 0.96, h * 0.72);
    ctx.lineTo(w * 0.91, h * 0.92);
    ctx.lineTo(w * 0.09, h * 0.96);
    ctx.lineTo(w * 0.04, h * 0.76);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.2);
    for (const x of [0.28, 0.5, 0.72]) {
      ctx.beginPath();
      ctx.moveTo(w * x, h * 0.805);
      ctx.lineTo(w * x, h * 0.945);
      ink(ctx, p, null, 2, p.woodDark);
    }
    // A shovel leaning against the bin.
    capsule(ctx, w * 0.78, h * 0.62, w * 0.94, h * 0.16, Math.min(w, h) * 0.024);
    ink(ctx, p, p.wood, 2.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.71, h * 0.58);
    ctx.lineTo(w * 0.83, h * 0.54);
    ctx.lineTo(w * 0.81, h * 0.78);
    ctx.lineTo(w * 0.7, h * 0.76);
    ctx.closePath();
    ink(ctx, p, p.metal, 2.6);
  },

  'Crows Nest': (ctx, w, h, p) => {
    const cx = w * 0.46;
    // Mast, carried on up past the top.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.032, h * 1.0);
    ctx.lineTo(cx - w * 0.016, h * 0.02);
    ctx.lineTo(cx + w * 0.016, h * 0.02);
    ctx.lineTo(cx + w * 0.032, h * 1.0);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.2);
    // Shrouds, with their ratlines, climbing to the platform.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * w * 0.36, h * 1.0);
      ctx.lineTo(cx + s * w * 0.16, h * 0.66);
      ink(ctx, p, null, 2.6, p.inkSoft);
    }
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const sp = w * (0.36 - t * 0.2);
      ctx.beginPath();
      ctx.moveTo(cx - sp, h * (1.0 - t * 0.34));
      ctx.lineTo(cx + sp, h * (1.0 - t * 0.34));
      ink(ctx, p, null, 1.8, p.inkSoft);
    }
    // Cross-trees.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.21, h * 0.68);
    ctx.lineTo(cx + w * 0.21, h * 0.68);
    ctx.lineTo(cx + w * 0.16, h * 0.76);
    ctx.lineTo(cx - w * 0.16, h * 0.76);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3);
    // The tub itself, flaring out at the rim.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, h * 0.38);
    ctx.lineTo(cx + w * 0.19, h * 0.38);
    ctx.lineTo(cx + w * 0.14, h * 0.69);
    ctx.lineTo(cx - w * 0.14, h * 0.69);
    ctx.closePath();
    ink(ctx, p, p.wood, 3.4);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * w * 0.07, h * 0.4);
      ctx.lineTo(cx + i * w * 0.052, h * 0.68);
      ink(ctx, p, null, 1.6, p.woodDark);
    }
    for (const y of [0.47, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(cx - w * (0.19 - (y - 0.38) * 0.5), h * y);
      ctx.lineTo(cx + w * (0.19 - (y - 0.38) * 0.5), h * y);
      ink(ctx, p, null, 2.8, p.metalDark);
    }
    // The lookout, head and shoulders above the rim.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, h * 0.38);
    ctx.quadraticCurveTo(cx - w * 0.06, h * 0.2, cx + w * 0.05, h * 0.38);
    ctx.closePath();
    ink(ctx, p, p.ink, 3);
    ctx.beginPath();
    ctx.arc(cx - w * 0.05, h * 0.2, Math.min(w, h) * 0.085, 0, Math.PI * 2);
    ink(ctx, p, p.ink, 3);
    // A pennant at the masthead.
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.015, h * 0.04);
    ctx.quadraticCurveTo(cx + w * 0.18, h * 0.04, cx + w * 0.3, h * 0.1);
    ctx.lineTo(cx + w * 0.015, h * 0.16);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.6);
  },

  'Grave Compass': (ctx, w, h, p) => {
    const cx = w * 0.44;
    const cy = h * 0.56;
    const r = Math.min(w, h) * 0.38;
    // The hinged lid, thrown back.
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.06, cy - r * 0.9);
    ctx.lineTo(cx + w * 0.34, cy - r * 1.5);
    ctx.lineTo(cx + w * 0.44, cy - r * 0.3);
    ctx.lineTo(cx + w * 0.16, cy + r * 0.2);
    ctx.closePath();
    ink(ctx, p, p.woodDark, 3.2);
    // Brass bowl.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ink(ctx, p, p.metal, 3.6);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
    ink(ctx, p, p.paper, 2.6, p.metalDark);
    // Rose marks.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const inner = i % 4 === 0 ? 0.6 : 0.72;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * inner, cy + Math.sin(a) * r * inner);
      ctx.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
      ink(ctx, p, null, i % 4 === 0 ? 2.4 : 1.4, p.inkSoft);
    }
    // Needle, north picked out in the card's colour.
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.32, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.12, cy + r * 0.08);
    ctx.lineTo(cx - r * 0.1, cy - r * 0.16);
    ctx.closePath();
    ink(ctx, p, p.accent, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.32, cy + r * 0.5);
    ctx.lineTo(cx - r * 0.12, cy - r * 0.08);
    ctx.lineTo(cx + r * 0.1, cy + r * 0.16);
    ctx.closePath();
    ink(ctx, p, p.ink, 2.6);
    dot(ctx, cx, cy, r * 0.09, p.metalDark);
    // The cracked glass.
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.82, cy - r * 0.26);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.3, cy + r * 0.76);
    ctx.moveTo(cx - r * 0.1, cy + r * 0.1);
    ctx.lineTo(cx + r * 0.52, cy - r * 0.6);
    ink(ctx, p, null, 2, p.inkSoft);
    hatch(ctx, p, w * 0.12, h * 0.9, w * 0.6, h * 0.1, 8, 0.3);
  },
};
