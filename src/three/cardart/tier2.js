// ============================================================
// Tier 2 card art — ships and outposts.
//
// The middle tier: vessels with real rigging, and places with a
// sense of landscape. Grander than the hand tools of tier 1,
// quieter than the legends of tier 3.
//
// Every function is called as (ctx, w, h, p) with the context
// already translated to the panel's top-left and clipped to it.
// Panel is roughly 340 x 196 — always derive from w and h.
// ============================================================

const TAU = Math.PI * 2;

// ------------------------------------------------------------
// Shared engraving helpers
// ------------------------------------------------------------

/** Set the pen to the deck's outline ink. */
function ink(ctx, p, lw) {
  ctx.strokeStyle = p.line;
  ctx.lineWidth = lw;
}

/** Build a rectangular sub-path from line segments. */
function rectPath(ctx, x, y, rw, rh) {
  ctx.moveTo(x, y);
  ctx.lineTo(x + rw, y);
  ctx.lineTo(x + rw, y + rh);
  ctx.lineTo(x, y + rh);
  ctx.closePath();
}

/** A filled and/or outlined box. */
function box(ctx, p, x, y, rw, rh, fill, lw) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    rectPath(ctx, x, y, rw, rh);
    ctx.fill();
  }
  if (lw) {
    ink(ctx, p, lw);
    ctx.beginPath();
    rectPath(ctx, x, y, rw, rh);
    ctx.stroke();
  }
}

/** A filled and/or outlined polygon from [x, y] pairs. */
function poly(ctx, p, pts, fill, lw, stroke) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw) {
    ctx.strokeStyle = stroke || p.line;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** A band of sea from `top` to the foot of the panel. */
function seaBand(ctx, w, h, p, top, alpha) {
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, p.sea);
  g.addColorStop(1, p.seaDeep);
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.78 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  rectPath(ctx, 0, top, w, h - top);
  ctx.fill();
  ctx.restore();
  ink(ctx, p, 2.5);
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.stroke();
}

/** A bounded strip of distant water, for scenes that are mostly land. */
function seaStrip(ctx, w, p, top, bottom, alpha) {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, p.seaDeep);
  g.addColorStop(1, p.sea);
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.6 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  rectPath(ctx, 0, top, w, bottom - top);
  ctx.fill();
  ctx.restore();
  ink(ctx, p, 2.5);
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(w, top);
  ctx.stroke();
}

/** Rolling ripples across the sea band. */
function waves(ctx, w, h, p, top, rows, colour, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.45 : alpha;
  ctx.strokeStyle = colour || p.paper;
  ctx.lineWidth = 2;
  for (let i = 0; i < rows; i++) {
    const y = top + ((i + 1) / (rows + 1)) * (h - top);
    const amp = 2 + i * 1.4;
    const step = 20 + i * 8;
    ctx.beginPath();
    ctx.moveTo(-step, y);
    for (let x = -step; x < w + step; x += step) {
      ctx.quadraticCurveTo(x + step * 0.25, y - amp, x + step * 0.5, y);
      ctx.quadraticCurveTo(x + step * 0.75, y + amp, x + step, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Diagonal hatching clipped to a shape, for shadow. */
function hatch(ctx, build, x0, y0, x1, y1, step, colour, alpha, lw) {
  ctx.save();
  ctx.beginPath();
  build(ctx);
  ctx.clip();
  ctx.globalAlpha = alpha === undefined ? 0.3 : alpha;
  ctx.strokeStyle = colour;
  ctx.lineWidth = lw || 2;
  const span = y1 - y0;
  ctx.beginPath();
  for (let x = x0 - span; x < x1 + span; x += step) {
    ctx.moveTo(x, y1);
    ctx.lineTo(x + span, y0);
  }
  ctx.stroke();
  ctx.restore();
}

/** A mast, yard or boom. */
function spar(ctx, p, x0, y0, x1, y1, lw, colour) {
  ctx.strokeStyle = colour || p.woodDark;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** A bundle of thin standing rigging, given as [x0, y0, x1, y1]. */
function rig(ctx, p, lines, lw, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 0.7 : alpha;
  ctx.strokeStyle = p.ink;
  ctx.lineWidth = lw || 1.3;
  ctx.beginPath();
  for (let i = 0; i < lines.length; i++) {
    ctx.moveTo(lines[i][0], lines[i][1]);
    ctx.lineTo(lines[i][2], lines[i][3]);
  }
  ctx.stroke();
  ctx.restore();
}

/** A bellied square sail hung between two yards. Negative belly leans left. */
function squareSail(ctx, p, cx, yTop, yBot, halfTop, halfBot, belly, fill) {
  const mid = (yTop + yBot) / 2;
  ctx.beginPath();
  ctx.moveTo(cx - halfTop, yTop);
  ctx.lineTo(cx + halfTop, yTop);
  ctx.quadraticCurveTo(cx + halfBot + belly * 0.5, mid, cx + halfBot, yBot);
  ctx.quadraticCurveTo(cx, yBot + Math.abs(belly) * 0.5, cx - halfBot, yBot);
  ctx.quadraticCurveTo(cx - halfTop + belly * 0.5, mid, cx - halfTop, yTop);
  ctx.closePath();
  ctx.fillStyle = fill || p.sail;
  ctx.fill();
  ink(ctx, p, 2.5);
  ctx.stroke();
}

/** A triangular fore-and-aft sail with a bellied leech. */
function triSail(ctx, p, head, tack, clew, bx, by, fill) {
  ctx.beginPath();
  ctx.moveTo(head[0], head[1]);
  ctx.lineTo(tack[0], tack[1]);
  ctx.lineTo(clew[0], clew[1]);
  ctx.quadraticCurveTo(bx, by, head[0], head[1]);
  ctx.closePath();
  ctx.fillStyle = fill || p.sail;
  ctx.fill();
  ink(ctx, p, 2.5);
  ctx.stroke();
}

/** A small pennant streaming from a masthead. */
function pennant(ctx, p, x, y, len, colour) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + len * 0.5, y - Math.abs(len) * 0.12, x + len, y + Math.abs(len) * 0.06);
  ctx.lineTo(x + len * 0.72, y + Math.abs(len) * 0.2);
  ctx.quadraticCurveTo(x + len * 0.4, y + Math.abs(len) * 0.16, x, y + Math.abs(len) * 0.22);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
  ink(ctx, p, 1.6);
  ctx.stroke();
}

/** A leafy palm crown around a trunk head. */
function palmCrown(ctx, p, x, y, r, fronds, lean) {
  ctx.fillStyle = p.leaf;
  ink(ctx, p, 2);
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI + (i / (fronds - 1)) * Math.PI + lean * 0.25;
    const tx = x + Math.cos(a) * r;
    const ty = y + Math.sin(a) * r * 0.75;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + tx) / 2, (y + ty) / 2 - r * 0.42, tx, ty);
    ctx.quadraticCurveTo((x + tx) / 2, (y + ty) / 2 - r * 0.08, x, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** A tongue of flame. */
function flame(ctx, p, x, y, fw, fh, accent) {
  ctx.beginPath();
  ctx.moveTo(x - fw, y);
  ctx.quadraticCurveTo(x - fw * 0.5, y - fh * 0.55, x, y - fh);
  ctx.quadraticCurveTo(x + fw * 0.55, y - fh * 0.5, x + fw, y);
  ctx.closePath();
  ctx.fillStyle = p.flame;
  ctx.fill();
  ink(ctx, p, 1.8);
  ctx.stroke();
  if (accent) {
    ctx.beginPath();
    ctx.moveTo(x - fw * 0.35, y);
    ctx.quadraticCurveTo(x, y - fh * 0.5, x + fw * 0.3, y);
    ctx.closePath();
    ctx.fillStyle = accent;
    ctx.fill();
  }
}

/** A curl of smoke rising. */
function smoke(ctx, p, x, y, size, puffs, drift) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = p.inkSoft;
  ink(ctx, p, 1.6);
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1 || 1);
    const r = size * (0.42 + t * 0.62);
    ctx.beginPath();
    ctx.arc(x + drift * t, y - size * 1.5 * t - r * 0.4, r, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ------------------------------------------------------------
// The cards
// ------------------------------------------------------------

export const TIER2_ART = {
  // ---------------- pearl ----------------

  'Whitesail Sloop': (ctx, w, h, p) => {
    const sy = h * 0.7;
    seaBand(ctx, w, h, p, sy, 0.72);
    waves(ctx, w, h, p, sy, 3, p.paper, 0.4);
    const deck = h * 0.655;
    const mx = w * 0.45;
    // hull: low and sleek, bow to the right
    ctx.beginPath();
    ctx.moveTo(w * 0.24, deck - h * 0.01);
    ctx.quadraticCurveTo(w * 0.5, deck - h * 0.05, w * 0.78, deck - h * 0.06);
    ctx.quadraticCurveTo(w * 0.7, deck + h * 0.08, w * 0.43, deck + h * 0.095);
    ctx.quadraticCurveTo(w * 0.29, deck + h * 0.09, w * 0.24, deck - h * 0.01);
    ctx.closePath();
    ctx.fillStyle = p.wood;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(w * 0.24, deck);
      c.quadraticCurveTo(w * 0.5, deck - h * 0.04, w * 0.78, deck - h * 0.06);
      c.quadraticCurveTo(w * 0.7, deck + h * 0.08, w * 0.43, deck + h * 0.095);
      c.quadraticCurveTo(w * 0.29, deck + h * 0.09, w * 0.24, deck);
    }, w * 0.2, deck, w * 0.8, h, 7, p.woodDark, 0.35, 2);
    // bowsprit
    spar(ctx, p, w * 0.76, deck - h * 0.06, w * 0.93, h * 0.55, 3);
    // mast and boom
    spar(ctx, p, mx, h * 0.09, mx, deck + h * 0.01, 4);
    spar(ctx, p, w * 0.25, deck - h * 0.035, mx, deck - h * 0.045, 3.5);
    // mainsail aft, jib forward
    triSail(ctx, p, [mx - 1, h * 0.14], [mx - 1, deck - h * 0.05], [w * 0.265, deck - h * 0.07],
      w * 0.3, h * 0.36, p.sail);
    triSail(ctx, p, [mx + 1, h * 0.185], [w * 0.905, h * 0.58], [w * 0.645, h * 0.6],
      w * 0.57, h * 0.4, p.sail);
    rig(ctx, p, [
      [mx, h * 0.12, w * 0.245, deck - h * 0.02],
      [mx, h * 0.12, w * 0.33, deck - h * 0.02],
      [mx, h * 0.3, w * 0.9, h * 0.575],
    ], 1.3, 0.6);
    pennant(ctx, p, mx, h * 0.085, -w * 0.11, p.accent);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ink(ctx, p, 2);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const x = w * (0.34 + i * 0.1);
      ctx.moveTo(x, h * 0.78);
      ctx.lineTo(x + w * 0.04, h * 0.78);
    }
    ctx.stroke();
    ctx.restore();
  },

  'Gullcliff Dock': (ctx, w, h, p) => {
    const sy = h * 0.72;
    seaBand(ctx, w, h, p, sy, 0.7);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.35);
    // chalk headland on the left
    ctx.beginPath();
    ctx.moveTo(0, h * 0.18);
    ctx.quadraticCurveTo(w * 0.12, h * 0.04, w * 0.27, h * 0.12);
    ctx.lineTo(w * 0.35, h * 0.28);
    ctx.lineTo(w * 0.38, h * 0.72);
    ctx.lineTo(w * 0.29, h * 0.9);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(w * 0.27, h * 0.14);
      c.lineTo(w * 0.35, h * 0.28);
      c.lineTo(w * 0.38, h * 0.72);
      c.lineTo(w * 0.29, h * 0.9);
      c.lineTo(w * 0.24, h * 0.9);
      c.closePath();
    }, w * 0.2, h * 0.1, w * 0.4, h, 7, p.inkSoft, 0.42, 2);
    // chalk bedding across the face
    ink(ctx, p, 2);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = h * (0.34 + i * 0.16);
      ctx.moveTo(w * 0.02, y);
      ctx.quadraticCurveTo(w * 0.18, y - h * 0.03, w * 0.355, y - h * 0.01);
    }
    ctx.stroke();
    // timber pier running right
    const dy = h * 0.6;
    box(ctx, p, w * 0.3, dy, w * 0.66, h * 0.055, p.wood, 3);
    ink(ctx, p, 3);
    for (let i = 0; i < 4; i++) {
      const x = w * (0.46 + i * 0.14);
      ctx.beginPath();
      ctx.moveTo(x, dy + h * 0.055);
      ctx.lineTo(x - w * 0.008, h * 0.86);
      ctx.moveTo(x + w * 0.05, dy + h * 0.055);
      ctx.lineTo(x + w * 0.062, h * 0.86);
      ctx.moveTo(x - w * 0.006, h * 0.74);
      ctx.lineTo(x + w * 0.058, h * 0.74);
      ctx.stroke();
    }
    // bollard and a crate at the pier head
    box(ctx, p, w * 0.86, dy - h * 0.07, w * 0.05, h * 0.07, p.woodDark, 2.6);
    box(ctx, p, w * 0.7, dy - h * 0.1, w * 0.1, h * 0.1, p.wood, 2.6);
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.7, dy - h * 0.05);
    ctx.lineTo(w * 0.8, dy - h * 0.05);
    ctx.stroke();
    // gulls wheeling over the cliff
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2.4;
    const gulls = [[0.5, 0.16, 1], [0.64, 0.27, 0.8], [0.78, 0.13, 0.65], [0.86, 0.32, 0.55]];
    for (let i = 0; i < gulls.length; i++) {
      const gx = w * gulls[i][0];
      const gy = h * gulls[i][1];
      const s = w * 0.05 * gulls[i][2];
      ctx.beginPath();
      ctx.moveTo(gx - s, gy);
      ctx.quadraticCurveTo(gx - s * 0.45, gy - s * 0.6, gx, gy - s * 0.1);
      ctx.quadraticCurveTo(gx + s * 0.45, gy - s * 0.6, gx + s, gy);
      ctx.stroke();
    }
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.42);
    ctx.quadraticCurveTo(w * 0.46, h * 0.36, w * 0.5, h * 0.43);
    ctx.quadraticCurveTo(w * 0.54, h * 0.36, w * 0.58, h * 0.42);
    ctx.stroke();
  },

  'Bleached Skerry': (ctx, w, h, p) => {
    const sy = h * 0.66;
    seaBand(ctx, w, h, p, sy, 0.66);
    waves(ctx, w, h, p, sy, 3, p.paper, 0.4);
    const stacks = [
      [0.2, 0.3, 0.13, 0.1],
      [0.48, 0.12, 0.2, 0.14],
      [0.76, 0.38, 0.11, 0.09],
    ];
    for (let i = 0; i < stacks.length; i++) {
      const cx = w * stacks[i][0];
      const topY = h * stacks[i][1];
      const halfB = w * stacks[i][2];
      const halfT = w * stacks[i][3] * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx - halfB, h * 0.74);
      ctx.lineTo(cx - halfT * 1.4, topY + h * 0.07);
      ctx.lineTo(cx - halfT * 0.5, topY);
      ctx.lineTo(cx + halfT, topY + h * 0.04);
      ctx.lineTo(cx + halfT * 1.5, topY + h * 0.1);
      ctx.lineTo(cx + halfB, h * 0.74);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? p.paper : p.paperDark;
      ctx.fill();
      ink(ctx, p, 3.2);
      ctx.stroke();
      hatch(ctx, (c) => {
        c.moveTo(cx + halfT * 0.2, topY + h * 0.02);
        c.lineTo(cx + halfT * 1.5, topY + h * 0.1);
        c.lineTo(cx + halfB, h * 0.74);
        c.lineTo(cx + halfB * 0.1, h * 0.74);
        c.closePath();
      }, cx - halfB, topY, cx + halfB, h * 0.76, 7, p.inkSoft, 0.38, 2);
    }
    // driftwood ribs wedged on the near rock
    ink(ctx, p, 2.8);
    for (let i = 0; i < 4; i++) {
      const bx = w * (0.28 + i * 0.045);
      ctx.beginPath();
      ctx.moveTo(bx, h * 0.72);
      ctx.quadraticCurveTo(bx + w * 0.03, h * 0.5 - i * h * 0.015, bx + w * 0.085, h * 0.56 - i * h * 0.02);
      ctx.stroke();
    }
    // sea-mark pole on the tallest skerry
    spar(ctx, p, w * 0.5, h * 0.12, w * 0.5, h * 0.02, 3, p.ink);
    poly(ctx, p, [[w * 0.5, h * 0.02], [w * 0.57, h * 0.06], [w * 0.5, h * 0.1]], p.accent, 2);
    ctx.save();
    ctx.globalAlpha = 0.3;
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.8);
    ctx.lineTo(w * 0.62, h * 0.8);
    ctx.moveTo(w * 0.4, h * 0.88);
    ctx.lineTo(w * 0.56, h * 0.88);
    ctx.stroke();
    ctx.restore();
  },

  Saltworks: (ctx, w, h, p) => {
    // the sea kept out beyond a low sluice wall
    seaStrip(ctx, w, p, h * 0.14, h * 0.28, 0.6);
    box(ctx, p, 0, h * 0.28, w, h * 0.045, p.paperDark, 3);
    ink(ctx, p, 2);
    ctx.beginPath();
    for (let i = 1; i < 9; i++) {
      ctx.moveTo(w * (i / 9), h * 0.28);
      ctx.lineTo(w * (i / 9), h * 0.325);
    }
    ctx.stroke();
    // evaporation pans stepping into the foreground
    const rows = 3;
    for (let r = 0; r < rows; r++) {
      const t0 = r / rows;
      const t1 = (r + 1) / rows;
      const yA = h * (0.36 + t0 * 0.5);
      const yB = h * (0.36 + t1 * 0.5);
      const inA = w * (0.24 - t0 * 0.22);
      const inB = w * (0.24 - t1 * 0.22);
      ctx.beginPath();
      ctx.moveTo(inA, yA);
      ctx.lineTo(w - inA, yA);
      ctx.lineTo(w - inB, yB);
      ctx.lineTo(inB, yB);
      ctx.closePath();
      ctx.fillStyle = r === 1 ? p.sky : p.paperDark;
      ctx.fill();
      ink(ctx, p, 3);
      ctx.stroke();
      const cols = 3;
      ink(ctx, p, 2);
      ctx.beginPath();
      for (let c = 1; c < cols; c++) {
        const f = c / cols;
        ctx.moveTo(inA + (w - inA * 2) * f, yA);
        ctx.lineTo(inB + (w - inB * 2) * f, yB);
      }
      ctx.stroke();
      if (r === 2) {
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = p.sea;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(inB + w * 0.06, (yA + yB) / 2);
        ctx.lineTo(w - inB - w * 0.06, (yA + yB) / 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    // heaped salt, raked into cones
    const mounds = [[0.16, 0.56, 0.08], [0.83, 0.54, 0.065], [0.3, 0.9, 0.1]];
    for (let i = 0; i < mounds.length; i++) {
      const mx = w * mounds[i][0];
      const my = h * mounds[i][1];
      const mr = w * mounds[i][2];
      ctx.beginPath();
      ctx.moveTo(mx - mr, my);
      ctx.quadraticCurveTo(mx - mr * 0.4, my - mr * 1.5, mx, my - mr * 1.6);
      ctx.quadraticCurveTo(mx + mr * 0.4, my - mr * 1.5, mx + mr, my);
      ctx.closePath();
      ctx.fillStyle = p.paper;
      ctx.fill();
      ink(ctx, p, 3);
      ctx.stroke();
    }
    // the salt shed, standing clear of the pans
    box(ctx, p, w * 0.75, h * 0.34, w * 0.21, h * 0.2, p.wood, 3.2);
    poly(ctx, p, [[w * 0.72, h * 0.34], [w * 0.855, h * 0.2], [w * 0.99, h * 0.34]], p.woodDark, 3.2);
    box(ctx, p, w * 0.82, h * 0.42, w * 0.07, h * 0.12, p.accent, 2.4);
    // a rake left standing at the edge of the works
    spar(ctx, p, w * 0.08, h * 0.62, w * 0.14, h * 0.3, 3.2);
    ink(ctx, p, 2.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.11, h * 0.31);
    ctx.lineTo(w * 0.18, h * 0.34);
    ctx.stroke();
  },

  'Ivory Galleon': (ctx, w, h, p) => {
    const sy = h * 0.78;
    seaBand(ctx, w, h, p, sy, 0.72);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.4);
    const deck = h * 0.72;
    // high-sterned hull, bow to the left
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.56);
    ctx.lineTo(w * 0.16, deck - h * 0.03);
    ctx.lineTo(w * 0.78, deck - h * 0.04);
    ctx.lineTo(w * 0.8, h * 0.44);
    ctx.lineTo(w * 0.94, h * 0.46);
    ctx.lineTo(w * 0.93, deck + h * 0.01);
    ctx.quadraticCurveTo(w * 0.6, h * 0.92, w * 0.2, deck + h * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    // gun ports
    ctx.fillStyle = p.woodDark;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      rectPath(ctx, w * (0.24 + i * 0.09), deck + h * 0.025, w * 0.045, h * 0.045);
      ctx.fill();
    }
    ink(ctx, p, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.17, deck + h * 0.005);
    ctx.quadraticCurveTo(w * 0.55, deck + h * 0.055, w * 0.93, deck - h * 0.005);
    ctx.stroke();
    // bowsprit
    spar(ctx, p, w * 0.14, h * 0.58, w * 0.02, h * 0.42, 4);
    const masts = [[0.3, 0.1], [0.5, 0.04], [0.7, 0.14]];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i][0];
      const topY = h * masts[i][1];
      spar(ctx, p, mx, topY, mx, deck - h * 0.03, 4.5);
      if (i < 2) {
        squareSail(ctx, p, mx, topY + h * 0.06, topY + h * 0.24, w * 0.07, w * 0.095, -w * 0.05);
        squareSail(ctx, p, mx, topY + h * 0.3, topY + h * 0.52, w * 0.095, w * 0.115, -w * 0.055);
        spar(ctx, p, mx - w * 0.085, topY + h * 0.06, mx + w * 0.085, topY + h * 0.06, 3);
        spar(ctx, p, mx - w * 0.105, topY + h * 0.3, mx + w * 0.105, topY + h * 0.3, 3);
      } else {
        triSail(ctx, p, [mx, topY + h * 0.05], [mx, deck - h * 0.06], [w * 0.84, deck - h * 0.12],
          w * 0.83, h * 0.36, p.sail);
      }
      rig(ctx, p, [
        [mx, topY, mx - w * 0.06, deck - h * 0.04],
        [mx, topY, mx + w * 0.06, deck - h * 0.04],
      ], 1.3, 0.55);
    }
    rig(ctx, p, [
      [w * 0.3, h * 0.1, w * 0.02, h * 0.43],
      [w * 0.5, h * 0.05, w * 0.3, h * 0.1],
      [w * 0.7, h * 0.15, w * 0.5, h * 0.05],
    ], 1.4, 0.55);
    // stern lantern
    ctx.beginPath();
    ctx.arc(w * 0.905, h * 0.41, w * 0.022, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2);
    ctx.stroke();
  },

  'Pearl Atoll': (ctx, w, h, p) => {
    seaBand(ctx, w, h, p, h * 0.34, 0.7);
    waves(ctx, w, h, p, h * 0.34, 2, p.paper, 0.3);
    ink(ctx, p, 2.5);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.26);
    ctx.lineTo(w, h * 0.26);
    ctx.stroke();
    const cx = w * 0.5;
    const cy = h * 0.66;
    // the sand ring
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.42, h * 0.27, 0, 0, TAU);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    // the still lagoon within
    const lg = ctx.createLinearGradient(0, cy - h * 0.16, 0, cy + h * 0.16);
    lg.addColorStop(0, p.sky);
    lg.addColorStop(1, p.sea);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.3, h * 0.17, 0, 0, TAU);
    ctx.fillStyle = lg;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    // a break in the ring, where boats enter
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = p.sea;
    ctx.beginPath();
    ctx.moveTo(w * 0.78, cy - h * 0.03);
    ctx.lineTo(w * 0.93, cy - h * 0.06);
    ctx.lineTo(w * 0.93, cy + h * 0.06);
    ctx.lineTo(w * 0.78, cy + h * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.79, cy - h * 0.03);
    ctx.lineTo(w * 0.93, cy - h * 0.06);
    ctx.moveTo(w * 0.79, cy + h * 0.03);
    ctx.lineTo(w * 0.93, cy + h * 0.06);
    ctx.stroke();
    // palms on the near rim
    spar(ctx, p, w * 0.33, h * 0.88, w * 0.29, h * 0.62, 4, p.woodDark);
    palmCrown(ctx, p, w * 0.29, h * 0.62, w * 0.1, 5, -0.4);
    spar(ctx, p, w * 0.42, h * 0.9, w * 0.45, h * 0.68, 3.5, p.woodDark);
    palmCrown(ctx, p, w * 0.45, h * 0.68, w * 0.075, 5, 0.4);
    // one pearl-bright shallow
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(w * 0.6, cy - h * 0.04, w * 0.055, h * 0.035, 0, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2);
    ctx.stroke();
  },

  // ---------------- sapphire ----------------

  'Stormrider Brig': (ctx, w, h, p) => {
    const sy = h * 0.66;
    seaBand(ctx, w, h, p, sy, 0.8);
    // storm cloud, kept light so parchment shows through
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.seaDeep;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w, h * 0.12);
    ctx.quadraticCurveTo(w * 0.78, h * 0.24, w * 0.56, h * 0.14);
    ctx.quadraticCurveTo(w * 0.3, h * 0.26, w * 0.12, h * 0.15);
    ctx.quadraticCurveTo(w * 0.05, h * 0.1, 0, h * 0.13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // slanting rain
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = p.seaDeep;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = -w * 0.2; x < w; x += w * 0.055) {
      ctx.moveTo(x, h * 0.2);
      ctx.lineTo(x + w * 0.08, h * 0.62);
    }
    ctx.stroke();
    ctx.restore();
    // heeling brig, bow right, two square-rigged masts
    const deck = h * 0.63;
    const lean = 0.09;
    ctx.beginPath();
    ctx.moveTo(w * 0.24, deck - h * 0.03);
    ctx.lineTo(w * 0.76, deck - h * 0.13);
    ctx.quadraticCurveTo(w * 0.66, deck + h * 0.06, w * 0.42, deck + h * 0.08);
    ctx.quadraticCurveTo(w * 0.28, deck + h * 0.07, w * 0.24, deck - h * 0.03);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.26, deck - h * 0.015);
    ctx.lineTo(w * 0.745, deck - h * 0.115);
    ctx.stroke();
    const masts = [[0.38, 0.62], [0.58, 0.58]];
    for (let i = 0; i < masts.length; i++) {
      const bx = w * masts[i][0];
      const by = deck - h * (i === 0 ? 0.06 : 0.1);
      const topY = h * (i === 0 ? 0.13 : 0.08);
      const tx = bx + (by - topY) * lean;
      spar(ctx, p, bx, by, tx, topY, 4.5);
      const yA = topY + h * 0.09;
      const yB = topY + h * 0.24;
      const cxA = bx + (by - yA) * lean;
      const cxB = bx + (by - yB) * lean;
      spar(ctx, p, cxA - w * 0.075, yA, cxA + w * 0.075, yA - h * 0.012, 3);
      squareSail(ctx, p, cxA + w * 0.01, yA, yB, w * 0.07, w * 0.085, w * 0.06);
      const yC = yB + h * 0.05;
      const yD = deck - h * 0.16;
      spar(ctx, p, cxB - w * 0.09, yC, cxB + w * 0.09, yC - h * 0.012, 3);
      squareSail(ctx, p, cxB + w * 0.015, yC, yD, w * 0.085, w * 0.1, w * 0.07);
      rig(ctx, p, [
        [tx, topY, bx - w * 0.055, by + h * 0.01],
        [tx, topY, bx + w * 0.055, by + h * 0.01],
      ], 1.3, 0.6);
    }
    // crest bursting under the bow
    ctx.beginPath();
    ctx.moveTo(w * 0.6, h * 0.78);
    ctx.quadraticCurveTo(w * 0.72, h * 0.56, w * 0.86, h * 0.62);
    ctx.quadraticCurveTo(w * 0.78, h * 0.66, w * 0.82, h * 0.74);
    ctx.quadraticCurveTo(w * 0.72, h * 0.68, w * 0.68, h * 0.84);
    ctx.closePath();
    ctx.fillStyle = p.paper;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    waves(ctx, w, h, p, h * 0.82, 2, p.paper, 0.4);
  },

  'Tidewatch Tower': (ctx, w, h, p) => {
    const sy = h * 0.76;
    seaBand(ctx, w, h, p, sy, 0.74);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.35);
    // rock base
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.84);
    ctx.lineTo(w * 0.3, h * 0.66);
    ctx.lineTo(w * 0.42, h * 0.72);
    ctx.lineTo(w * 0.52, h * 0.6);
    ctx.lineTo(w * 0.66, h * 0.7);
    ctx.lineTo(w * 0.78, h * 0.86);
    ctx.closePath();
    ctx.fillStyle = p.inkSoft;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    // tapering stone tower
    const bx = w * 0.42;
    const tx = w * 0.485;
    ctx.beginPath();
    ctx.moveTo(bx, h * 0.68);
    ctx.lineTo(tx - w * 0.055, h * 0.24);
    ctx.lineTo(tx + w * 0.055, h * 0.24);
    ctx.lineTo(bx + w * 0.18, h * 0.68);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(tx + w * 0.01, h * 0.24);
      c.lineTo(tx + w * 0.055, h * 0.24);
      c.lineTo(bx + w * 0.18, h * 0.68);
      c.lineTo(bx + w * 0.1, h * 0.68);
      c.closePath();
    }, w * 0.4, h * 0.24, w * 0.66, h * 0.7, 7, p.inkSoft, 0.4, 2);
    // courses of stone
    ink(ctx, p, 1.8);
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      const y = h * (0.24 + t * 0.44);
      const left = tx - w * 0.055 + (bx - (tx - w * 0.055)) * t;
      const right = tx + w * 0.055 + (bx + w * 0.18 - (tx + w * 0.055)) * t;
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
    // gallery and lantern room
    box(ctx, p, tx - w * 0.085, h * 0.2, w * 0.17, h * 0.045, p.metalDark, 3);
    box(ctx, p, tx - w * 0.05, h * 0.09, w * 0.1, h * 0.11, p.sky, 3);
    poly(ctx, p, [[tx - w * 0.07, h * 0.09], [tx, h * 0.02], [tx + w * 0.07, h * 0.09]], p.metalDark, 3);
    // the beam
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(tx + w * 0.05, h * 0.12);
    ctx.lineTo(w, h * 0.02);
    ctx.lineTo(w, h * 0.26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(tx, h * 0.145, w * 0.022, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    // spray at the rock
    ink(ctx, p, 2.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.84);
    ctx.quadraticCurveTo(w * 0.14, h * 0.62, w * 0.24, h * 0.58);
    ctx.quadraticCurveTo(w * 0.2, h * 0.7, w * 0.26, h * 0.8);
    ctx.stroke();
  },

  'Drowned Cove': (ctx, w, h, p) => {
    const sy = h * 0.52;
    seaBand(ctx, w, h, p, sy, 0.82);
    waves(ctx, w, h, p, sy, 3, p.paper, 0.4);
    // headlands framing the cove
    ctx.fillStyle = p.inkSoft;
    ink(ctx, p, 3.2);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.14);
    ctx.lineTo(w * 0.14, h * 0.2);
    ctx.lineTo(w * 0.22, h * 0.36);
    ctx.lineTo(w * 0.3, h * 0.54);
    ctx.lineTo(0, h * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w, h * 0.18);
    ctx.lineTo(w * 0.86, h * 0.22);
    ctx.lineTo(w * 0.76, h * 0.4);
    ctx.lineTo(w * 0.7, h * 0.54);
    ctx.lineTo(w, h * 0.56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the far shore between them
    ink(ctx, p, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.5);
    ctx.quadraticCurveTo(w * 0.5, h * 0.44, w * 0.72, h * 0.5);
    ctx.stroke();
    // a wreck's mast, leaning out of the water
    const bx = w * 0.46;
    const by = h * 0.86;
    const tx = w * 0.66;
    const ty = h * 0.12;
    spar(ctx, p, bx, by, tx, ty, 5);
    spar(ctx, p, tx - w * 0.1, ty + h * 0.12, tx + w * 0.07, ty + h * 0.05, 3.5);
    spar(ctx, p, bx + w * 0.07, h * 0.62, w * 0.34, h * 0.5, 3.5);
    // tattered canvas hanging from the upper yard
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.095, ty + h * 0.125);
    ctx.lineTo(tx + w * 0.065, ty + h * 0.055);
    ctx.lineTo(tx + w * 0.04, ty + h * 0.3);
    ctx.lineTo(tx - w * 0.01, ty + h * 0.2);
    ctx.lineTo(tx - w * 0.04, ty + h * 0.32);
    ctx.lineTo(tx - w * 0.07, ty + h * 0.21);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 2.5);
    ctx.stroke();
    // the drowned hull, showing just under the surface
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.seaDeep;
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.82);
    ctx.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.72, h * 0.84);
    ctx.quadraticCurveTo(w * 0.52, h * 0.98, w * 0.3, h * 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2.6);
    ctx.beginPath();
    ctx.moveTo(w * 0.3, h * 0.82);
    ctx.quadraticCurveTo(w * 0.5, h * 0.72, w * 0.72, h * 0.84);
    ctx.stroke();
    pennant(ctx, p, tx + w * 0.005, ty - h * 0.005, w * 0.1, p.accent);
    rig(ctx, p, [
      [tx, ty, w * 0.28, h * 0.56],
      [tx, ty, w * 0.86, h * 0.52],
    ], 1.4, 0.5);
  },

  'Azure Reef': (ctx, w, h, p) => {
    const sy = h * 0.34;
    seaBand(ctx, w, h, p, sy, 0.6);
    waves(ctx, w, h, p, sy, 1, p.paper, 0.45);
    // sunlight shafts falling through the water
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = p.sky;
    for (let i = 0; i < 4; i++) {
      const x = w * (0.12 + i * 0.24);
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + w * 0.05, sy);
      ctx.lineTo(x + w * 0.14, h);
      ctx.lineTo(x - w * 0.03, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // reef ridge, built of stacked coral heads
    const heads = [
      [0.1, 0.78, 0.11], [0.26, 0.68, 0.14], [0.44, 0.76, 0.1],
      [0.6, 0.64, 0.15], [0.8, 0.74, 0.12], [0.95, 0.82, 0.09],
    ];
    for (let i = 0; i < heads.length; i++) {
      const cx = w * heads[i][0];
      const cy = h * heads[i][1];
      const r = w * heads[i][2];
      ctx.beginPath();
      ctx.moveTo(cx - r, h);
      ctx.quadraticCurveTo(cx - r * 0.95, cy, cx - r * 0.45, cy - r * 0.2);
      ctx.quadraticCurveTo(cx - r * 0.2, cy - r * 0.75, cx + r * 0.1, cy - r * 0.35);
      ctx.quadraticCurveTo(cx + r * 0.45, cy - r * 0.9, cx + r * 0.7, cy - r * 0.1);
      ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.1, cx + r, h);
      ctx.closePath();
      ctx.fillStyle = i % 2 ? p.sea : p.seaDeep;
      ctx.fill();
      ink(ctx, p, 3);
      ctx.stroke();
    }
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const x = w * (0.05 + i * 0.068);
      const y = h * (0.78 + (i % 3) * 0.05);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.02, y - h * 0.06);
    }
    ctx.stroke();
    ctx.restore();
    // a fan of coral catching the light
    ctx.beginPath();
    ctx.moveTo(w * 0.6, h * 0.72);
    ctx.quadraticCurveTo(w * 0.52, h * 0.52, w * 0.61, h * 0.4);
    ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.66, h * 0.72);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2.6);
    ctx.stroke();
    // small fish above the reef
    ctx.fillStyle = p.ink;
    const fish = [[0.2, 0.5], [0.3, 0.44], [0.85, 0.52]];
    for (let i = 0; i < fish.length; i++) {
      const fx = w * fish[i][0];
      const fy = h * fish[i][1];
      const s = w * 0.035;
      ctx.beginPath();
      ctx.moveTo(fx - s, fy);
      ctx.quadraticCurveTo(fx, fy - s * 0.5, fx + s, fy);
      ctx.quadraticCurveTo(fx, fy + s * 0.5, fx - s, fy);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(fx - s, fy);
      ctx.lineTo(fx - s * 1.5, fy - s * 0.4);
      ctx.lineTo(fx - s * 1.5, fy + s * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  },

  'Bluewater Cutter': (ctx, w, h, p) => {
    const sy = h * 0.72;
    seaBand(ctx, w, h, p, sy, 0.74);
    waves(ctx, w, h, p, sy, 3, p.paper, 0.4);
    // close camera: long low hull, bow to the left
    const deck = h * 0.7;
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.62);
    ctx.quadraticCurveTo(w * 0.4, deck - h * 0.02, w * 0.92, deck - h * 0.005);
    ctx.quadraticCurveTo(w * 0.86, deck + h * 0.13, w * 0.46, deck + h * 0.15);
    ctx.quadraticCurveTo(w * 0.16, deck + h * 0.12, w * 0.05, h * 0.62);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.645);
    ctx.quadraticCurveTo(w * 0.42, deck + h * 0.015, w * 0.9, deck + h * 0.03);
    ctx.stroke();
    // long bowsprit reaching off to the left
    spar(ctx, p, w * 0.08, h * 0.63, w * -0.04, h * 0.5, 4.5);
    // single mast, well aft, with gaff
    const mx = w * 0.66;
    spar(ctx, p, mx, h * 0.06, mx, deck, 5);
    spar(ctx, p, w * 0.5, deck - h * 0.05, w * 0.93, deck - h * 0.03, 3.5);
    spar(ctx, p, mx, h * 0.16, w * 0.92, h * 0.09, 3.5);
    // gaff mainsail
    ctx.beginPath();
    ctx.moveTo(mx + 2, h * 0.17);
    ctx.lineTo(w * 0.91, h * 0.1);
    ctx.lineTo(w * 0.92, deck - h * 0.04);
    ctx.lineTo(mx + 2, deck - h * 0.05);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    ink(ctx, p, 2.6);
    ctx.stroke();
    // twin headsails
    triSail(ctx, p, [mx - 2, h * 0.12], [w * -0.02, h * 0.51], [w * 0.3, h * 0.6],
      w * 0.28, h * 0.32, p.sail);
    triSail(ctx, p, [mx - 3, h * 0.26], [w * 0.16, h * 0.6], [w * 0.46, h * 0.62],
      w * 0.46, h * 0.42, p.paperDark);
    rig(ctx, p, [
      [mx, h * 0.07, w * 0.5, deck - h * 0.02],
      [mx, h * 0.07, w * 0.9, deck - h * 0.02],
      [mx, h * 0.07, w * -0.03, h * 0.5],
    ], 1.4, 0.55);
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = p.paper;
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.72);
    ctx.quadraticCurveTo(w * 0.1, h * 0.62, w * 0.2, h * 0.74);
    ctx.quadraticCurveTo(w * 0.1, h * 0.78, w * 0.02, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  'Maelstrom Berth': (ctx, w, h, p) => {
    const sy = h * 0.34;
    seaBand(ctx, w, h, p, sy, 0.72);
    waves(ctx, w, h, p, sy, 1, p.paper, 0.3);
    const cx = w * 0.5;
    const cy = h * 0.68;
    // the funnel, dark at its throat
    const g = ctx.createRadialGradient(cx, cy, w * 0.02, cx, cy, w * 0.38);
    g.addColorStop(0, p.ink);
    g.addColorStop(1, p.seaDeep);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.38, h * 0.3, 0, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    // the spiral itself
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 3;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let i = 0; i <= 260; i++) {
      const t = i / 260;
      const a = t * TAU * 3.1;
      const r = (1 - t * 0.95) * w * 0.36;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.62 + t * h * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
    ink(ctx, p, 3);
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.38, h * 0.3, 0, 0, TAU);
    ctx.stroke();
    // mooring dolphins driven around the rim
    const posts = [[0.06, 0.62], [0.14, 0.94], [0.88, 0.64], [0.95, 0.96]];
    for (let i = 0; i < posts.length; i++) {
      const px = w * posts[i][0];
      const py = h * posts[i][1];
      spar(ctx, p, px, py, px - w * 0.012, py - h * 0.42, 5, p.woodDark);
      spar(ctx, p, px + w * 0.035, py, px + w * 0.018, py - h * 0.36, 4, p.woodDark);
      ink(ctx, p, 2.4);
      ctx.beginPath();
      ctx.moveTo(px - w * 0.02, py - h * 0.3);
      ctx.lineTo(px + w * 0.05, py - h * 0.26);
      ctx.stroke();
    }
    // a heavy chain slung across the throat
    ctx.strokeStyle = p.metal;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.24);
    ctx.quadraticCurveTo(cx, h * 0.46, w * 0.92, h * 0.26);
    ctx.stroke();
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      const x = w * 0.08 + (w * 0.84) * t;
      const y = h * 0.24 + Math.sin(t * Math.PI) * h * 0.11 + t * h * 0.02;
      ctx.moveTo(x, y - h * 0.02);
      ctx.lineTo(x, y + h * 0.02);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.02, w * 0.04, h * 0.026, 0, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2);
    ctx.stroke();
  },

  // ---------------- emerald ----------------

  'Verdant Schooner': (ctx, w, h, p) => {
    const sy = h * 0.72;
    seaBand(ctx, w, h, p, sy, 0.7);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.35);
    // a low palm shore behind, to the left
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.1, h * 0.56, w * 0.24, h * 0.62);
    ctx.quadraticCurveTo(w * 0.32, h * 0.66, w * 0.38, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // hull, bow to the right, two raked masts
    const deck = h * 0.68;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, deck - h * 0.02);
    ctx.quadraticCurveTo(w * 0.5, deck - h * 0.05, w * 0.84, deck - h * 0.09);
    ctx.quadraticCurveTo(w * 0.74, deck + h * 0.1, w * 0.4, deck + h * 0.11);
    ctx.quadraticCurveTo(w * 0.22, deck + h * 0.09, w * 0.16, deck - h * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.wood;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(w * 0.16, deck + h * 0.01);
      c.quadraticCurveTo(w * 0.5, deck - h * 0.02, w * 0.84, deck - h * 0.07);
      c.quadraticCurveTo(w * 0.74, deck + h * 0.1, w * 0.4, deck + h * 0.11);
      c.quadraticCurveTo(w * 0.22, deck + h * 0.09, w * 0.16, deck + h * 0.01);
    }, w * 0.1, deck, w * 0.9, h, 8, p.woodDark, 0.35, 2);
    spar(ctx, p, w * 0.83, deck - h * 0.09, w * 0.96, h * 0.56, 3.5);
    const masts = [[0.36, 0.08], [0.58, 0.14]];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i][0];
      const topY = h * masts[i][1];
      spar(ctx, p, mx - w * 0.03, deck - h * 0.03, mx, topY, 4.5);
      // gaff spar and the fore-and-aft sail behind it
      const gx = mx + w * 0.15;
      spar(ctx, p, mx, topY + h * 0.04, gx - w * 0.02, topY - h * 0.01, 3);
      ctx.beginPath();
      ctx.moveTo(mx - w * 0.028, deck - h * 0.05);
      ctx.lineTo(mx + 1, topY + h * 0.05);
      ctx.lineTo(gx - w * 0.025, topY + h * 0.005);
      ctx.quadraticCurveTo(gx + w * 0.02, deck * 0.7, gx - w * 0.04, deck - h * 0.06);
      ctx.closePath();
      ctx.fillStyle = p.sail;
      ctx.fill();
      ink(ctx, p, 2.6);
      ctx.stroke();
      rig(ctx, p, [
        [mx, topY, mx - w * 0.09, deck - h * 0.02],
        [mx, topY, mx + w * 0.02, deck - h * 0.03],
      ], 1.3, 0.55);
    }
    // jib to the bowsprit
    triSail(ctx, p, [w * 0.582, h * 0.16], [w * 0.95, h * 0.57], [w * 0.72, h * 0.6],
      w * 0.66, h * 0.38, p.sail);
    pennant(ctx, p, w * 0.36, h * 0.075, -w * 0.1, p.accent);
  },

  'Jungle Hideaway': (ctx, w, h, p) => {
    // a still creek at the foot of the camp
    seaBand(ctx, w, h, p, h * 0.8, 0.55);
    waves(ctx, w, h, p, h * 0.8, 1, p.paper, 0.3);
    // green wall of jungle behind
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.86);
    ctx.lineTo(0, h * 0.52);
    ctx.quadraticCurveTo(w * 0.18, h * 0.34, w * 0.36, h * 0.5);
    ctx.quadraticCurveTo(w * 0.52, h * 0.32, w * 0.68, h * 0.48);
    ctx.quadraticCurveTo(w * 0.84, h * 0.34, w, h * 0.5);
    ctx.lineTo(w, h * 0.86);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2.6);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.52);
    ctx.quadraticCurveTo(w * 0.18, h * 0.34, w * 0.36, h * 0.5);
    ctx.quadraticCurveTo(w * 0.52, h * 0.32, w * 0.68, h * 0.48);
    ctx.quadraticCurveTo(w * 0.84, h * 0.34, w, h * 0.5);
    ctx.stroke();
    // hut on stilts
    const hx = w * 0.5;
    const hy = h * 0.62;
    ink(ctx, p, 3.4);
    for (let i = 0; i < 4; i++) {
      const x = hx - w * 0.15 + i * w * 0.1;
      ctx.beginPath();
      ctx.moveTo(x, hy + h * 0.02);
      ctx.lineTo(x + (i - 1.5) * w * 0.012, h * 0.88);
      ctx.stroke();
    }
    box(ctx, p, hx - w * 0.19, hy - h * 0.14, w * 0.38, h * 0.17, p.wood, 3.4);
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(hx - w * 0.19, hy - h * 0.07);
    ctx.lineTo(hx + w * 0.19, hy - h * 0.07);
    ctx.stroke();
    // thatched roof, wide-eaved
    ctx.beginPath();
    ctx.moveTo(hx - w * 0.26, hy - h * 0.13);
    ctx.lineTo(hx, hy - h * 0.36);
    ctx.lineTo(hx + w * 0.26, hy - h * 0.13);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(hx - w * 0.26, hy - h * 0.13);
      c.lineTo(hx, hy - h * 0.36);
      c.lineTo(hx + w * 0.26, hy - h * 0.13);
      c.closePath();
    }, hx - w * 0.3, hy - h * 0.36, hx + w * 0.3, hy - h * 0.1, 7, p.inkSoft, 0.45, 2);
    // doorway, lit from within
    box(ctx, p, hx - w * 0.045, hy - h * 0.12, w * 0.09, h * 0.15, p.accent, 2.6);
    // foreground fronds framing the view
    ctx.fillStyle = p.leaf;
    ink(ctx, p, 2.6);
    const frondBase = [[0.06, 0.96, 1.1], [0.94, 0.98, -1.1], [0.2, 1.02, 0.7]];
    for (let i = 0; i < frondBase.length; i++) {
      const fx = w * frondBase[i][0];
      const fy = h * frondBase[i][1];
      const dir = frondBase[i][2];
      for (let k = 0; k < 3; k++) {
        const a = -1.5 + k * 0.6 * dir;
        const tx = fx + Math.cos(a) * w * 0.24;
        const ty = fy + Math.sin(a) * h * 0.45;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.quadraticCurveTo((fx + tx) / 2 + w * 0.05 * dir, (fy + ty) / 2, tx, ty);
        ctx.quadraticCurveTo((fx + tx) / 2 - w * 0.02 * dir, (fy + ty) / 2 + h * 0.06, fx, fy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  },

  'Serpent Lagoon': (ctx, w, h, p) => {
    // a channel winding back between reed banks
    ctx.save();
    ctx.globalAlpha = 0.8;
    const g = ctx.createLinearGradient(0, h * 0.3, 0, h);
    g.addColorStop(0, p.sky);
    g.addColorStop(1, p.sea);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h);
    ctx.bezierCurveTo(w * 0.12, h * 0.76, w * 0.62, h * 0.66, w * 0.4, h * 0.5);
    ctx.bezierCurveTo(w * 0.26, h * 0.4, w * 0.56, h * 0.38, w * 0.58, h * 0.3);
    ctx.lineTo(w * 0.68, h * 0.3);
    ctx.bezierCurveTo(w * 0.66, h * 0.42, w * 0.42, h * 0.42, w * 0.56, h * 0.52);
    ctx.bezierCurveTo(w * 0.82, h * 0.68, w * 0.4, h * 0.78, w * 0.66, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 3.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, h);
    ctx.bezierCurveTo(w * 0.12, h * 0.76, w * 0.62, h * 0.66, w * 0.4, h * 0.5);
    ctx.bezierCurveTo(w * 0.26, h * 0.4, w * 0.56, h * 0.38, w * 0.58, h * 0.3);
    ctx.moveTo(w * 0.68, h * 0.3);
    ctx.bezierCurveTo(w * 0.66, h * 0.42, w * 0.42, h * 0.42, w * 0.56, h * 0.52);
    ctx.bezierCurveTo(w * 0.82, h * 0.68, w * 0.4, h * 0.78, w * 0.66, h);
    ctx.stroke();
    // mangrove banks on either side
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.42);
    ctx.quadraticCurveTo(w * 0.16, h * 0.3, w * 0.3, h * 0.46);
    ctx.quadraticCurveTo(w * 0.2, h * 0.74, w * 0.28, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, h);
    ctx.lineTo(w, h * 0.44);
    ctx.quadraticCurveTo(w * 0.86, h * 0.3, w * 0.72, h * 0.46);
    ctx.quadraticCurveTo(w * 0.8, h * 0.74, w * 0.7, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // the banks, outlined
    ink(ctx, p, 3);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.42);
    ctx.quadraticCurveTo(w * 0.16, h * 0.3, w * 0.3, h * 0.46);
    ctx.quadraticCurveTo(w * 0.2, h * 0.74, w * 0.28, h);
    ctx.moveTo(w, h * 0.44);
    ctx.quadraticCurveTo(w * 0.86, h * 0.3, w * 0.72, h * 0.46);
    ctx.quadraticCurveTo(w * 0.8, h * 0.74, w * 0.7, h);
    ctx.stroke();
    // reeds, clustered where the channel meets the bank
    ctx.strokeStyle = p.leaf;
    ctx.lineWidth = 2.4;
    const clumps = [[0.2, 0.86], [0.27, 0.66], [0.36, 0.52], [0.62, 0.5], [0.73, 0.68], [0.8, 0.9]];
    ctx.beginPath();
    for (let i = 0; i < clumps.length; i++) {
      const rx = w * clumps[i][0];
      const ry = h * clumps[i][1];
      for (let k = -1; k <= 1; k++) {
        const bx = rx + k * w * 0.022;
        ctx.moveTo(bx, ry);
        ctx.quadraticCurveTo(bx + k * w * 0.012, ry - h * 0.06, bx + k * w * 0.03, ry - h * 0.11);
      }
    }
    ctx.stroke();
    // the far treeline closing the lagoon
    ink(ctx, p, 2.8);
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.32);
    ctx.quadraticCurveTo(w * 0.36, h * 0.16, w * 0.52, h * 0.3);
    ctx.quadraticCurveTo(w * 0.66, h * 0.18, w * 0.82, h * 0.32);
    ctx.lineTo(w * 0.82, h * 0.36);
    ctx.lineTo(w * 0.2, h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // the channel's bright coil, caught by the sun
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.45, h * 0.94);
    ctx.bezierCurveTo(w * 0.3, h * 0.76, w * 0.6, h * 0.66, w * 0.47, h * 0.52);
    ctx.stroke();
    ctx.restore();
  },

  'Emerald Bay': (ctx, w, h, p) => {
    const sy = h * 0.5;
    seaBand(ctx, w, h, p, sy, 0.7);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.32);
    // low sun over the bay mouth
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.46, w * 0.08, 0, TAU);
    ctx.fillStyle = p.sail;
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2.4);
    ctx.stroke();
    // headlands, wooded, reaching in from both sides
    const arms = [
      { x0: 0, x1: 0.42, dir: 1 },
      { x0: 1, x1: 0.6, dir: -1 },
    ];
    for (let i = 0; i < arms.length; i++) {
      const a = arms[i];
      ctx.beginPath();
      ctx.moveTo(w * a.x0, h * 0.86);
      ctx.lineTo(w * a.x0, h * 0.34);
      ctx.quadraticCurveTo(w * (a.x0 + a.dir * 0.16), h * 0.28, w * (a.x0 + a.dir * 0.26), h * 0.42);
      ctx.quadraticCurveTo(w * (a.x1 - a.dir * 0.04), h * 0.46, w * a.x1, h * 0.56);
      ctx.quadraticCurveTo(w * (a.x1 - a.dir * 0.12), h * 0.74, w * (a.x0 + a.dir * 0.1), h * 0.94);
      ctx.closePath();
      ctx.fillStyle = p.leaf;
      ctx.fill();
      ink(ctx, p, 3.2);
      ctx.stroke();
      hatch(ctx, (c) => {
        c.moveTo(w * a.x0, h * 0.86);
        c.lineTo(w * a.x0, h * 0.34);
        c.quadraticCurveTo(w * (a.x0 + a.dir * 0.16), h * 0.28, w * (a.x0 + a.dir * 0.26), h * 0.42);
        c.quadraticCurveTo(w * (a.x1 - a.dir * 0.04), h * 0.46, w * a.x1, h * 0.56);
        c.quadraticCurveTo(w * (a.x1 - a.dir * 0.12), h * 0.74, w * (a.x0 + a.dir * 0.1), h * 0.94);
        c.closePath();
      }, -w * 0.1, h * 0.3, w * 1.1, h, 9, p.woodDark, 0.32, 2);
      // trees on the crest
      for (let k = 0; k < 4; k++) {
        const tx = w * (a.x0 + a.dir * (0.05 + k * 0.08));
        const ty = h * (0.36 + k * 0.045);
        poly(ctx, p, [[tx - w * 0.026, ty], [tx, ty - h * 0.13], [tx + w * 0.026, ty]], p.leaf, 2.4);
      }
    }
    // a ship at anchor in the bay mouth
    const bx = w * 0.5;
    const by = h * 0.68;
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.07, by);
    ctx.lineTo(bx + w * 0.07, by);
    ctx.quadraticCurveTo(bx + w * 0.045, by + h * 0.055, bx, by + h * 0.06);
    ctx.quadraticCurveTo(bx - w * 0.045, by + h * 0.055, bx - w * 0.07, by);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 2.6);
    ctx.stroke();
    spar(ctx, p, bx - w * 0.025, by, bx - w * 0.025, h * 0.5, 3);
    spar(ctx, p, bx + w * 0.03, by, bx + w * 0.03, h * 0.54, 3);
    rig(ctx, p, [
      [bx - w * 0.025, h * 0.5, bx + w * 0.03, h * 0.54],
      [bx + w * 0.03, h * 0.54, bx + w * 0.07, by - h * 0.005],
    ], 1.4, 0.6);
    pennant(ctx, p, bx - w * 0.025, h * 0.5, w * 0.07, p.accent);
  },

  'Palmwood Barque': (ctx, w, h, p) => {
    const sy = h * 0.76;
    seaBand(ctx, w, h, p, sy, 0.7);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.35);
    // long shallow hull, bow to the left, no castles
    const deck = h * 0.72;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.6);
    ctx.lineTo(w * 0.17, deck - h * 0.02);
    ctx.lineTo(w * 0.88, deck - h * 0.02);
    ctx.lineTo(w * 0.9, h * 0.58);
    ctx.lineTo(w * 0.93, deck + h * 0.03);
    ctx.quadraticCurveTo(w * 0.56, h * 0.92, w * 0.14, deck + h * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.wood;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.15, deck + h * 0.02);
    ctx.quadraticCurveTo(w * 0.55, deck + h * 0.07, w * 0.92, deck + h * 0.015);
    ctx.stroke();
    // deck cargo: bundled palm timber
    for (let i = 0; i < 3; i++) {
      box(ctx, p, w * (0.36 + i * 0.12), deck - h * 0.09, w * 0.1, h * 0.07, p.woodDark, 2.4);
    }
    spar(ctx, p, w * 0.14, h * 0.6, w * 0.0, h * 0.46, 4);
    // two square-rigged masts, one fore-and-aft aft
    const masts = [[0.32, 0.1], [0.56, 0.06]];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i][0];
      const topY = h * masts[i][1];
      spar(ctx, p, mx, topY, mx, deck - h * 0.05, 4.5);
      spar(ctx, p, mx - w * 0.08, topY + h * 0.07, mx + w * 0.08, topY + h * 0.07, 3);
      spar(ctx, p, mx - w * 0.1, topY + h * 0.33, mx + w * 0.1, topY + h * 0.33, 3);
      squareSail(ctx, p, mx, topY + h * 0.07, topY + h * 0.27, w * 0.077, w * 0.095, -w * 0.05);
      squareSail(ctx, p, mx, topY + h * 0.33, topY + h * 0.56, w * 0.097, w * 0.11, -w * 0.05);
      rig(ctx, p, [
        [mx, topY, mx - w * 0.07, deck - h * 0.04],
        [mx, topY, mx + w * 0.07, deck - h * 0.04],
      ], 1.3, 0.55);
    }
    spar(ctx, p, w * 0.78, h * 0.18, w * 0.78, deck - h * 0.04, 4.5);
    triSail(ctx, p, [w * 0.78, h * 0.22], [w * 0.78, deck - h * 0.1], [w * 0.91, deck - h * 0.12],
      w * 0.9, h * 0.4, p.sail);
    rig(ctx, p, [
      [w * 0.78, h * 0.18, w * 0.56, h * 0.06],
      [w * 0.56, h * 0.06, w * 0.32, h * 0.1],
      [w * 0.32, h * 0.1, w * 0.005, h * 0.465],
    ], 1.4, 0.55);
    pennant(ctx, p, w * 0.56, h * 0.055, w * 0.1, p.accent);
  },

  'Smugglers Grove': (ctx, w, h, p) => {
    // sand and a sliver of water at the left
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.sea;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.54);
    ctx.lineTo(w * 0.22, h * 0.56);
    ctx.lineTo(w * 0.14, h * 0.78);
    ctx.lineTo(0, h * 0.76);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ink(ctx, p, 2.4);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.54);
    ctx.lineTo(w * 0.22, h * 0.56);
    ctx.stroke();
    // palm trunks, deep in the grove
    const trunks = [[0.3, 0.9, 0.24, 0.24], [0.62, 0.94, 0.66, 0.2], [0.86, 0.88, 0.8, 0.3]];
    for (let i = 0; i < trunks.length; i++) {
      const bx = w * trunks[i][0];
      const by = h * trunks[i][1];
      const tx = w * trunks[i][2];
      const ty = h * trunks[i][3];
      ctx.strokeStyle = p.woodDark;
      ctx.lineWidth = 6 - i;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + (tx - bx) * 0.3, (by + ty) * 0.5, tx, ty);
      ctx.stroke();
      palmCrown(ctx, p, tx, ty, w * (0.115 - i * 0.012), 5, i === 1 ? 0.5 : -0.5);
    }
    // the sand the cache stands on
    ctx.save();
    ctx.globalAlpha = 0.4;
    ink(ctx, p, 2.5);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.9);
    ctx.quadraticCurveTo(w * 0.5, h * 0.82, w, h * 0.86);
    ctx.stroke();
    ctx.restore();
    // stacked contraband
    box(ctx, p, w * 0.28, h * 0.62, w * 0.21, h * 0.23, p.wood, 3.4);
    box(ctx, p, w * 0.51, h * 0.68, w * 0.14, h * 0.17, p.wood, 3.2);
    box(ctx, p, w * 0.31, h * 0.44, w * 0.15, h * 0.18, p.woodDark, 3.2);
    ink(ctx, p, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.735);
    ctx.lineTo(w * 0.49, h * 0.735);
    ctx.moveTo(w * 0.385, h * 0.62);
    ctx.lineTo(w * 0.385, h * 0.85);
    ctx.moveTo(w * 0.51, h * 0.765);
    ctx.lineTo(w * 0.65, h * 0.765);
    ctx.stroke();
    // an upright keg beside them
    const kx = w * 0.75;
    const kt = h * 0.6;
    const kb = h * 0.86;
    const kw = w * 0.05;
    ctx.beginPath();
    ctx.moveTo(kx - kw, kt);
    ctx.quadraticCurveTo(kx - kw * 1.5, (kt + kb) / 2, kx - kw, kb);
    ctx.lineTo(kx + kw, kb);
    ctx.quadraticCurveTo(kx + kw * 1.5, (kt + kb) / 2, kx + kw, kt);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(kx - kw * 1.36, h * 0.68);
    ctx.quadraticCurveTo(kx, h * 0.71, kx + kw * 1.36, h * 0.68);
    ctx.moveTo(kx - kw * 1.36, h * 0.78);
    ctx.quadraticCurveTo(kx, h * 0.81, kx + kw * 1.36, h * 0.78);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(kx, kt, kw, h * 0.028, 0, 0, TAU);
    ctx.fillStyle = p.wood;
    ctx.fill();
    ctx.stroke();
    // a sheet of canvas thrown over the topmost crate
    ctx.beginPath();
    ctx.moveTo(w * 0.27, h * 0.6);
    ctx.quadraticCurveTo(w * 0.28, h * 0.43, w * 0.385, h * 0.41);
    ctx.quadraticCurveTo(w * 0.49, h * 0.43, w * 0.5, h * 0.6);
    ctx.quadraticCurveTo(w * 0.44, h * 0.565, w * 0.385, h * 0.61);
    ctx.quadraticCurveTo(w * 0.32, h * 0.565, w * 0.27, h * 0.6);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.335, h * 0.425);
    ctx.lineTo(w * 0.325, h * 0.585);
    ctx.moveTo(w * 0.435, h * 0.425);
    ctx.lineTo(w * 0.445, h * 0.585);
    ctx.stroke();
    // a dinghy drawn up on the sand
    ctx.beginPath();
    ctx.moveTo(w * 0.01, h * 0.8);
    ctx.quadraticCurveTo(w * 0.12, h * 0.76, w * 0.25, h * 0.84);
    ctx.quadraticCurveTo(w * 0.13, h, w * 0.01, h * 0.8);
    ctx.closePath();
    ctx.fillStyle = p.wood;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    ink(ctx, p, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.055, h * 0.83);
    ctx.lineTo(w * 0.09, h * 0.93);
    ctx.moveTo(w * 0.145, h * 0.845);
    ctx.lineTo(w * 0.17, h * 0.93);
    ctx.stroke();
  },

  // ---------------- ruby ----------------

  'Crimson Frigate': (ctx, w, h, p) => {
    const sy = h * 0.8;
    seaBand(ctx, w, h, p, sy, 0.72);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.4);
    // close broadside, bow to the right, masts running off the top
    const deck = h * 0.66;
    ctx.beginPath();
    ctx.moveTo(w * 0.02, deck - h * 0.06);
    ctx.lineTo(w * 0.06, deck - h * 0.12);
    ctx.lineTo(w * 0.86, deck - h * 0.14);
    ctx.quadraticCurveTo(w * 0.98, deck - h * 0.05, w * 0.92, deck + h * 0.12);
    ctx.quadraticCurveTo(w * 0.5, h * 0.94, w * 0.05, deck + h * 0.1);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.6);
    ctx.stroke();
    // a broad painted strake carrying the gun deck
    ctx.beginPath();
    ctx.moveTo(w * 0.04, deck - h * 0.03);
    ctx.lineTo(w * 0.88, deck - h * 0.05);
    ctx.lineTo(w * 0.89, deck + h * 0.06);
    ctx.lineTo(w * 0.04, deck + h * 0.08);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2.6);
    ctx.stroke();
    // gun ports, one open and firing
    for (let i = 0; i < 7; i++) {
      const x = w * (0.08 + i * 0.115);
      box(ctx, p, x, deck - h * 0.015, w * 0.06, h * 0.055, p.ink, 2.4);
    }
    spar(ctx, p, w * 0.14, deck + h * 0.01, w * 0.235, deck + h * 0.01, 5, p.metalDark);
    // gunsmoke rolling off the side
    smoke(ctx, p, w * 0.26, deck + h * 0.01, w * 0.045, 3, -w * 0.06);
    // three masts, cropped by the panel top
    const masts = [0.24, 0.5, 0.74];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i];
      spar(ctx, p, mx, -h * 0.02, mx, deck - h * 0.12, 5);
      const yA = h * (0.1 + i * 0.03);
      spar(ctx, p, mx - w * 0.1, yA, mx + w * 0.1, yA, 3.5);
      squareSail(ctx, p, mx, yA, yA + h * 0.26, w * 0.095, w * 0.11, -w * 0.05);
      rig(ctx, p, [
        [mx, 0, mx - w * 0.09, deck - h * 0.12],
        [mx, 0, mx + w * 0.09, deck - h * 0.12],
      ], 1.3, 0.5);
    }
    // bowsprit and ensign staff
    spar(ctx, p, w * 0.88, deck - h * 0.13, w * 0.99, deck - h * 0.26, 4);
    spar(ctx, p, w * 0.04, deck - h * 0.1, w * 0.02, h * 0.3, 3.5);
    ink(ctx, p, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.025, h * 0.32);
    ctx.lineTo(w * 0.11, h * 0.35);
    ctx.lineTo(w * 0.025, h * 0.42);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ctx.stroke();
  },

  'Cannon Foundry': (ctx, w, h, p) => {
    // the foundry: a squat stone hall with a tall stack
    const gy = h * 0.82;
    ink(ctx, p, 2.5);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    box(ctx, p, w * 0.26, h * 0.34, w * 0.5, h * 0.48, p.paperDark, 3.4);
    poly(ctx, p, [[w * 0.22, h * 0.34], [w * 0.51, h * 0.14], [w * 0.8, h * 0.34]], p.woodDark, 3.4);
    hatch(ctx, (c) => {
      c.moveTo(w * 0.22, h * 0.34);
      c.lineTo(w * 0.51, h * 0.14);
      c.lineTo(w * 0.8, h * 0.34);
      c.closePath();
    }, w * 0.2, h * 0.12, w * 0.82, h * 0.36, 8, p.ink, 0.3, 2);
    // chimney
    box(ctx, p, w * 0.62, h * 0.06, w * 0.12, h * 0.3, p.inkSoft, 3.4);
    box(ctx, p, w * 0.6, h * 0.04, w * 0.16, h * 0.04, p.ink, 3);
    smoke(ctx, p, w * 0.68, h * 0.02, w * 0.05, 3, w * 0.1);
    // the furnace mouth, glowing
    ctx.beginPath();
    ctx.moveTo(w * 0.36, gy);
    ctx.lineTo(w * 0.36, h * 0.58);
    ctx.quadraticCurveTo(w * 0.44, h * 0.46, w * 0.52, h * 0.58);
    ctx.lineTo(w * 0.52, gy);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    flame(ctx, p, w * 0.44, gy - h * 0.01, w * 0.055, h * 0.2, p.accent);
    // stone courses on the hall
    ink(ctx, p, 1.8);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      ctx.moveTo(w * 0.26, h * (0.34 + i * 0.12));
      ctx.lineTo(w * 0.76, h * (0.34 + i * 0.12));
    }
    ctx.stroke();
    // a fresh barrel on its skid in the foreground
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.76);
    ctx.lineTo(w * 0.3, h * 0.68);
    ctx.lineTo(w * 0.3, h * 0.78);
    ctx.lineTo(w * 0.04, h * 0.88);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w * 0.045, h * 0.82, w * 0.022, h * 0.06, 0, 0, TAU);
    ctx.fillStyle = p.metal;
    ctx.fill();
    ctx.stroke();
    ink(ctx, p, 2.4);
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.71);
    ctx.lineTo(w * 0.2, h * 0.81);
    ctx.moveTo(w * 0.26, h * 0.695);
    ctx.lineTo(w * 0.26, h * 0.795);
    ctx.stroke();
    // sheer legs over the skid
    spar(ctx, p, w * 0.1, h * 0.86, w * 0.22, h * 0.44, 3.5);
    spar(ctx, p, w * 0.32, h * 0.84, w * 0.22, h * 0.44, 3.5);
  },

  'Ember Harbour': (ctx, w, h, p) => {
    const sy = h * 0.52;
    seaBand(ctx, w, h, p, sy, 0.75);
    waves(ctx, w, h, p, sy, 2, p.flame, 0.22);
    // the far mole, with ships' masts behind it
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    rectPath(ctx, 0, h * 0.44, w, h * 0.08);
    ctx.fill();
    ctx.restore();
    // ships lying at their moorings, black against the dusk
    const ships = [[0.17, 0.18, 1], [0.46, 0.1, -1], [0.8, 0.22, 1]];
    for (let i = 0; i < ships.length; i++) {
      const sx = w * ships[i][0];
      const topY = h * ships[i][1];
      const dir = ships[i][2];
      ctx.beginPath();
      ctx.moveTo(sx - w * 0.12, h * 0.55);
      ctx.lineTo(sx + w * 0.12, h * 0.55);
      ctx.quadraticCurveTo(sx + w * 0.08, h * 0.645, sx, h * 0.65);
      ctx.quadraticCurveTo(sx - w * 0.08, h * 0.645, sx - w * 0.12, h * 0.55);
      ctx.closePath();
      ctx.fillStyle = p.ink;
      ctx.fill();
      ctx.strokeStyle = p.ink;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, h * 0.55);
      ctx.lineTo(sx, topY);
      ctx.moveTo(sx - w * 0.07, topY + h * 0.1);
      ctx.lineTo(sx + w * 0.07, topY + h * 0.08);
      ctx.moveTo(sx + dir * w * 0.115, h * 0.555);
      ctx.lineTo(sx + dir * w * 0.2, h * 0.48);
      ctx.moveTo(sx, topY);
      ctx.lineTo(sx + dir * w * 0.2, h * 0.48);
      ctx.moveTo(sx, topY);
      ctx.lineTo(sx - dir * w * 0.11, h * 0.55);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // harbour wall across the foreground
    box(ctx, p, 0, h * 0.74, w, h * 0.26, p.paperDark, 3.4);
    ink(ctx, p, 2);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      ctx.moveTo(w * (i / 6), h * 0.74);
      ctx.lineTo(w * (i / 6), h);
    }
    ctx.moveTo(0, h * 0.87);
    ctx.lineTo(w, h * 0.87);
    ctx.stroke();
    // steps down to the water
    poly(ctx, p, [
      [w * 0.4, h * 0.74], [w * 0.58, h * 0.74], [w * 0.52, h], [w * 0.34, h],
    ], p.inkSoft, 3);
    ink(ctx, p, 2);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      ctx.moveTo(w * (0.4 - t * 0.06), h * (0.74 + t * 0.26));
      ctx.lineTo(w * (0.58 - t * 0.06), h * (0.74 + t * 0.26));
    }
    ctx.stroke();
    // braziers burning on their posts
    const posts = [0.14, 0.84];
    for (let i = 0; i < posts.length; i++) {
      const px = w * posts[i];
      spar(ctx, p, px, h * 0.74, px, h * 0.5, 5, p.metalDark);
      poly(ctx, p, [
        [px - w * 0.05, h * 0.46], [px + w * 0.05, h * 0.46],
        [px + w * 0.032, h * 0.53], [px - w * 0.032, h * 0.53],
      ], p.metalDark, 3);
      flame(ctx, p, px, h * 0.46, w * 0.04, h * 0.18, i === 0 ? p.accent : null);
    }
  },

  'Bloodtide Raider': (ctx, w, h, p) => {
    const sy = h * 0.68;
    seaBand(ctx, w, h, p, sy, 0.78);
    waves(ctx, w, h, p, sy, 3, p.paper, 0.4);
    // a long low raider driving to the left, oars out
    const deck = h * 0.66;
    ctx.strokeStyle = p.ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = w * (0.28 + i * 0.1);
      ctx.moveTo(x, deck - h * 0.01);
      ctx.lineTo(x - w * 0.09, h * 0.86);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.52);
    ctx.quadraticCurveTo(w * 0.14, deck - h * 0.03, w * 0.26, deck - h * 0.02);
    ctx.lineTo(w * 0.86, deck - h * 0.05);
    ctx.quadraticCurveTo(w * 0.95, h * 0.5, w * 0.97, deck - h * 0.02);
    ctx.quadraticCurveTo(w * 0.6, h * 0.86, w * 0.13, deck + h * 0.05);
    ctx.quadraticCurveTo(w * 0.07, h * 0.6, w * 0.06, h * 0.52);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    // a ram at the waterline
    poly(ctx, p, [
      [w * 0.1, deck + h * 0.02], [w * -0.02, deck + h * 0.04], [w * 0.11, deck + h * 0.09],
    ], p.metalDark, 3);
    // shields hung along the gunwale
    for (let i = 0; i < 6; i++) {
      const x = w * (0.3 + i * 0.1);
      ctx.beginPath();
      ctx.arc(x, deck + h * 0.01, w * 0.034, 0, TAU);
      ctx.fillStyle = i === 2 ? p.accent : p.wood;
      ctx.fill();
      ink(ctx, p, 2.4);
      ctx.stroke();
    }
    // a single raked mast with a lug sail
    const mx = w * 0.58;
    spar(ctx, p, mx + w * 0.05, deck - h * 0.04, mx - w * 0.02, h * 0.08, 5);
    spar(ctx, p, w * 0.3, h * 0.2, w * 0.86, h * 0.12, 3.5);
    ctx.beginPath();
    ctx.moveTo(w * 0.31, h * 0.2);
    ctx.lineTo(w * 0.85, h * 0.125);
    ctx.quadraticCurveTo(w * 0.82, h * 0.4, w * 0.8, deck - h * 0.09);
    ctx.quadraticCurveTo(w * 0.56, h * 0.52, w * 0.34, deck - h * 0.07);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.42, h * 0.185);
    ctx.quadraticCurveTo(w * 0.44, h * 0.42, w * 0.45, deck - h * 0.08);
    ctx.moveTo(w * 0.62, h * 0.16);
    ctx.quadraticCurveTo(w * 0.64, h * 0.4, w * 0.65, deck - h * 0.09);
    ctx.stroke();
    rig(ctx, p, [
      [mx - w * 0.02, h * 0.08, w * 0.12, h * 0.56],
      [mx - w * 0.02, h * 0.08, w * 0.95, h * 0.56],
    ], 1.4, 0.55);
  },

  'Ruby Anchorage': (ctx, w, h, p) => {
    const sy = h * 0.48;
    seaBand(ctx, w, h, p, sy, 0.6);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.3);
    // a moored ship, small, in the distance
    const bx = w * 0.72;
    const by = h * 0.44;
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.11, by);
    ctx.lineTo(bx + w * 0.11, by);
    ctx.quadraticCurveTo(bx + w * 0.07, by + h * 0.08, bx, by + h * 0.09);
    ctx.quadraticCurveTo(bx - w * 0.07, by + h * 0.08, bx - w * 0.11, by);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 2.8);
    ctx.stroke();
    spar(ctx, p, bx - w * 0.04, by, bx - w * 0.04, h * 0.12, 3.5);
    spar(ctx, p, bx + w * 0.05, by, bx + w * 0.05, h * 0.18, 3.5);
    spar(ctx, p, bx - w * 0.09, h * 0.2, bx + w * 0.01, h * 0.2, 2.6);
    rig(ctx, p, [
      [bx - w * 0.04, h * 0.12, bx + w * 0.05, h * 0.18],
      [bx + w * 0.05, h * 0.18, bx + w * 0.11, by - h * 0.01],
      [bx - w * 0.04, h * 0.12, bx - w * 0.11, by - h * 0.01],
    ], 1.4, 0.6);
    // the great anchor, close to the eye
    const ax = w * 0.34;
    const shankTop = h * 0.18;
    const shankBot = h * 0.86;
    ctx.strokeStyle = p.metalDark;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(ax, shankTop);
    ctx.lineTo(ax, shankBot - h * 0.12);
    ctx.stroke();
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.13, h * 0.3);
    ctx.lineTo(ax + w * 0.13, h * 0.3);
    ctx.stroke();
    // the crown, a heavy curved arm from fluke to fluke
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.2, h * 0.58);
    ctx.quadraticCurveTo(ax - w * 0.18, shankBot, ax, shankBot);
    ctx.quadraticCurveTo(ax + w * 0.18, shankBot, ax + w * 0.2, h * 0.58);
    ctx.lineTo(ax + w * 0.13, h * 0.58);
    ctx.quadraticCurveTo(ax + w * 0.115, h * 0.76, ax, h * 0.76);
    ctx.quadraticCurveTo(ax - w * 0.115, h * 0.76, ax - w * 0.13, h * 0.58);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    poly(ctx, p, [
      [ax - w * 0.245, h * 0.48], [ax - w * 0.115, h * 0.575], [ax - w * 0.205, h * 0.66],
    ], p.metal, 3.2);
    poly(ctx, p, [
      [ax + w * 0.245, h * 0.48], [ax + w * 0.115, h * 0.575], [ax + w * 0.205, h * 0.66],
    ], p.metal, 3.2);
    // the ring at the head
    ctx.beginPath();
    ctx.arc(ax, shankTop - h * 0.04, w * 0.05, 0, TAU);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 6;
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.stroke();
  },

  'Powder Magazine': (ctx, w, h, p) => {
    const gy = h * 0.84;
    ink(ctx, p, 2.5);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
    // squat barrel-vaulted stone vault
    const x0 = w * 0.22;
    const x1 = w * 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, gy);
    ctx.lineTo(x0, h * 0.44);
    ctx.quadraticCurveTo(w * 0.51, h * 0.06, x1, h * 0.44);
    ctx.lineTo(x1, gy);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3.6);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(w * 0.6, gy);
      c.lineTo(w * 0.6, h * 0.3);
      c.quadraticCurveTo(w * 0.72, h * 0.28, x1, h * 0.44);
      c.lineTo(x1, gy);
      c.closePath();
    }, w * 0.5, h * 0.2, w * 0.85, gy, 8, p.inkSoft, 0.4, 2);
    // buttresses
    poly(ctx, p, [[w * 0.12, gy], [x0, h * 0.5], [x0, gy]], p.inkSoft, 3.2);
    poly(ctx, p, [[w * 0.9, gy], [x1, h * 0.5], [x1, gy]], p.inkSoft, 3.2);
    // ironbound door in a deep arch
    ctx.beginPath();
    ctx.moveTo(w * 0.4, gy);
    ctx.lineTo(w * 0.4, h * 0.52);
    ctx.quadraticCurveTo(w * 0.51, h * 0.34, w * 0.62, h * 0.52);
    ctx.lineTo(w * 0.62, gy);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.4, h * 0.62);
    ctx.lineTo(w * 0.62, h * 0.62);
    ctx.moveTo(w * 0.4, h * 0.74);
    ctx.lineTo(w * 0.62, h * 0.74);
    ctx.stroke();
    // stone courses
    ink(ctx, p, 1.8);
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const y = h * (0.44 + i * 0.1);
      ctx.moveTo(x0, y);
      ctx.lineTo(w * 0.4, y);
      ctx.moveTo(w * 0.62, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
    // kegs stacked outside, and a lightning rod above
    const kegs = [[0.1, 0.78], [0.19, 0.9], [0.88, 0.8]];
    for (let i = 0; i < kegs.length; i++) {
      const kx = w * kegs[i][0];
      const ky = h * kegs[i][1];
      ctx.beginPath();
      ctx.ellipse(kx, ky, w * 0.055, h * 0.085, 0, 0, TAU);
      ctx.fillStyle = p.wood;
      ctx.fill();
      ink(ctx, p, 3);
      ctx.stroke();
      ink(ctx, p, 2);
      ctx.beginPath();
      ctx.moveTo(kx - w * 0.055, ky - h * 0.02);
      ctx.lineTo(kx + w * 0.055, ky - h * 0.02);
      ctx.stroke();
    }
    // a lightning rod on the crown of the vault
    spar(ctx, p, w * 0.51, h * 0.25, w * 0.51, h * 0.1, 3.2, p.metalDark);
    ctx.beginPath();
    ctx.arc(w * 0.51, h * 0.085, w * 0.016, 0, TAU);
    ctx.fillStyle = p.metal;
    ctx.fill();
    ink(ctx, p, 2);
    ctx.stroke();
  },

  // ---------------- onyx ----------------

  'Blackwater Galleon': (ctx, w, h, p) => {
    const sy = h * 0.76;
    seaBand(ctx, w, h, p, sy, 0.85);
    waves(ctx, w, h, p, sy, 2, p.inkSoft, 0.4);
    // seen from the stern quarter: transom towards us, bow away right
    const deck = h * 0.7;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.32);
    ctx.lineTo(w * 0.34, h * 0.3);
    ctx.lineTo(w * 0.36, deck - h * 0.04);
    ctx.lineTo(w * 0.86, deck - h * 0.16);
    ctx.lineTo(w * 0.92, deck + h * 0.02);
    ctx.quadraticCurveTo(w * 0.6, h * 0.94, w * 0.22, deck + h * 0.12);
    ctx.lineTo(w * 0.06, deck + h * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    // the transom, with its galleries of windows
    box(ctx, p, w * 0.08, h * 0.32, w * 0.26, h * 0.38, p.woodDark, 3.2);
    ctx.fillStyle = p.accent;
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        rectPath(ctx, w * (0.115 + i * 0.075), h * (0.38 + r * 0.14), w * 0.05, h * 0.09);
        ctx.fill();
        ink(ctx, p, 2.2);
        ctx.stroke();
      }
    }
    // stern lanterns
    ctx.beginPath();
    ctx.arc(w * 0.1, h * 0.28, w * 0.022, 0, TAU);
    ctx.fillStyle = p.metal;
    ctx.fill();
    ink(ctx, p, 2);
    ctx.stroke();
    // three masts, sails brailed up to the yards
    const masts = [[0.44, 0.14], [0.62, 0.08], [0.8, 0.2]];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i][0];
      const topY = h * masts[i][1];
      spar(ctx, p, mx, topY, mx, deck - h * 0.08, 4.5, p.ink);
      const yA = topY + h * 0.1;
      const yB = topY + h * 0.3;
      spar(ctx, p, mx - w * 0.08, yA, mx + w * 0.08, yA, 3.5, p.ink);
      spar(ctx, p, mx - w * 0.1, yB, mx + w * 0.1, yB, 3.5, p.ink);
      // furled canvas gathered along each yard
      for (let k = 0; k < 2; k++) {
        const yy = k === 0 ? yA : yB;
        const half = k === 0 ? w * 0.075 : w * 0.095;
        ctx.beginPath();
        ctx.moveTo(mx - half, yy);
        ctx.quadraticCurveTo(mx, yy + h * 0.045, mx + half, yy);
        ctx.quadraticCurveTo(mx, yy + h * 0.015, mx - half, yy);
        ctx.closePath();
        ctx.fillStyle = p.inkSoft;
        ctx.fill();
        ink(ctx, p, 2.2);
        ctx.stroke();
      }
      rig(ctx, p, [
        [mx, topY, mx - w * 0.06, deck - h * 0.09],
        [mx, topY, mx + w * 0.06, deck - h * 0.1],
      ], 1.3, 0.5);
    }
    rig(ctx, p, [
      [w * 0.44, h * 0.14, w * 0.62, h * 0.08],
      [w * 0.62, h * 0.08, w * 0.8, h * 0.2],
      [w * 0.44, h * 0.14, w * 0.2, h * 0.31],
    ], 1.4, 0.5);
  },

  'Smugglers Vault': (ctx, w, h, p) => {
    // cliff face, filling the panel edge to edge but not the top
    ctx.beginPath();
    ctx.moveTo(0, h * 0.18);
    ctx.lineTo(w * 0.22, h * 0.1);
    ctx.lineTo(w * 0.5, h * 0.2);
    ctx.lineTo(w * 0.78, h * 0.08);
    ctx.lineTo(w, h * 0.16);
    ctx.lineTo(w, h * 0.92);
    ctx.lineTo(0, h * 0.92);
    ctx.closePath();
    ctx.fillStyle = p.inkSoft;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    hatch(ctx, (c) => {
      c.moveTo(0, h * 0.18);
      c.lineTo(w, h * 0.16);
      c.lineTo(w, h * 0.92);
      c.lineTo(0, h * 0.92);
      c.closePath();
    }, 0, h * 0.1, w, h * 0.92, 11, p.ink, 0.3, 2);
    // the cave mouth
    const cx = w * 0.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.92);
    ctx.lineTo(w * 0.3, h * 0.52);
    ctx.quadraticCurveTo(cx, h * 0.18, w * 0.7, h * 0.52);
    ctx.lineTo(w * 0.72, h * 0.92);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.6);
    ctx.stroke();
    // an iron grate across it
    ctx.strokeStyle = p.metal;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = w * (0.32 + t * 0.36);
      const top = h * (0.52 - Math.sin(t * Math.PI) * 0.24);
      ctx.moveTo(x, h * 0.92);
      ctx.lineTo(x, top);
    }
    ctx.moveTo(w * 0.31, h * 0.62);
    ctx.lineTo(w * 0.69, h * 0.62);
    ctx.moveTo(w * 0.3, h * 0.82);
    ctx.lineTo(w * 0.7, h * 0.82);
    ctx.stroke();
    // a chest and casks in the gloom, just inside
    box(ctx, p, w * 0.36, h * 0.7, w * 0.16, h * 0.13, p.wood, 3);
    ctx.beginPath();
    ctx.moveTo(w * 0.36, h * 0.7);
    ctx.quadraticCurveTo(w * 0.44, h * 0.6, w * 0.52, h * 0.7);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(w * 0.6, h * 0.78, w * 0.045, h * 0.07, 0, 0, TAU);
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ctx.stroke();
    // one lantern hung by the mouth
    spar(ctx, p, w * 0.24, h * 0.34, w * 0.24, h * 0.46, 2.6, p.metalDark);
    ctx.beginPath();
    ctx.moveTo(w * 0.205, h * 0.52);
    ctx.lineTo(w * 0.275, h * 0.52);
    ctx.lineTo(w * 0.265, h * 0.46);
    ctx.lineTo(w * 0.215, h * 0.46);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2.4);
    ctx.stroke();
  },

  'Obsidian Cay': (ctx, w, h, p) => {
    const sy = h * 0.72;
    seaBand(ctx, w, h, p, sy, 0.8);
    waves(ctx, w, h, p, sy, 3, p.inkSoft, 0.35);
    // a black glass islet of splintered spires
    const spires = [
      [[0.12, 0.76], [0.2, 0.38], [0.26, 0.5], [0.3, 0.76]],
      [[0.26, 0.78], [0.42, 0.14], [0.5, 0.36], [0.56, 0.78]],
      [[0.52, 0.78], [0.64, 0.3], [0.7, 0.46], [0.78, 0.78]],
      [[0.72, 0.76], [0.84, 0.46], [0.94, 0.76]],
    ];
    for (let i = 0; i < spires.length; i++) {
      const pts = spires[i].map((q) => [w * q[0], h * q[1]]);
      poly(ctx, p, pts, p.ink, 3.4);
      // a facet catching what light there is
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[1][0] + w * 0.03, pts[1][1] + h * 0.06);
      ctx.lineTo(pts[pts.length - 1][0] - w * 0.03, pts[pts.length - 1][1]);
      ctx.lineTo(pts[1][0] - w * 0.01, pts[1][1] + h * 0.04);
      ctx.closePath();
      ctx.fillStyle = i === 1 ? p.accent : p.metal;
      ctx.fill();
      ctx.restore();
    }
    // the shore ledge the spires stand on
    ctx.beginPath();
    ctx.moveTo(w * 0.04, h * 0.8);
    ctx.quadraticCurveTo(w * 0.5, h * 0.68, w * 0.98, h * 0.8);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.04, h * 0.8);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    // a thin plume from a vent
    smoke(ctx, p, w * 0.43, h * 0.12, w * 0.035, 3, -w * 0.07);
    // surf breaking against the black rock
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = p.paper;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(w * 0.02, h * 0.86);
    ctx.quadraticCurveTo(w * 0.16, h * 0.78, w * 0.3, h * 0.88);
    ctx.moveTo(w * 0.62, h * 0.88);
    ctx.quadraticCurveTo(w * 0.78, h * 0.78, w * 0.94, h * 0.9);
    ctx.stroke();
    ctx.restore();
  },

  'Nightfall Corvette': (ctx, w, h, p) => {
    const sy = h * 0.7;
    seaBand(ctx, w, h, p, sy, 0.85);
    // crescent moon low in the sky, and the path it lays on the water
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.2, w * 0.075, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(w * 0.745, h * 0.175, w * 0.07, 0, TAU);
    ctx.fillStyle = p.paper;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.paper;
    ctx.beginPath();
    ctx.moveTo(w * 0.74, sy);
    ctx.lineTo(w * 0.82, sy);
    ctx.lineTo(w * 0.95, h);
    ctx.lineTo(w * 0.6, h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // stars, as small struck crosses
    ctx.strokeStyle = p.inkSoft;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const stars = [[0.1, 0.12], [0.22, 0.28], [0.34, 0.08], [0.56, 0.22], [0.92, 0.36]];
    for (let i = 0; i < stars.length; i++) {
      const x = w * stars[i][0];
      const y = h * stars[i][1];
      const s = w * 0.016;
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s * 1.2);
      ctx.lineTo(x, y + s * 1.2);
    }
    ctx.stroke();
    // a sleek corvette running to the left
    const deck = h * 0.665;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.6);
    ctx.lineTo(w * 0.2, deck - h * 0.03);
    ctx.lineTo(w * 0.74, deck - h * 0.02);
    ctx.lineTo(w * 0.78, h * 0.58);
    ctx.lineTo(w * 0.8, deck + h * 0.02);
    ctx.quadraticCurveTo(w * 0.48, h * 0.88, w * 0.16, deck + h * 0.03);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.4);
    ctx.stroke();
    spar(ctx, p, w * 0.17, h * 0.6, w * 0.03, h * 0.47, 4, p.ink);
    const masts = [[0.34, 0.12], [0.58, 0.07]];
    for (let i = 0; i < masts.length; i++) {
      const mx = w * masts[i][0];
      const topY = h * masts[i][1];
      spar(ctx, p, mx, topY, mx, deck - h * 0.03, 4.5, p.ink);
      spar(ctx, p, mx - w * 0.085, topY + h * 0.08, mx + w * 0.085, topY + h * 0.08, 3.2, p.ink);
      squareSail(ctx, p, mx, topY + h * 0.08, topY + h * 0.3, w * 0.08, w * 0.098, -w * 0.05, p.paperDark);
      squareSail(ctx, p, mx, topY + h * 0.36, deck - h * 0.09, w * 0.1, w * 0.112, -w * 0.05, p.paperDark);
      rig(ctx, p, [
        [mx, topY, mx - w * 0.07, deck - h * 0.03],
        [mx, topY, mx + w * 0.07, deck - h * 0.03],
      ], 1.3, 0.5);
    }
    triSail(ctx, p, [w * 0.34, h * 0.14], [w * 0.035, h * 0.475], [w * 0.22, h * 0.58],
      w * 0.24, h * 0.36, p.paperDark);
    waves(ctx, w, h, p, sy, 2, p.paper, 0.25);
  },

  'Onyx Drydock': (ctx, w, h, p) => {
    // the drained basin, walls stepping down
    ctx.beginPath();
    ctx.moveTo(0, h * 0.34);
    ctx.lineTo(w, h * 0.34);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.46);
    ctx.lineTo(w * 0.94, h * 0.46);
    ctx.lineTo(w * 0.86, h);
    ctx.lineTo(w * 0.14, h);
    ctx.closePath();
    ctx.fillStyle = p.inkSoft;
    ctx.fill();
    ink(ctx, p, 3.2);
    ctx.stroke();
    ink(ctx, p, 2);
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.62);
    ctx.lineTo(w * 0.9, h * 0.62);
    ctx.moveTo(w * 0.12, h * 0.78);
    ctx.lineTo(w * 0.88, h * 0.78);
    ctx.stroke();
    // a hull sitting in its cradle, keel blocked up
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.5);
    ctx.lineTo(w * 0.82, h * 0.5);
    ctx.quadraticCurveTo(w * 0.76, h * 0.88, w * 0.5, h * 0.9);
    ctx.quadraticCurveTo(w * 0.24, h * 0.88, w * 0.18, h * 0.5);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.6);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = p.metalDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 1; i < 5; i++) {
      const y = h * (0.5 + i * 0.08);
      ctx.moveTo(w * (0.19 + i * 0.012), y);
      ctx.lineTo(w * (0.81 - i * 0.012), y);
    }
    ctx.stroke();
    ctx.restore();
    // keel blocks under the turn of the bilge
    for (let i = 0; i < 3; i++) {
      box(ctx, p, w * (0.36 + i * 0.13), h * 0.88, w * 0.08, h * 0.1, p.woodDark, 2.6);
    }
    // scaffolding and a ladder against the hull
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.86);
    ctx.lineTo(w * 0.14, h * 0.32);
    ctx.moveTo(w * 0.9, h * 0.86);
    ctx.lineTo(w * 0.86, h * 0.32);
    ctx.moveTo(w * 0.12, h * 0.56);
    ctx.lineTo(w * 0.22, h * 0.56);
    ctx.moveTo(w * 0.88, h * 0.56);
    ctx.lineTo(w * 0.78, h * 0.56);
    ctx.stroke();
    ctx.strokeStyle = p.wood;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.88);
    ctx.lineTo(w * 0.36, h * 0.44);
    ctx.moveTo(w * 0.36, h * 0.88);
    ctx.lineTo(w * 0.44, h * 0.44);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      ctx.moveTo(w * (0.28 + t * 0.08), h * (0.88 - t * 0.44));
      ctx.lineTo(w * (0.36 + t * 0.08), h * (0.88 - t * 0.44));
    }
    ctx.stroke();
    // the dock gate, shut, at the head of the basin
    box(ctx, p, w * 0.0, h * 0.2, w, h * 0.14, p.woodDark, 3.4);
    ink(ctx, p, 2.2);
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      ctx.moveTo(w * (i / 8), h * 0.2);
      ctx.lineTo(w * (i / 8), h * 0.34);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.27, w * 0.03, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ink(ctx, p, 2.4);
    ctx.stroke();
  },

  'The Tarred Keel': (ctx, w, h, p) => {
    // a beach at low water; the sea sits far back
    seaStrip(ctx, w, p, h * 0.12, h * 0.3, 0.6);
    ink(ctx, p, 2.5);
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.quadraticCurveTo(w * 0.5, h * 0.34, w, h * 0.28);
    ctx.stroke();
    // the hull, hove down, keel towards the eye
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h * 0.86);
    ctx.quadraticCurveTo(w * 0.1, h * 0.36, w * 0.46, h * 0.28);
    ctx.quadraticCurveTo(w * 0.84, h * 0.32, w * 0.96, h * 0.62);
    ctx.quadraticCurveTo(w * 0.7, h * 0.94, w * 0.06, h * 0.86);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    ink(ctx, p, 3.6);
    ctx.stroke();
    // the keel line and planking seams
    ctx.strokeStyle = p.metalDark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.84);
    ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.94, h * 0.62);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = p.inkSoft;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const t = i / 6;
      ctx.moveTo(w * (0.07 + t * 0.06), h * (0.84 - t * 0.44));
      ctx.quadraticCurveTo(w * 0.5, h * (0.88 - t * 0.5), w * (0.95 - t * 0.12), h * (0.62 - t * 0.24));
    }
    ctx.stroke();
    ctx.restore();
    // shoring spars holding her over
    spar(ctx, p, w * 0.3, h * 0.36, w * 0.16, h * 0.96, 5, p.wood);
    spar(ctx, p, w * 0.62, h * 0.32, w * 0.76, h * 0.98, 5, p.wood);
    // tar kettle over a low fire, under the bilge
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.66, w * 0.07, h * 0.055, 0, 0, TAU);
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    ink(ctx, p, 3);
    ctx.stroke();
    flame(ctx, p, w * 0.5, h * 0.78, w * 0.055, h * 0.16, p.accent);
    smoke(ctx, p, w * 0.52, h * 0.58, w * 0.03, 3, w * 0.09);
    // a mop and bucket left on the sand
    spar(ctx, p, w * 0.86, h * 0.9, w * 0.78, h * 0.5, 3.5, p.wood);
    ctx.beginPath();
    ctx.moveTo(w * 0.75, h * 0.48);
    ctx.lineTo(w * 0.81, h * 0.52);
    ctx.lineTo(w * 0.79, h * 0.42);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    ink(ctx, p, 2.4);
    ctx.stroke();
  },
};
