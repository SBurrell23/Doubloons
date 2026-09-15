// ============================================================
// Pirate Lord portraits.
//
// The same engraved hand as the three card tiers, turned on the
// people instead of the sea: head-and-shoulders cut straight onto
// the bare parchment, heavy ink outlines, woodcut hatching for the
// shadow. No panel-wide backgrounds — the paper is the air behind
// them. Each Lord is built to be told apart by silhouette alone:
// hat, hair, beard, and the one thing they carry.
//
// Each function receives (ctx, w, h, p):
//   ctx — already translated to the panel's top-left and clipped
//   w,h — panel size in pixels (~332 x 214); never hard-coded
//   p   — the shared ink palette, plus p.accent for this Lord
//
// Note on order: every helper below begins its own path, so any
// shape that wants an outline must be filled AND stroked before a
// helper is called. Outline first, then clip and shade.
// ============================================================

const TAU = Math.PI * 2;

/** Set up a stroke in the engraved house style. */
function pen(ctx, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/**
 * Parallel hatching across a rectangle. Callers clip to a shape
 * first when the shading has to stay inside it.
 */
function hatch(ctx, color, x, y, bw, bh, step, slope, alpha, lw) {
  ctx.save();
  ctx.globalAlpha = alpha;
  pen(ctx, color, lw);
  ctx.beginPath();
  const span = Math.abs(slope) * bh + step;
  for (let i = -span; i <= bw + span; i += step) {
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i + slope * bh, y + bh);
  }
  ctx.stroke();
  ctx.restore();
}

/** Rolling chart-style sea, drawn as rows of shallow scallops. */
function seaLines(ctx, color, w, y, rows, gap, amp, alpha, lw) {
  ctx.save();
  ctx.globalAlpha = alpha;
  pen(ctx, color, lw);
  ctx.beginPath();
  for (let r = 0; r < rows; r++) {
    const yy = y + r * gap;
    const step = w / 6;
    ctx.moveTo(-step, yy);
    for (let x = -step; x < w + step; x += step) {
      ctx.quadraticCurveTo(x + step * 0.25, yy - amp, x + step * 0.5, yy);
      ctx.quadraticCurveTo(x + step * 0.75, yy + amp, x + step, yy);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** A drift of rising bubbles. */
function bubbles(ctx, color, spots, alpha, lw) {
  ctx.save();
  ctx.globalAlpha = alpha;
  pen(ctx, color, lw);
  for (const s of spots) {
    ctx.beginPath();
    ctx.arc(s[0], s[1], s[2], 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

/** A soft radial bloom, for lanterns and moonlight. */
function glow(ctx, cx, cy, r, color, alpha) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/**
 * The head: a skull-wide brow tapering to a chin. `jaw` runs from
 * about 0.3 (gaunt, pointed) to 1.0 (square and lantern-like).
 */
function head(ctx, cx, cy, rx, ry, jaw) {
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - ry * 0.08);
  ctx.bezierCurveTo(cx - rx, cy - ry * 1.2, cx + rx, cy - ry * 1.2, cx + rx, cy - ry * 0.08);
  ctx.bezierCurveTo(
    cx + rx * (0.5 + jaw * 0.5), cy + ry * 0.58,
    cx + rx * jaw, cy + ry * 1.02,
    cx, cy + ry * 1.06
  );
  ctx.bezierCurveTo(
    cx - rx * jaw, cy + ry * 1.02,
    cx - rx * (0.5 + jaw * 0.5), cy + ry * 0.58,
    cx - rx, cy - ry * 0.08
  );
  ctx.closePath();
}

/** Neck and shoulders, running off the bottom of the panel. */
function bust(ctx, h, cx, neckW, topY, spreadL, spreadR, slope) {
  const drop = h * 1.06;
  ctx.beginPath();
  ctx.moveTo(cx - spreadL, drop);
  ctx.quadraticCurveTo(cx - spreadL * 0.9, topY + (drop - topY) * slope, cx - neckW, topY);
  ctx.lineTo(cx + neckW, topY);
  ctx.quadraticCurveTo(cx + spreadR * 0.9, topY + (drop - topY) * slope, cx + spreadR, drop);
  ctx.closePath();
}

/** A pair of eyes: pale whites, dark pupils. */
function eyes(ctx, p, cx, y, sep, rx, ry, pr) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * sep, y, rx, ry, 0, 0, TAU);
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * sep, y, pr, 0, TAU);
    ctx.fillStyle = p.ink;
    ctx.fill();
  }
}

/**
 * A tapering strand — hair, kelp, a feather — rooted on the head's
 * ellipse at angle `a` and running out to the point (tx, ty). `bend`
 * displaces the midpoint, which is what turns a spike into a curl.
 */
function strand(ctx, cx, cy, rx, ry, a, spread, tx, ty, bend) {
  const bx0 = cx + Math.cos(a - spread) * rx;
  const by0 = cy + Math.sin(a - spread) * ry;
  const bx1 = cx + Math.cos(a + spread) * rx;
  const by1 = cy + Math.sin(a + spread) * ry;
  const ox = cx + Math.cos(a) * rx;
  const oy = cy + Math.sin(a) * ry;
  const mx = (ox + tx) / 2 + bend[0];
  const my = (oy + ty) / 2 + bend[1];
  ctx.beginPath();
  ctx.moveTo(bx0, by0);
  ctx.quadraticCurveTo(mx, my, tx, ty);
  ctx.quadraticCurveTo(mx + (bx1 - bx0) * 0.7, my + (by1 - by0) * 0.7, bx1, by1);
  ctx.closePath();
}

/** A pointed leaf growing from (x, y) along `ang`. */
function leafShape(ctx, x, y, ang, len, wid) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const px = -dy;
  const py = dx;
  const hx = x + dx * len * 0.5;
  const hy = y + dy * len * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(hx + px * wid, hy + py * wid, x + dx * len, y + dy * len);
  ctx.quadraticCurveTo(hx - px * wid, hy - py * wid, x, y);
  ctx.closePath();
}

/** A braid: a chain of lozenges walked along a list of points. */
function braid(ctx, pts, wid, fill, ink) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const k = wid * (1 - i / (pts.length * 1.6));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx + k, my, x1, y1);
    ctx.quadraticCurveTo(mx - k, my, x0, y0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    pen(ctx, ink, 1.8);
    ctx.stroke();
  }
}

/** A long bone, knobbed at both ends. */
function bone(ctx, x0, y0, x1, y1, r, fill, ink) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  pen(ctx, fill, r * 1.2);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.fillStyle = fill;
  for (const e of [[x0, y0], [x1, y1]]) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(e[0] + px * r * 0.62, e[1] + py * r * 0.62, r * 0.8, 0, TAU);
      ctx.fill();
      pen(ctx, ink, 1.6);
      ctx.stroke();
      // second knob, mirrored across the shaft
      ctx.beginPath();
      ctx.arc(e[0] - px * r * 0.62 * s, e[1] - py * r * 0.62 * s, r * 0.8, 0, TAU);
      ctx.fill();
      pen(ctx, ink, 1.6);
      ctx.stroke();
    }
  }
  pen(ctx, ink, 1.6);
  ctx.beginPath();
  ctx.moveTo(x0 + px * r * 0.58, y0 + py * r * 0.58);
  ctx.lineTo(x1 + px * r * 0.58, y1 + py * r * 0.58);
  ctx.moveTo(x0 - px * r * 0.58, y0 - py * r * 0.58);
  ctx.lineTo(x1 - px * r * 0.58, y1 - py * r * 0.58);
  ctx.stroke();
}

/** A gull in flight: two swept arcs. */
function gull(ctx, x, y, s, color, lw) {
  pen(ctx, color, lw);
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.62, x, y - s * 0.08);
  ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.62, x + s, y);
  ctx.stroke();
}

export const LORD_ART = {
  // ----------------------------------------------------------
  // Mad Jack Corrow, the Reefbreaker — all wind and teeth
  // ----------------------------------------------------------

  'Mad Jack Corrow': (ctx, w, h, p) => {
    const cx = w * 0.45;
    const hy = h * 0.45;
    const rx = w * 0.098;
    const ry = h * 0.185;

    // Weather first: driving rain, a reef fang, a breaking sea.
    hatch(ctx, p.inkSoft, -w * 0.2, 0, w * 1.4, h, w * 0.055, -0.5, 0.17, 1.3);
    ctx.beginPath();
    ctx.moveTo(w * 0.79, h * 1.02);
    ctx.lineTo(w * 0.86, h * 0.34);
    ctx.lineTo(w * 0.92, h * 0.6);
    ctx.lineTo(w * 0.97, h * 0.26);
    ctx.lineTo(w * 1.06, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 2.6);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, w * 0.76, h * 0.2, w * 0.34, h, w * 0.035, 0.3, 0.3, 1.4);
    ctx.restore();
    seaLines(ctx, p.sea, w, h * 0.9, 2, h * 0.08, h * 0.03, 0.5, 2);

    // A single fork of lightning, the one flash of colour.
    pen(ctx, p.accent, 3);
    ctx.beginPath();
    ctx.moveTo(w * 0.09, h * 0.02);
    ctx.lineTo(w * 0.15, h * 0.2);
    ctx.lineTo(w * 0.1, h * 0.22);
    ctx.lineTo(w * 0.17, h * 0.44);
    ctx.stroke();

    // Torn coat, shoulders hunched into the gale.
    bust(ctx, h, cx, rx * 0.5, hy + ry * 0.95, w * 0.28, w * 0.3, 0.2);
    ctx.fillStyle = p.ink;
    ctx.fill();
    // Ragged collar flapping open.
    ctx.fillStyle = p.woodDark;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.6, hy + ry);
    ctx.lineTo(cx - w * 0.14, h * 0.88);
    ctx.lineTo(cx - w * 0.03, h * 1.06);
    ctx.lineTo(cx + w * 0.02, hy + ry * 1.2);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.line, 2.4);
    ctx.stroke();

    // Hair: one mass dragged off the scalp and torn out to leeward,
    // its trailing edge ragged. Drawn as a single shape so it reads
    // as weather rather than as spikes.
    ctx.beginPath();
    ctx.moveTo(cx + rx * 1.0, hy - ry * 0.1);
    ctx.quadraticCurveTo(cx + rx * 0.5, hy - ry * 1.5, cx - rx * 0.5, hy - ry * 1.4);
    ctx.quadraticCurveTo(cx - w * 0.14, hy - ry * 1.95, cx - w * 0.31, hy - ry * 1.55);
    ctx.quadraticCurveTo(cx - w * 0.16, hy - ry * 1.25, cx - w * 0.3, hy - ry * 0.75);
    ctx.quadraticCurveTo(cx - w * 0.15, hy - ry * 0.55, cx - w * 0.29, hy - ry * 0.05);
    ctx.quadraticCurveTo(cx - w * 0.14, hy + ry * 0.05, cx - w * 0.23, hy + ry * 0.6);
    ctx.quadraticCurveTo(cx - rx * 1.5, hy + ry * 0.45, cx - rx * 1.04, hy - ry * 0.15);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();
    // A few strands flying clear of the mass.
    ctx.fillStyle = p.ink;
    for (const g of [[-2.5, -0.38, -1.95], [-1.85, -0.34, -2.5], [-1.3, -0.2, -2.35]]) {
      strand(
        ctx, cx, hy, rx, ry, g[0], 0.12,
        cx + w * g[1], hy + ry * g[2],
        [-w * 0.04, -ry * 0.5]
      );
      ctx.fill();
      pen(ctx, p.ink, 2);
      ctx.stroke();
    }

    // Head.
    head(ctx, cx, hy, rx, ry, 0.62);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, cx - rx, hy - ry, rx * 2.2, ry * 2.4, rx * 0.3, 0.4, 0.25, 1.2);
    ctx.restore();

    // Wild eyes — whites showing all round.
    eyes(ctx, p, cx, hy - ry * 0.2, rx * 0.46, rx * 0.3, ry * 0.19, rx * 0.15);
    pen(ctx, p.ink, 2.8);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.86, hy - ry * 0.6);
    ctx.lineTo(cx - rx * 0.12, hy - ry * 0.42);
    ctx.moveTo(cx + rx * 0.12, hy - ry * 0.46);
    ctx.lineTo(cx + rx * 0.88, hy - ry * 0.68);
    ctx.stroke();
    // Nose.
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.02, hy - ry * 0.18);
    ctx.lineTo(cx - rx * 0.16, hy + ry * 0.24);
    ctx.lineTo(cx + rx * 0.1, hy + ry * 0.28);
    ctx.stroke();
    // A roaring mouth, teeth bared.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.44, hy + ry * 0.5);
    ctx.quadraticCurveTo(cx, hy + ry * 0.42, cx + rx * 0.44, hy + ry * 0.5);
    ctx.quadraticCurveTo(cx, hy + ry * 0.96, cx - rx * 0.44, hy + ry * 0.5);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.sail, 1.6);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = cx - rx * 0.24 + i * rx * 0.24;
      ctx.moveTo(x, hy + ry * 0.48);
      ctx.lineTo(x, hy + ry * 0.62);
    }
    ctx.stroke();
    // Scar down the cheek.
    pen(ctx, p.line, 2);
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.62, hy - ry * 0.34);
    ctx.lineTo(cx + rx * 0.5, hy + ry * 0.34);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // Dame Isolde Vane, the Threefold — tricorne and lace
  // ----------------------------------------------------------

  'Dame Isolde Vane': (ctx, w, h, p) => {
    const cx = w * 0.5;
    // Set low: the cocked front corner of the tricorne comes down
    // almost to the brow, so the face has to clear it.
    const hy = h * 0.55;
    const rx = w * 0.09;
    const ry = h * 0.165;

    hatch(ctx, p.inkSoft, -w * 0.1, h * 0.1, w * 1.2, h * 0.9, w * 0.07, 0.3, 0.1, 1.2);

    // Lace ruff: a ring of scalloped lobes set about the neck. Laid
    // down before the bodice, so only the scalloped rim shows.
    const ny = h * 0.72;
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * (0.08 + (i / 10) * 0.84);
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * w * 0.175,
        ny + Math.sin(a) * h * 0.18,
        w * 0.042, h * 0.05, a, 0, TAU
      );
      ctx.fillStyle = p.sail;
      ctx.fill();
      pen(ctx, p.ink, 2.2);
      ctx.stroke();
    }

    // Bodice over the top of it.
    bust(ctx, h, cx, rx * 0.46, hy + ry * 0.98, w * 0.17, w * 0.17, 0.26);
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.4);
    ctx.stroke();
    // Cross-lacing down the front.
    pen(ctx, p.sail, 1.8);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = h * 0.88 + i * h * 0.055;
      ctx.moveTo(cx - w * 0.035, y);
      ctx.lineTo(cx + w * 0.035, y + h * 0.035);
      ctx.moveTo(cx + w * 0.035, y);
      ctx.lineTo(cx - w * 0.035, y + h * 0.035);
    }
    ctx.stroke();

    // Hair, drawn up and pinned, with ringlets loose at the temples.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      for (const c of [[-0.1, 1.2, 0.7], [0.35, 1.0, 1.2]]) {
        strand(
          ctx, cx, hy, rx, ry, s > 0 ? c[0] : Math.PI - c[0], 0.17,
          cx + s * rx * c[1], hy + ry * c[2],
          [s * rx * 0.55, -ry * 0.1]
        );
        ctx.fill();
        pen(ctx, p.ink, 2);
        ctx.stroke();
      }
    }

    // Head — composed, level, faintly amused.
    head(ctx, cx, hy, rx, ry, 0.5);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, cx - rx, hy - ry, rx * 2.2, ry * 2.4, rx * 0.34, -0.4, 0.2, 1.2);
    ctx.restore();

    eyes(ctx, p, cx, hy - ry * 0.16, rx * 0.45, rx * 0.28, ry * 0.15, rx * 0.13);
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.78, hy - ry * 0.52);
    ctx.quadraticCurveTo(cx - rx * 0.44, hy - ry * 0.64, cx - rx * 0.1, hy - ry * 0.46);
    ctx.moveTo(cx + rx * 0.1, hy - ry * 0.46);
    ctx.quadraticCurveTo(cx + rx * 0.44, hy - ry * 0.64, cx + rx * 0.78, hy - ry * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.04, hy - ry * 0.1);
    ctx.lineTo(cx - rx * 0.14, hy + ry * 0.28);
    ctx.lineTo(cx + rx * 0.08, hy + ry * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.26, hy + ry * 0.58);
    ctx.quadraticCurveTo(cx, hy + ry * 0.68, cx + rx * 0.26, hy + ry * 0.56);
    ctx.stroke();

    // The tricorne: three hard points, worn square.
    // Two side corners and a third cocked forward over the brow.
    const bx = w * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - bx, h * 0.28);
    ctx.quadraticCurveTo(cx - bx * 0.52, h * 0.02, cx, h * 0.04);
    ctx.quadraticCurveTo(cx + bx * 0.52, h * 0.02, cx + bx, h * 0.28);
    ctx.quadraticCurveTo(cx + bx * 0.46, h * 0.36, cx, h * 0.48);
    ctx.quadraticCurveTo(cx - bx * 0.46, h * 0.36, cx - bx, h * 0.28);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    // The crown standing behind the cocked brim.
    pen(ctx, p.inkSoft, 2);
    ctx.beginPath();
    ctx.moveTo(cx - bx * 0.44, h * 0.26);
    ctx.quadraticCurveTo(cx, h * 0.07, cx + bx * 0.44, h * 0.26);
    ctx.stroke();

    // The threefold badge: three lobes about a common centre.
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.ellipse(
        cx + Math.cos(a) * w * 0.025,
        h * 0.23 + Math.sin(a) * h * 0.035,
        w * 0.024, h * 0.036, a + Math.PI / 2, 0, TAU
      );
      ctx.fill();
      pen(ctx, p.ink, 1.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, h * 0.23, Math.min(w, h) * 0.018, 0, TAU);
    ctx.fillStyle = p.gold;
    ctx.fill();
    pen(ctx, p.ink, 1.8);
    ctx.stroke();

    // Three pearls on a cord, told against the black of the bodice.
    pen(ctx, p.sail, 1.6);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.78);
    ctx.quadraticCurveTo(cx, h * 0.86, cx + w * 0.06, h * 0.78);
    ctx.stroke();
    ctx.fillStyle = p.sail;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(
        cx - w * 0.045 + i * w * 0.045,
        h * 0.825 + Math.abs(i - 1) * h * -0.022,
        Math.min(w, h) * 0.024, 0, TAU
      );
      ctx.fill();
      pen(ctx, p.ink, 1.8);
      ctx.stroke();
    }
  },

  // ----------------------------------------------------------
  // Capt. Bellweather, the Pale Hand — gaunt, still, raised palm
  // ----------------------------------------------------------

  'Capt. Bellweather': (ctx, w, h, p) => {
    const cx = w * 0.38;
    const hy = h * 0.45;
    const rx = w * 0.078;
    const ry = h * 0.2;

    hatch(ctx, p.inkSoft, -w * 0.1, 0, w * 1.2, h, w * 0.09, 0.08, 0.13, 1.2);

    // Long coat and narrow shoulders — a thin man in black.
    bust(ctx, h, cx, rx * 0.5, hy + ry * 0.98, w * 0.19, w * 0.2, 0.3);
    ctx.fillStyle = p.ink;
    ctx.fill();
    // Flat turned-down collar, laid across the shoulders.
    ctx.fillStyle = p.woodDark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 0.5, hy + ry * 0.98);
      ctx.quadraticCurveTo(cx + s * rx * 1.5, hy + ry * 1.1, cx + s * rx * 2.2, hy + ry * 1.75);
      ctx.quadraticCurveTo(cx + s * rx * 1.1, hy + ry * 1.9, cx + s * rx * 0.4, hy + ry * 1.5);
      ctx.closePath();
      ctx.fill();
      pen(ctx, p.line, 2.4);
      ctx.stroke();
    }

    // Lank hair, hanging dead straight past the jaw.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      for (const c of [[-0.35, 1.3, 1.45], [0.12, 1.1, 1.85]]) {
        strand(
          ctx, cx, hy, rx, ry, s > 0 ? c[0] : Math.PI - c[0], 0.3,
          cx + s * rx * c[1], hy + ry * c[2],
          [s * rx * 0.3, ry * 0.1]
        );
        ctx.fill();
        pen(ctx, p.ink, 2);
        ctx.stroke();
      }
    }

    // Head: long, hollow, jaw drawn to a point.
    head(ctx, cx, hy, rx, ry, 0.34);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    // Sunken cheeks: hatching pressed in from both sides.
    hatch(ctx, p.ink, cx - rx * 1.1, hy + ry * 0.05, rx * 0.7, ry * 0.9, rx * 0.2, 0.2, 0.3, 1.3);
    hatch(ctx, p.ink, cx + rx * 0.45, hy + ry * 0.05, rx * 0.7, ry * 0.9, rx * 0.2, -0.2, 0.3, 1.3);
    hatch(ctx, p.inkSoft, cx - rx, hy - ry * 1.2, rx * 2.2, ry * 0.8, rx * 0.3, 0.3, 0.2, 1.2);
    ctx.restore();

    // Half-lidded eyes. No whites — just level slits and a pupil.
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.86, hy - ry * 0.2);
    ctx.lineTo(cx - rx * 0.16, hy - ry * 0.2);
    ctx.moveTo(cx + rx * 0.16, hy - ry * 0.2);
    ctx.lineTo(cx + rx * 0.86, hy - ry * 0.2);
    ctx.stroke();
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * rx * 0.5, hy - ry * 0.13, rx * 0.15, 0, TAU);
      ctx.fill();
    }
    // Deep shadow beneath the brow.
    pen(ctx, p.line, 2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.8, hy - ry * 0.48);
    ctx.lineTo(cx - rx * 0.2, hy - ry * 0.44);
    ctx.moveTo(cx + rx * 0.2, hy - ry * 0.44);
    ctx.lineTo(cx + rx * 0.8, hy - ry * 0.48);
    ctx.stroke();
    // Blade of a nose, thin set mouth.
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx, hy - ry * 0.12);
    ctx.lineTo(cx - rx * 0.12, hy + ry * 0.3);
    ctx.lineTo(cx + rx * 0.14, hy + ry * 0.32);
    ctx.moveTo(cx - rx * 0.32, hy + ry * 0.62);
    ctx.lineTo(cx + rx * 0.32, hy + ry * 0.6);
    ctx.stroke();

    // A low, hard hat: narrow brim, tall flat crown.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.85, h * 0.23);
    ctx.quadraticCurveTo(cx, h * 0.29, cx + rx * 1.85, h * 0.23);
    ctx.quadraticCurveTo(cx, h * 0.16, cx - rx * 1.85, h * 0.23);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.05, h * 0.21);
    ctx.lineTo(cx - rx * 0.95, h * 0.02);
    ctx.lineTo(cx + rx * 0.95, h * 0.02);
    ctx.lineTo(cx + rx * 1.05, h * 0.21);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.6);
    ctx.stroke();
    pen(ctx, p.accent, 3);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.0, h * 0.16);
    ctx.lineTo(cx + rx * 1.0, h * 0.16);
    ctx.stroke();

    // The pale hand, raised open beside him — the whole point.
    const px = w * 0.75;
    const py = h * 0.5;
    const s = Math.min(w, h) * 0.088;
    // Cuff first, so the hand sits on top of it.
    ctx.beginPath();
    ctx.moveTo(px - s * 0.8, py + s * 1.1);
    ctx.lineTo(px + s * 0.9, py + s * 1.0);
    ctx.lineTo(px + s * 1.2, h * 1.06);
    ctx.lineTo(px - s * 1.2, h * 1.06);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.4);
    ctx.stroke();
    // Palm.
    ctx.beginPath();
    ctx.moveTo(px - s * 0.78, py + s * 0.2);
    ctx.quadraticCurveTo(px - s * 0.9, py + s * 1.05, px - s * 0.1, py + s * 1.18);
    ctx.quadraticCurveTo(px + s * 0.82, py + s * 1.1, px + s * 0.78, py + s * 0.15);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    // Four fingers and a thumb, all outlined before any shading.
    const fing = [[-0.58, 1.25], [-0.2, 1.5], [0.2, 1.45], [0.56, 1.2]];
    for (const f of fing) {
      ctx.beginPath();
      ctx.moveTo(px + s * (f[0] - 0.18), py + s * 0.3);
      ctx.lineTo(px + s * (f[0] - 0.16), py - s * f[1]);
      ctx.quadraticCurveTo(px + s * f[0], py - s * (f[1] + 0.28), px + s * (f[0] + 0.16), py - s * f[1]);
      ctx.lineTo(px + s * (f[0] + 0.18), py + s * 0.3);
      ctx.closePath();
      ctx.fillStyle = p.sail;
      ctx.fill();
      pen(ctx, p.ink, 2.4);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(px + s * 0.72, py + s * 0.72);
    ctx.quadraticCurveTo(px + s * 1.4, py + s * 0.3, px + s * 1.28, py - s * 0.3);
    ctx.quadraticCurveTo(px + s * 0.98, py - s * 0.24, px + s * 0.86, py + s * 0.2);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // Rasha Coldwater, the Vine Queen — leaves, braids, thorns
  // ----------------------------------------------------------

  'Rasha Coldwater': (ctx, w, h, p) => {
    const cx = w * 0.47;
    const hy = h * 0.48;
    const rx = w * 0.096;
    const ry = h * 0.178;

    hatch(ctx, p.leaf, -w * 0.1, h * 0.2, w * 1.2, h * 0.9, w * 0.06, -0.35, 0.12, 1.3);

    // A thorned vine climbing the right of the panel.
    pen(ctx, p.woodDark, 3);
    ctx.beginPath();
    ctx.moveTo(w * 1.0, h * 1.0);
    ctx.bezierCurveTo(w * 0.86, h * 0.72, w * 0.94, h * 0.4, w * 0.82, h * 0.06);
    ctx.stroke();
    pen(ctx, p.woodDark, 2.2);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = w * (0.99 - t * 0.16) + Math.sin(t * 4) * w * 0.02;
      const y = h * (0.98 - t * 0.92);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.035, y - h * 0.035);
    }
    ctx.stroke();
    ctx.fillStyle = p.leaf;
    for (const l of [[w * 0.9, h * 0.66, -0.4], [w * 0.87, h * 0.36, -2.6], [w * 0.84, h * 0.16, -0.7]]) {
      leafShape(ctx, l[0], l[1], l[2], w * 0.075, h * 0.035);
      ctx.fill();
      pen(ctx, p.ink, 2);
      ctx.stroke();
    }

    // Shoulders, bare, wrapped in a woven mantle.
    bust(ctx, h, cx, rx * 0.52, hy + ry * 0.98, w * 0.24, w * 0.24, 0.22);
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.6, w, h * 0.5, w * 0.035, 0.45, 0.3, 1.5);
    hatch(ctx, p.ink, 0, h * 0.6, w, h * 0.5, w * 0.035, -0.45, 0.3, 1.5);
    ctx.restore();

    // Two heavy braids falling forward over the shoulders.
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push([
          cx + s * (rx * 0.95 + t * rx * 0.75) + s * Math.sin(t * 3) * rx * 0.18,
          hy + ry * 0.1 + t * h * 0.55,
        ]);
      }
      braid(ctx, pts, rx * 0.64, p.ink, p.line);
    }

    // Head.
    head(ctx, cx, hy, rx, ry, 0.6);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, cx - rx, hy - ry, rx * 2.2, ry * 2.4, rx * 0.26, 0.45, 0.22, 1.2);
    ctx.restore();

    // Steady gaze.
    eyes(ctx, p, cx, hy - ry * 0.18, rx * 0.46, rx * 0.29, ry * 0.17, rx * 0.14);
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.84, hy - ry * 0.56);
    ctx.lineTo(cx - rx * 0.12, hy - ry * 0.48);
    ctx.moveTo(cx + rx * 0.12, hy - ry * 0.48);
    ctx.lineTo(cx + rx * 0.84, hy - ry * 0.56);
    ctx.stroke();
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.02, hy - ry * 0.1);
    ctx.lineTo(cx - rx * 0.16, hy + ry * 0.28);
    ctx.lineTo(cx + rx * 0.1, hy + ry * 0.3);
    ctx.moveTo(cx - rx * 0.3, hy + ry * 0.6);
    ctx.quadraticCurveTo(cx, hy + ry * 0.7, cx + rx * 0.3, hy + ry * 0.58);
    ctx.stroke();
    // Tattoo bars on the cheekbone.
    pen(ctx, p.line, 2);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      ctx.moveTo(cx + rx * (0.5 + i * 0.13), hy + ry * 0.04);
      ctx.lineTo(cx + rx * (0.44 + i * 0.13), hy + ry * 0.3);
    }
    ctx.stroke();

    // The crown of leaves, springing from a woven band.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.06, hy - ry * 0.62);
    ctx.quadraticCurveTo(cx, hy - ry * 0.4, cx + rx * 1.06, hy - ry * 0.62);
    ctx.quadraticCurveTo(cx, hy - ry * 0.92, cx - rx * 1.06, hy - ry * 0.62);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 2.6);
    ctx.stroke();
    ctx.fillStyle = p.leaf;
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const a = Math.PI * (1.08 + t * 0.84);
      const bx = cx + Math.cos(a) * rx * 1.02;
      const by = hy + Math.sin(a) * ry * 1.02;
      const len = (i % 2 ? 0.8 : 1.15) * Math.min(w, h) * 0.13;
      leafShape(ctx, bx, by, a + (t - 0.5) * 0.5, len, Math.min(w, h) * 0.03);
      ctx.fill();
      pen(ctx, p.ink, 2.2);
      ctx.stroke();
    }
    // One blossom at the temple, the single note of colour.
    ctx.fillStyle = p.accent;
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      ctx.beginPath();
      ctx.ellipse(
        cx - rx * 1.05 + Math.cos(a) * w * 0.017,
        hy - ry * 0.5 + Math.sin(a) * w * 0.017,
        w * 0.017, w * 0.013, a, 0, TAU
      );
      ctx.fill();
      pen(ctx, p.ink, 1.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx - rx * 1.05, hy - ry * 0.5, Math.min(w, h) * 0.014, 0, TAU);
    ctx.fillStyle = p.gold;
    ctx.fill();
    pen(ctx, p.ink, 1.6);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // Old Tom Sixpence, the Bone Broker — bald, white-bearded, grinning
  // ----------------------------------------------------------

  'Old Tom Sixpence': (ctx, w, h, p) => {
    const cx = w * 0.42;
    const hy = h * 0.42;
    const rx = w * 0.092;
    const ry = h * 0.165;

    hatch(ctx, p.inkSoft, -w * 0.1, h * 0.15, w * 1.2, h * 0.9, w * 0.08, -0.2, 0.1, 1.2);

    // Bones hanging on cords in the corner of his stall.
    pen(ctx, p.line, 1.8);
    ctx.beginPath();
    ctx.moveTo(w * 0.86, 0);
    ctx.lineTo(w * 0.86, h * 0.2);
    ctx.moveTo(w * 0.96, 0);
    ctx.lineTo(w * 0.96, h * 0.34);
    ctx.stroke();
    bone(ctx, w * 0.8, h * 0.24, w * 0.92, h * 0.28, Math.min(w, h) * 0.028, p.sail, p.ink);
    bone(ctx, w * 0.92, h * 0.38, w * 1.0, h * 0.46, Math.min(w, h) * 0.024, p.sail, p.ink);

    // Hunched shoulders, one higher than the other.
    bust(ctx, h, cx, rx * 0.5, hy + ry * 1.05, w * 0.26, w * 0.3, 0.14);
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.55, w, h * 0.6, w * 0.03, 0.4, 0.28, 1.4);
    ctx.restore();

    // Necklace of small bones across the chest.
    pen(ctx, p.line, 1.8);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, h * 0.74);
    ctx.quadraticCurveTo(cx, h * 0.86, cx + w * 0.12, h * 0.73);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = cx - w * 0.1 + t * w * 0.2;
      const y = h * 0.78 + Math.sin(t * Math.PI) * h * 0.05;
      bone(ctx, x - w * 0.012, y, x + w * 0.012, y + h * 0.05, Math.min(w, h) * 0.017, p.sail, p.ink);
    }

    // White tufts puffing out over the ears — the rest of him is bald.
    ctx.fillStyle = p.sail;
    for (const s of [-1, 1]) {
      for (const c of [[0.0, 1.42, 0.2], [0.48, 1.3, 0.72]]) {
        strand(
          ctx, cx, hy, rx, ry, s > 0 ? c[0] : Math.PI - c[0], 0.24,
          cx + s * rx * c[1], hy + ry * c[2],
          [s * rx * 0.55, -ry * 0.35]
        );
        ctx.fill();
        pen(ctx, p.ink, 2);
        ctx.stroke();
      }
    }

    // Head, tipped forward.
    head(ctx, cx, hy, rx, ry, 0.66);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, cx - rx, hy - ry * 1.2, rx * 2.2, ry * 2.4, rx * 0.22, 0.5, 0.24, 1.2);
    ctx.restore();

    // Deep-set squinting eyes under tangled brows.
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.86, hy - ry * 0.18);
    ctx.quadraticCurveTo(cx - rx * 0.5, hy - ry * 0.4, cx - rx * 0.14, hy - ry * 0.16);
    ctx.moveTo(cx + rx * 0.14, hy - ry * 0.16);
    ctx.quadraticCurveTo(cx + rx * 0.5, hy - ry * 0.4, cx + rx * 0.86, hy - ry * 0.18);
    ctx.stroke();
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * rx * 0.5, hy - ry * 0.2, rx * 0.13, 0, TAU);
      ctx.fill();
    }
    pen(ctx, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.96, hy - ry * 0.56);
    ctx.quadraticCurveTo(cx - rx * 0.5, hy - ry * 0.74, cx - rx * 0.08, hy - ry * 0.46);
    ctx.moveTo(cx + rx * 0.08, hy - ry * 0.46);
    ctx.quadraticCurveTo(cx + rx * 0.5, hy - ry * 0.74, cx + rx * 0.96, hy - ry * 0.56);
    ctx.stroke();
    // A big hooked nose.
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.02, hy - ry * 0.16);
    ctx.quadraticCurveTo(cx - rx * 0.34, hy + ry * 0.18, cx - rx * 0.1, hy + ry * 0.36);
    ctx.quadraticCurveTo(cx + rx * 0.12, hy + ry * 0.42, cx + rx * 0.2, hy + ry * 0.26);
    ctx.stroke();
    // The gap-toothed grin.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.56, hy + ry * 0.6);
    ctx.quadraticCurveTo(cx, hy + ry * 1.0, cx + rx * 0.56, hy + ry * 0.58);
    ctx.quadraticCurveTo(cx, hy + ry * 0.62, cx - rx * 0.56, hy + ry * 0.6);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2);
    ctx.stroke();
    ctx.fillStyle = p.sail;
    for (const t of [-0.34, 0.06, 0.34]) {
      ctx.beginPath();
      ctx.rect(cx + rx * t, hy + ry * 0.62, rx * 0.17, ry * 0.16);
      ctx.fill();
    }

    // A long white beard, straggling to the chest.
    ctx.fillStyle = p.sail;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.96, hy + ry * 0.35);
    ctx.quadraticCurveTo(cx - rx * 1.2, hy + ry * 1.6, cx - rx * 0.5, hy + ry * 2.3);
    ctx.quadraticCurveTo(cx - rx * 0.2, hy + ry * 2.9, cx, hy + ry * 2.2);
    ctx.quadraticCurveTo(cx + rx * 0.3, hy + ry * 2.9, cx + rx * 0.55, hy + ry * 2.2);
    ctx.quadraticCurveTo(cx + rx * 1.18, hy + ry * 1.5, cx + rx * 0.96, hy + ry * 0.33);
    ctx.quadraticCurveTo(cx, hy + ry * 1.3, cx - rx * 0.96, hy + ry * 0.35);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, cx - rx * 1.4, hy + ry * 0.3, rx * 2.8, ry * 2.8, rx * 0.2, 0.15, 0.4, 1.3);
    ctx.restore();

    // The sixpence itself, pinned at his collar.
    ctx.beginPath();
    ctx.arc(cx + rx * 1.9, hy + ry * 1.5, Math.min(w, h) * 0.045, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();
    pen(ctx, p.ink, 1.6);
    ctx.beginPath();
    ctx.arc(cx + rx * 1.9, hy + ry * 1.5, Math.min(w, h) * 0.028, 0, TAU);
    ctx.stroke();

    // A relic skull held up in the other hand.
    const sx = w * 0.14;
    const sy = h * 0.66;
    const sr = Math.min(w, h) * 0.085;
    ctx.beginPath();
    ctx.moveTo(sx - sr, sy - sr * 0.15);
    ctx.quadraticCurveTo(sx - sr, sy - sr * 1.15, sx, sy - sr * 1.15);
    ctx.quadraticCurveTo(sx + sr, sy - sr * 1.15, sx + sr, sy - sr * 0.15);
    ctx.quadraticCurveTo(sx + sr * 0.95, sy + sr * 0.45, sx + sr * 0.45, sy + sr * 0.6);
    ctx.lineTo(sx + sr * 0.45, sy + sr * 1.0);
    ctx.quadraticCurveTo(sx, sy + sr * 1.25, sx - sr * 0.45, sy + sr * 1.0);
    ctx.lineTo(sx - sr * 0.45, sy + sr * 0.6);
    ctx.quadraticCurveTo(sx - sr * 0.95, sy + sr * 0.45, sx - sr, sy - sr * 0.15);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(sx - sr * 0.42, sy - sr * 0.22, sr * 0.26, sr * 0.3, 0.12, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(sx + sr * 0.42, sy - sr * 0.22, sr * 0.26, sr * 0.3, -0.12, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx, sy + sr * 0.05);
    ctx.lineTo(sx - sr * 0.15, sy + sr * 0.4);
    ctx.lineTo(sx + sr * 0.15, sy + sr * 0.4);
    ctx.closePath();
    ctx.fill();
    // An old hand cupped beneath it, fingers curling up the jaw.
    ctx.beginPath();
    ctx.moveTo(sx - sr * 0.95, sy + sr * 0.72);
    ctx.quadraticCurveTo(sx, sy + sr * 2.0, sx + sr * 0.95, sy + sr * 0.72);
    ctx.quadraticCurveTo(sx + sr * 1.1, sy + sr * 1.7, sx, sy + sr * 1.85);
    ctx.quadraticCurveTo(sx - sr * 1.1, sy + sr * 1.7, sx - sr * 0.95, sy + sr * 0.72);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 2.6);
    ctx.stroke();
    ctx.fillStyle = p.paperDark;
    for (let i = 0; i < 3; i++) {
      const fx = sx - sr * 0.62 + i * sr * 0.62;
      ctx.beginPath();
      ctx.moveTo(fx - sr * 0.24, sy + sr * 1.25);
      ctx.quadraticCurveTo(fx - sr * 0.3, sy + sr * 0.3, fx, sy + sr * 0.42);
      ctx.quadraticCurveTo(fx + sr * 0.3, sy + sr * 0.32, fx + sr * 0.24, sy + sr * 1.25);
      ctx.closePath();
      ctx.fill();
      pen(ctx, p.ink, 2.2);
      ctx.stroke();
    }
  },

  // ----------------------------------------------------------
  // Serafina Drake, the Red Widow — veiled, severe, in mourning
  // ----------------------------------------------------------

  'Serafina Drake': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const hy = h * 0.48;
    const rx = w * 0.085;
    const ry = h * 0.165;

    hatch(ctx, p.inkSoft, -w * 0.1, 0, w * 1.2, h, w * 0.1, -0.15, 0.12, 1.2);
    // A bare spar behind her, like a gallows against the sky.
    pen(ctx, p.line, 3);
    ctx.beginPath();
    ctx.moveTo(w * 0.87, h * 1.0);
    ctx.lineTo(w * 0.87, h * 0.06);
    ctx.moveTo(w * 0.72, h * 0.2);
    ctx.lineTo(w * 1.02, h * 0.16);
    ctx.stroke();

    // Mourning gown: shoulders wide and flat, all black.
    bust(ctx, h, cx, rx * 0.55, hy + ry * 0.95, w * 0.26, w * 0.26, 0.16);
    ctx.fillStyle = p.ink;
    ctx.fill();

    // Head, drawn before the veil falls over it.
    head(ctx, cx, hy, rx, ry, 0.52);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    eyes(ctx, p, cx, hy - ry * 0.14, rx * 0.44, rx * 0.28, ry * 0.14, rx * 0.13);
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.82, hy - ry * 0.5);
    ctx.lineTo(cx - rx * 0.1, hy - ry * 0.42);
    ctx.moveTo(cx + rx * 0.1, hy - ry * 0.42);
    ctx.lineTo(cx + rx * 0.82, hy - ry * 0.5);
    ctx.stroke();
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.02, hy - ry * 0.08);
    ctx.lineTo(cx - rx * 0.14, hy + ry * 0.3);
    ctx.lineTo(cx + rx * 0.1, hy + ry * 0.32);
    ctx.moveTo(cx - rx * 0.3, hy + ry * 0.62);
    ctx.lineTo(cx + rx * 0.3, hy + ry * 0.6);
    ctx.stroke();

    // The veil: a black sheet from a high comb, opened over the face.
    // Outlined first, then the gauze hatching is clipped inside it.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.08);
    ctx.quadraticCurveTo(cx - w * 0.2, h * 0.16, cx - w * 0.23, h * 0.52);
    ctx.quadraticCurveTo(cx - w * 0.25, h * 0.82, cx - w * 0.3, h * 1.06);
    ctx.lineTo(cx - w * 0.15, h * 1.06);
    // Inner edge of the opening, framing the face.
    ctx.quadraticCurveTo(cx - w * 0.11, h * 0.74, cx - w * 0.105, hy - ry * 0.2);
    ctx.quadraticCurveTo(cx - w * 0.1, h * 0.14, cx, h * 0.12);
    ctx.quadraticCurveTo(cx + w * 0.1, h * 0.14, cx + w * 0.105, hy - ry * 0.2);
    ctx.quadraticCurveTo(cx + w * 0.11, h * 0.74, cx + w * 0.15, h * 1.06);
    ctx.lineTo(cx + w * 0.3, h * 1.06);
    ctx.quadraticCurveTo(cx + w * 0.25, h * 0.82, cx + w * 0.23, h * 0.52);
    ctx.quadraticCurveTo(cx + w * 0.2, h * 0.16, cx + w * 0.06, h * 0.08);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, 0, h * 0.05, w, h, w * 0.035, 0.22, 0.35, 1.2);
    ctx.restore();

    // Gauze drawn across the face: fine lines, so she reads through it.
    ctx.save();
    head(ctx, cx, hy, rx, ry, 0.52);
    ctx.clip();
    hatch(ctx, p.ink, cx - rx * 1.2, hy - ry * 1.3, rx * 2.6, ry * 2.6, rx * 0.2, 0, 0.3, 1);
    hatch(ctx, p.ink, cx - rx * 1.2, hy - ry * 1.3, rx * 2.6, ry * 2.6, rx * 0.5, 2.6, 0.22, 1);
    ctx.restore();

    // The comb at the crown of the veil.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.055, h * 0.1);
    ctx.quadraticCurveTo(cx, h * 0.0, cx + w * 0.055, h * 0.1);
    ctx.quadraticCurveTo(cx, h * 0.07, cx - w * 0.055, h * 0.1);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();

    // One red brooch at the throat, and a red hem to the veil.
    pen(ctx, p.accent, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.29, h * 1.0);
    ctx.quadraticCurveTo(cx - w * 0.24, h * 0.66, cx - w * 0.225, h * 0.48);
    ctx.moveTo(cx + w * 0.29, h * 1.0);
    ctx.quadraticCurveTo(cx + w * 0.24, h * 0.66, cx + w * 0.225, h * 0.48);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 8;
      const r = i % 2 ? Math.min(w, h) * 0.022 : Math.min(w, h) * 0.05;
      const x = cx + Math.cos(a) * r;
      const y = h * 0.78 + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, h * 0.78, Math.min(w, h) * 0.018, 0, TAU);
    ctx.fillStyle = p.ink;
    ctx.fill();
  },

  // ----------------------------------------------------------
  // Nicodemus Quill, the Chartsmith — spectacles and dividers
  // ----------------------------------------------------------

  'Nicodemus Quill': (ctx, w, h, p) => {
    const cx = w * 0.42;
    const hy = h * 0.42;
    const rx = w * 0.093;
    const ry = h * 0.168;

    // Rhumb lines radiating from a rose in the far corner.
    ctx.save();
    ctx.globalAlpha = 0.3;
    pen(ctx, p.line, 1.4);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i * TAU) / 16;
      ctx.moveTo(w * 0.87, h * 0.2);
      ctx.lineTo(w * 0.87 + Math.cos(a) * w * 0.5, h * 0.2 + Math.sin(a) * w * 0.5);
    }
    ctx.stroke();
    ctx.restore();
    pen(ctx, p.line, 2);
    ctx.beginPath();
    ctx.arc(w * 0.87, h * 0.2, Math.min(w, h) * 0.075, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = p.line;
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4 - Math.PI / 2;
      const r = Math.min(w, h) * 0.075;
      ctx.beginPath();
      ctx.moveTo(w * 0.87 + Math.cos(a) * r, h * 0.2 + Math.sin(a) * r);
      ctx.lineTo(w * 0.87 + Math.cos(a + 0.4) * r * 0.25, h * 0.2 + Math.sin(a + 0.4) * r * 0.25);
      ctx.lineTo(w * 0.87 + Math.cos(a - 0.4) * r * 0.25, h * 0.2 + Math.sin(a - 0.4) * r * 0.25);
      ctx.closePath();
      ctx.fill();
    }

    // A rolled chart under his arm on the left.
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.96);
    ctx.lineTo(w * 0.15, h * 0.62);
    ctx.lineTo(w * 0.21, h * 0.68);
    ctx.lineTo(w * 0.08, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.6);
    ctx.stroke();
    pen(ctx, p.line, 1.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.155, h * 0.635);
    ctx.lineTo(w * 0.025, h * 0.975);
    ctx.stroke();

    // Scholar's coat and plain linen bands at the collar.
    bust(ctx, h, cx, rx * 0.5, hy + ry * 1.0, w * 0.25, w * 0.27, 0.2);
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.4);
    ctx.stroke();
    ctx.fillStyle = p.sail;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.6, hy + ry * 1.0);
    ctx.lineTo(cx - rx * 0.62, hy + ry * 2.1);
    ctx.lineTo(cx - rx * 0.08, hy + ry * 2.1);
    ctx.lineTo(cx - rx * 0.06, hy + ry * 1.05);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.6, hy + ry * 1.0);
    ctx.lineTo(cx + rx * 0.62, hy + ry * 2.1);
    ctx.lineTo(cx + rx * 0.08, hy + ry * 2.1);
    ctx.lineTo(cx + rx * 0.06, hy + ry * 1.05);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 2);
    ctx.stroke();

    // Side puffs of hair above the ears — the crown of him is bare.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      strand(
        ctx, cx, hy, rx, ry, s > 0 ? 0.06 : Math.PI - 0.06, 0.26,
        cx + s * rx * 1.28, hy + ry * 0.5,
        [s * rx * 0.6, -ry * 0.35]
      );
      ctx.fill();
      pen(ctx, p.ink, 2);
      ctx.stroke();
    }

    // Head: high bald forehead.
    head(ctx, cx, hy, rx, ry, 0.56);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, cx - rx, hy - ry * 1.2, rx * 2.2, ry * 2.4, rx * 0.3, -0.4, 0.2, 1.2);
    ctx.restore();

    // Eyes, then round spectacles laid over them.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * rx * 0.46, hy - ry * 0.12, rx * 0.14, 0, TAU);
      ctx.fill();
    }
    pen(ctx, p.metalDark, 2.8);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * rx * 0.46, hy - ry * 0.12, rx * 0.4, 0, TAU);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.08, hy - ry * 0.12);
    ctx.lineTo(cx + rx * 0.08, hy - ry * 0.12);
    ctx.moveTo(cx - rx * 0.86, hy - ry * 0.16);
    ctx.lineTo(cx - rx * 1.02, hy - ry * 0.3);
    ctx.moveTo(cx + rx * 0.86, hy - ry * 0.16);
    ctx.lineTo(cx + rx * 1.02, hy - ry * 0.3);
    ctx.stroke();
    // Raised brows and a pursed mouth.
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.78, hy - ry * 0.62);
    ctx.quadraticCurveTo(cx - rx * 0.42, hy - ry * 0.76, cx - rx * 0.1, hy - ry * 0.62);
    ctx.moveTo(cx + rx * 0.1, hy - ry * 0.62);
    ctx.quadraticCurveTo(cx + rx * 0.42, hy - ry * 0.76, cx + rx * 0.78, hy - ry * 0.62);
    ctx.moveTo(cx, hy + ry * 0.02);
    ctx.lineTo(cx - rx * 0.12, hy + ry * 0.3);
    ctx.lineTo(cx + rx * 0.1, hy + ry * 0.32);
    ctx.moveTo(cx - rx * 0.22, hy + ry * 0.58);
    ctx.lineTo(cx + rx * 0.22, hy + ry * 0.58);
    ctx.stroke();
    // A neat chin beard.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.3, hy + ry * 0.74);
    ctx.quadraticCurveTo(cx, hy + ry * 0.66, cx + rx * 0.3, hy + ry * 0.74);
    ctx.quadraticCurveTo(cx + rx * 0.16, hy + ry * 1.36, cx, hy + ry * 1.4);
    ctx.quadraticCurveTo(cx - rx * 0.16, hy + ry * 1.36, cx - rx * 0.3, hy + ry * 0.74);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2);
    ctx.stroke();

    // The dividers, held up open — his trade in one shape.
    const dx = w * 0.72;
    const dy = h * 0.42;
    const dl = h * 0.46;
    pen(ctx, p.metal, 5);
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx - dl * 0.42, dy + dl);
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + dl * 0.34, dy + dl);
    ctx.stroke();
    pen(ctx, p.ink, 2);
    ctx.beginPath();
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx - dl * 0.42, dy + dl);
    ctx.moveTo(dx, dy);
    ctx.lineTo(dx + dl * 0.34, dy + dl);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, dy, Math.min(w, h) * 0.034, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // The Gull of Marrow, the Unseen — hood and a bone beak
  // ----------------------------------------------------------

  'The Gull of Marrow': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const hy = h * 0.44;

    hatch(ctx, p.inkSoft, -w * 0.1, 0, w * 1.2, h, w * 0.09, 0.4, 0.12, 1.2);
    // Gulls wheeling behind.
    gull(ctx, w * 0.84, h * 0.14, Math.min(w, h) * 0.08, p.line, 2.2);
    gull(ctx, w * 0.93, h * 0.3, Math.min(w, h) * 0.055, p.line, 1.8);
    gull(ctx, w * 0.14, h * 0.12, Math.min(w, h) * 0.06, p.line, 2);

    // Cloaked shoulders, wide and low.
    bust(ctx, h, cx, w * 0.08, h * 0.6, w * 0.34, w * 0.34, 0.12);
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.6);
    ctx.stroke();
    // A mantle of feathers laid outward along each shoulder, drawn
    // from the neck out so each overlaps the one before it.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) {
        const t = i / 4;
        const fx = cx + s * (w * 0.06 + t * w * 0.2);
        const fy = h * 0.7 + t * t * h * 0.11;
        const fa = s > 0 ? 0.3 + t * 0.4 : Math.PI - 0.3 - t * 0.4;
        const fl = w * (0.17 - t * 0.03);
        leafShape(ctx, fx, fy, fa, fl, h * 0.05);
        ctx.fillStyle = p.paperDark;
        ctx.fill();
        pen(ctx, p.ink, 2.2);
        ctx.stroke();
        pen(ctx, p.ink, 1.3);
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(fa) * fl * 0.92, fy + Math.sin(fa) * fl * 0.92);
        ctx.stroke();
      }
    }

    // The hood: a deep cowl, its opening a hole of shadow.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.2, h * 0.86);
    ctx.quadraticCurveTo(cx - w * 0.21, h * 0.24, cx, h * 0.05);
    ctx.quadraticCurveTo(cx + w * 0.21, h * 0.24, cx + w * 0.2, h * 0.86);
    ctx.quadraticCurveTo(cx, h * 0.72, cx - w * 0.2, h * 0.86);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.line, cx - w * 0.22, 0, w * 0.44, h, w * 0.03, -0.3, 0.5, 1.3);
    ctx.restore();
    // Inner opening: a hole of shadow, so the mask emerges from black.
    ctx.beginPath();
    ctx.ellipse(cx, hy, w * 0.1, h * 0.22, 0, 0, TAU);
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.6);
    ctx.stroke();

    // The beak: a broad bone wedge hooking down out of the shadow.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.058, hy - h * 0.03);
    ctx.quadraticCurveTo(cx - w * 0.042, hy + h * 0.22, cx - w * 0.012, h * 0.85);
    ctx.quadraticCurveTo(cx + w * 0.018, h * 0.91, cx + w * 0.026, h * 0.78);
    ctx.quadraticCurveTo(cx + w * 0.05, hy + h * 0.2, cx + w * 0.058, hy - h * 0.03);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, cx - w * 0.08, hy, w * 0.16, h * 0.6, w * 0.016, 0.1, 0.35, 1.2);
    ctx.restore();
    // The crease along the beak's ridge.
    pen(ctx, p.ink, 2);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.005, hy + h * 0.02);
    ctx.quadraticCurveTo(cx + w * 0.012, hy + h * 0.28, cx + w * 0.018, h * 0.78);
    ctx.stroke();

    // The mask's upper plate and two blank lenses.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.105, hy - h * 0.16);
    ctx.quadraticCurveTo(cx, hy - h * 0.24, cx + w * 0.105, hy - h * 0.16);
    ctx.quadraticCurveTo(cx + w * 0.08, hy + h * 0.06, cx - w * 0.005, hy + h * 0.04);
    ctx.quadraticCurveTo(cx - w * 0.085, hy + h * 0.06, cx - w * 0.105, hy - h * 0.16);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * w * 0.052, hy - h * 0.09, w * 0.03, h * 0.05, 0, 0, TAU);
      ctx.fillStyle = p.metalDark;
      ctx.fill();
      pen(ctx, p.ink, 2.4);
      ctx.stroke();
    }
    // The tie-cord, the one coloured thing on him.
    pen(ctx, p.accent, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.115, hy - h * 0.13);
    ctx.quadraticCurveTo(cx, hy - h * 0.2, cx + w * 0.115, hy - h * 0.13);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // Bartholomew Sear, the Night Tide — brow, jaw and a lantern
  // ----------------------------------------------------------

  'Bartholomew Sear': (ctx, w, h, p) => {
    const cx = w * 0.52;
    const hy = h * 0.42;
    const rx = w * 0.104;
    const ry = h * 0.172;

    // Moon behind his shoulder, and a low night sea.
    glow(ctx, w * 0.82, h * 0.24, Math.min(w, h) * 0.34, p.sky, 0.5);
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.24, Math.min(w, h) * 0.14, 0, TAU);
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.line, 2.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, w * 0.66, h * 0.06, w * 0.34, h * 0.4, w * 0.03, 0.4, 0.22, 1.2);
    ctx.restore();
    seaLines(ctx, p.seaDeep, w, h * 0.84, 3, h * 0.08, h * 0.028, 0.45, 2);

    // Storm coat: collar thrown up around the ears.
    bust(ctx, h, cx, rx * 0.62, hy + ry * 1.02, w * 0.32, w * 0.3, 0.14);
    ctx.fillStyle = p.ink;
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 0.62, hy + ry * 1.0);
      ctx.lineTo(cx + s * rx * 2.2, hy + ry * 0.35);
      ctx.lineTo(cx + s * rx * 2.05, hy + ry * 2.1);
      ctx.closePath();
      ctx.fillStyle = p.woodDark;
      ctx.fill();
      pen(ctx, p.ink, 2.6);
      ctx.stroke();
    }

    // Head: broad, with a square lantern jaw.
    head(ctx, cx, hy, rx, ry, 0.94);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    // Light coming from the lantern side: shade the far cheek.
    hatch(ctx, p.ink, cx + rx * 0.2, hy - ry * 1.2, rx * 1.2, ry * 2.4, rx * 0.2, -0.2, 0.3, 1.4);
    hatch(ctx, p.ink, cx - rx * 1.2, hy - ry * 1.3, rx * 2.4, ry * 0.7, rx * 0.22, 0.3, 0.3, 1.3);
    ctx.restore();

    // Cropped hair, set well back off a broad forehead.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.04, hy - ry * 0.48);
    ctx.quadraticCurveTo(cx - rx * 1.16, hy - ry * 1.3, cx, hy - ry * 1.26);
    ctx.quadraticCurveTo(cx + rx * 1.16, hy - ry * 1.3, cx + rx * 1.04, hy - ry * 0.48);
    ctx.quadraticCurveTo(cx + rx * 0.86, hy - ry * 0.92, cx, hy - ry * 0.86);
    ctx.quadraticCurveTo(cx - rx * 0.86, hy - ry * 0.92, cx - rx * 1.04, hy - ry * 0.48);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 2.6);
    ctx.stroke();
    // Heavy sideburns running down to the jaw.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 1.0, hy - ry * 0.56);
      ctx.lineTo(cx + s * rx * 0.86, hy + ry * 0.6);
      ctx.lineTo(cx + s * rx * 0.62, hy + ry * 0.44);
      ctx.lineTo(cx + s * rx * 0.72, hy - ry * 0.54);
      ctx.closePath();
      ctx.fill();
    }

    // The brow: one unbroken bar of shadow, set high off the eyes.
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.9, hy - ry * 0.46);
    ctx.quadraticCurveTo(cx, hy - ry * 0.62, cx + rx * 0.9, hy - ry * 0.46);
    ctx.quadraticCurveTo(cx + rx * 0.52, hy - ry * 0.28, cx, hy - ry * 0.32);
    ctx.quadraticCurveTo(cx - rx * 0.52, hy - ry * 0.28, cx - rx * 0.9, hy - ry * 0.46);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    // Eyes beneath it, pale enough to catch the lantern.
    eyes(ctx, p, cx, hy - ry * 0.06, rx * 0.46, rx * 0.28, ry * 0.15, rx * 0.13);
    pen(ctx, p.ink, 1.8);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.8, hy + ry * 0.12);
    ctx.lineTo(cx - rx * 0.18, hy + ry * 0.12);
    ctx.moveTo(cx + rx * 0.18, hy + ry * 0.12);
    ctx.lineTo(cx + rx * 0.8, hy + ry * 0.12);
    ctx.stroke();
    // Blunt nose, flat mouth.
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.04, hy + ry * 0.1);
    ctx.lineTo(cx - rx * 0.2, hy + ry * 0.42);
    ctx.quadraticCurveTo(cx, hy + ry * 0.52, cx + rx * 0.18, hy + ry * 0.42);
    ctx.moveTo(cx - rx * 0.4, hy + ry * 0.74);
    ctx.lineTo(cx + rx * 0.4, hy + ry * 0.72);
    ctx.stroke();

    // The lantern, held up on the left — the light in the picture.
    const lx = w * 0.15;
    const ly = h * 0.42;
    const ls = Math.min(w, h) * 0.13;
    pen(ctx, p.metalDark, 2.4);
    ctx.beginPath();
    ctx.moveTo(lx, ly - ls * 1.5);
    ctx.lineTo(lx, ly - ls * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lx, ly - ls * 0.95, ls * 0.42, Math.PI, 0);
    ctx.stroke();
    glow(ctx, lx, ly, ls * 2.6, p.accent, 0.5);
    // Body of the lamp.
    ctx.beginPath();
    ctx.moveTo(lx - ls * 0.55, ly - ls * 0.62);
    ctx.lineTo(lx + ls * 0.55, ly - ls * 0.62);
    ctx.lineTo(lx + ls * 0.44, ly + ls * 0.72);
    ctx.lineTo(lx - ls * 0.44, ly + ls * 0.72);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    ctx.fillStyle = p.metalDark;
    ctx.beginPath();
    ctx.moveTo(lx - ls * 0.62, ly - ls * 0.9);
    ctx.lineTo(lx + ls * 0.62, ly - ls * 0.9);
    ctx.lineTo(lx + ls * 0.52, ly - ls * 0.58);
    ctx.lineTo(lx - ls * 0.52, ly - ls * 0.58);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx - ls * 0.56, ly + ls * 0.72);
    ctx.lineTo(lx + ls * 0.56, ly + ls * 0.72);
    ctx.lineTo(lx + ls * 0.46, ly + ls * 0.98);
    ctx.lineTo(lx - ls * 0.46, ly + ls * 0.98);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();
    // Flame inside.
    ctx.beginPath();
    ctx.moveTo(lx - ls * 0.16, ly + ls * 0.4);
    ctx.bezierCurveTo(lx - ls * 0.3, ly, lx - ls * 0.06, ly - ls * 0.12, lx, ly - ls * 0.38);
    ctx.bezierCurveTo(lx + ls * 0.1, ly - ls * 0.06, lx + ls * 0.3, ly, lx + ls * 0.16, ly + ls * 0.4);
    ctx.closePath();
    ctx.fillStyle = p.flame;
    ctx.fill();
    pen(ctx, p.ink, 2);
    ctx.stroke();
    // Frame bars.
    pen(ctx, p.ink, 2);
    ctx.beginPath();
    ctx.moveTo(lx - ls * 0.52, ly - ls * 0.58);
    ctx.lineTo(lx - ls * 0.44, ly + ls * 0.72);
    ctx.moveTo(lx + ls * 0.52, ly - ls * 0.58);
    ctx.lineTo(lx + ls * 0.44, ly + ls * 0.72);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // Anselm the Drowned, the Green Fathom — kelp and a hollow stare
  // ----------------------------------------------------------

  'Anselm the Drowned': (ctx, w, h, p) => {
    const cx = w * 0.47;
    const hy = h * 0.46;
    const rx = w * 0.095;
    const ry = h * 0.182;

    // He is under it, not on it: the surface rides across the top.
    seaLines(ctx, p.sea, w, h * 0.1, 2, h * 0.07, h * 0.035, 0.45, 2.2);
    hatch(ctx, p.sea, -w * 0.1, h * 0.14, w * 1.2, h * 0.9, w * 0.075, 0.12, 0.14, 1.3);

    // Sunk shoulders in a rotted coat.
    bust(ctx, h, cx, rx * 0.5, hy + ry * 1.0, w * 0.27, w * 0.27, 0.18);
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.6, w, h * 0.5, w * 0.03, -0.4, 0.3, 1.5);
    ctx.restore();
    // Torn collar, hanging open.
    ctx.fillStyle = p.ink;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * rx * 0.5, hy + ry * 1.0);
      ctx.lineTo(cx + s * rx * 1.9, hy + ry * 0.8);
      ctx.lineTo(cx + s * rx * 1.5, hy + ry * 2.0);
      ctx.lineTo(cx + s * rx * 1.0, hy + ry * 1.4);
      ctx.lineTo(cx + s * rx * 0.8, hy + ry * 2.2);
      ctx.closePath();
      ctx.fill();
    }

    // Kelp: heavy wet fronds hanging off the crown, none of them
    // standing up. Rooted over the top, every tip below the ears.
    ctx.fillStyle = p.leaf;
    const fronds = [
      [-2.62, -2.15, 3.0, -1.3], [-2.3, -1.6, 3.6, -1.4],
      [-1.95, -1.0, 3.2, -1.0], [-1.62, -0.3, 3.7, -0.4],
      [-1.3, 0.45, 3.1, 0.5], [-0.95, 1.15, 3.55, 1.1],
      [-0.62, 1.75, 2.9, 1.35], [-0.3, 2.1, 2.1, 1.4],
      [3.02, -2.5, 1.9, -1.5],
    ];
    for (const f of fronds) {
      strand(
        ctx, cx, hy, rx, ry, f[0], 0.13,
        cx + rx * f[1], hy + ry * f[2],
        [rx * f[3], -ry * 0.3]
      );
      ctx.fill();
      pen(ctx, p.ink, 2);
      ctx.stroke();
    }
    // Air bladders knotted along a few of them.
    for (const b of [
      [cx - rx * 1.8, hy + ry * 1.5], [cx + rx * 1.95, hy + ry * 1.7],
      [cx - rx * 1.25, hy + ry * 2.5], [cx + rx * 1.2, hy + ry * 2.6],
    ]) {
      ctx.beginPath();
      ctx.ellipse(b[0], b[1], rx * 0.22, ry * 0.17, 0.4, 0, TAU);
      ctx.fillStyle = p.leaf;
      ctx.fill();
      pen(ctx, p.ink, 1.8);
      ctx.stroke();
    }

    // Head: waterlogged, bloodless.
    head(ctx, cx, hy, rx, ry, 0.44);
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.sea, cx - rx, hy - ry * 1.2, rx * 2.2, ry * 2.4, rx * 0.2, 0.45, 0.28, 1.3);
    hatch(ctx, p.inkSoft, cx - rx * 1.1, hy + ry * 0.1, rx * 0.7, ry * 0.9, rx * 0.18, 0.2, 0.35, 1.3);
    hatch(ctx, p.inkSoft, cx + rx * 0.45, hy + ry * 0.1, rx * 0.7, ry * 0.9, rx * 0.18, -0.2, 0.35, 1.3);
    ctx.restore();

    // The stare: two empty sockets, one with a spark still in it.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * rx * 0.47, hy - ry * 0.18, rx * 0.32, ry * 0.24, 0, 0, TAU);
      ctx.fillStyle = p.ink;
      ctx.fill();
      pen(ctx, p.line, 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx + rx * 0.47, hy - ry * 0.18, rx * 0.1, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    // Brow ridges, nose, slack mouth.
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.88, hy - ry * 0.52);
    ctx.lineTo(cx - rx * 0.1, hy - ry * 0.5);
    ctx.moveTo(cx + rx * 0.1, hy - ry * 0.5);
    ctx.lineTo(cx + rx * 0.88, hy - ry * 0.52);
    ctx.moveTo(cx, hy - ry * 0.06);
    ctx.lineTo(cx - rx * 0.14, hy + ry * 0.26);
    ctx.lineTo(cx + rx * 0.12, hy + ry * 0.28);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, hy + ry * 0.68, rx * 0.26, ry * 0.2, 0, 0, TAU);
    ctx.fillStyle = p.ink;
    ctx.fill();
    // Slime running down the cheek.
    pen(ctx, p.leaf, 2);
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.72, hy - ry * 0.02);
    ctx.quadraticCurveTo(cx - rx * 0.62, hy + ry * 0.4, cx - rx * 0.7, hy + ry * 0.8);
    ctx.stroke();

    bubbles(ctx, p.sea, [
      [w * 0.86, h * 0.56, Math.min(w, h) * 0.035],
      [w * 0.8, h * 0.36, Math.min(w, h) * 0.022],
      [w * 0.88, h * 0.22, Math.min(w, h) * 0.015],
      [w * 0.11, h * 0.5, Math.min(w, h) * 0.028],
      [w * 0.16, h * 0.32, Math.min(w, h) * 0.017],
    ], 0.7, 2);
  },
};
