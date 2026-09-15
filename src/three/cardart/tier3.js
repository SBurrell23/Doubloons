// ============================================================
// Tier III card art — "Legends of the Sea".
//
// The loudest drawings in the deck: monsters, drowned kings,
// burning fleets and cursed relics. Every one is a heavy black
// silhouette laid straight onto the bare parchment, cut with
// woodcut hatching. No panel-wide backgrounds — the paper is
// the sky, the fog and the night.
//
// Each function receives (ctx, w, h, p):
//   ctx — already translated to the panel's top-left and clipped
//   w,h — panel size in pixels (~340 x 196); never hard-coded
//   p   — the shared ink palette, plus p.accent for this card
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

/** A five-pointed star, used for night skies. */
function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** A soft radial bloom, for lamps, forges and gem-light. */
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

/** A tongue of flame, tapering from a base width to a flicking tip. */
function flame(ctx, x, y, fw, fh, lean) {
  ctx.beginPath();
  ctx.moveTo(x - fw * 0.5, y);
  ctx.bezierCurveTo(x - fw * 0.6, y - fh * 0.45, x - fw * 0.15, y - fh * 0.6, x + lean, y - fh);
  ctx.bezierCurveTo(x + fw * 0.25, y - fh * 0.55, x + fw * 0.62, y - fh * 0.4, x + fw * 0.5, y);
  ctx.quadraticCurveTo(x, y + fh * 0.1, x - fw * 0.5, y);
  ctx.closePath();
}

/** A crown: band plus `points` spikes, each tipped with a bead. */
function crown(ctx, cx, cy, cw, ch, points) {
  const left = cx - cw / 2;
  const bandTop = cy + ch * 0.42;
  ctx.beginPath();
  ctx.moveTo(left, cy + ch * 0.5);
  ctx.lineTo(left, bandTop - ch * 0.05);
  for (let i = 0; i < points; i++) {
    const x0 = left + (cw * i) / points;
    const x1 = left + (cw * (i + 1)) / points;
    ctx.lineTo((x0 + x1) / 2, cy - ch * 0.5);
    ctx.lineTo(x1, bandTop - ch * 0.05);
  }
  ctx.lineTo(left + cw, cy + ch * 0.5);
  ctx.closePath();
}

/** A plain hull seen broadside, bow to the right. */
function hull(ctx, x, y, hw, hh) {
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.5, y - hh * 0.5);
  ctx.lineTo(x + hw * 0.5, y - hh * 0.5);
  ctx.quadraticCurveTo(x + hw * 0.56, y + hh * 0.2, x + hw * 0.3, y + hh * 0.5);
  ctx.lineTo(x - hw * 0.26, y + hh * 0.5);
  ctx.quadraticCurveTo(x - hw * 0.52, y + hh * 0.2, x - hw * 0.5, y - hh * 0.5);
  ctx.closePath();
}

/** A bare skull, front on. Used by several of the black cards. */
function skull(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - r * 0.15);
  ctx.quadraticCurveTo(cx - r, cy - r * 1.15, cx, cy - r * 1.15);
  ctx.quadraticCurveTo(cx + r, cy - r * 1.15, cx + r, cy - r * 0.15);
  ctx.quadraticCurveTo(cx + r * 0.95, cy + r * 0.45, cx + r * 0.45, cy + r * 0.6);
  ctx.lineTo(cx + r * 0.45, cy + r * 1.05);
  ctx.quadraticCurveTo(cx, cy + r * 1.3, cx - r * 0.45, cy + r * 1.05);
  ctx.lineTo(cx - r * 0.45, cy + r * 0.6);
  ctx.quadraticCurveTo(cx - r * 0.95, cy + r * 0.45, cx - r, cy - r * 0.15);
  ctx.closePath();
}

/** The two eye sockets and nasal notch that go with `skull`. */
function skullFace(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, cy - r * 0.22, r * 0.27, r * 0.31, 0.12, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.42, cy - r * 0.22, r * 0.27, r * 0.31, -0.12, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy + r * 0.05);
  ctx.lineTo(cx - r * 0.16, cy + r * 0.42);
  ctx.lineTo(cx + r * 0.16, cy + r * 0.42);
  ctx.closePath();
  ctx.fill();
}

export const TIER3_ART = {
  // ----------------------------------------------------------
  // PEARL — pale, bleached, ghostly
  // ----------------------------------------------------------

  'The Pale Leviathan': (ctx, w, h, p) => {
    const sea = h * 0.76;
    // The back of the beast, breaching clear across the panel.
    ctx.beginPath();
    ctx.moveTo(-w * 0.05, h * 1.1);
    ctx.bezierCurveTo(w * 0.02, h * 0.52, w * 0.12, h * 0.12, w * 0.33, h * 0.14);
    ctx.bezierCurveTo(w * 0.53, h * 0.16, w * 0.6, h * 0.5, w * 0.66, h * 1.1);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 3.6);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.inkSoft, -w * 0.05, h * 0.1, w * 0.75, h, w * 0.06, 0.5, 0.2, 1.5);
    ctx.restore();

    // Blunt snout and gaping jaw at the leading edge.
    ctx.beginPath();
    ctx.moveTo(w * 0.05, h * 0.42);
    ctx.quadraticCurveTo(w * 0.1, h * 0.62, w * 0.26, h * 0.66);
    ctx.quadraticCurveTo(w * 0.16, h * 0.78, w * 0.03, h * 0.7);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    // Baleen teeth along the jaw.
    pen(ctx, p.ink, 1.8);
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const x = w * (0.06 + t * 0.19);
      const y = h * (0.45 + t * 0.21);
      ctx.moveTo(x, y);
      ctx.lineTo(x + w * 0.012, y + h * 0.07);
    }
    ctx.stroke();

    // Small, pitiless eye.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(w * 0.16, h * 0.33, Math.min(w, h) * 0.028, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();

    // Ribbed flank grooves.
    pen(ctx, p.ink, 2);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.09);
      ctx.moveTo(x, h * (0.2 + i * 0.05));
      ctx.quadraticCurveTo(x + w * 0.02, h * 0.62, x - w * 0.01, h * 0.86);
    }
    ctx.stroke();

    // Tail fluke, far off to the right — the scale of the thing.
    // A narrow stock rising out of the water, opening into two lobes.
    ctx.beginPath();
    ctx.moveTo(w * 0.8, h * 0.92);
    ctx.quadraticCurveTo(w * 0.83, h * 0.66, w * 0.85, h * 0.5);
    // Left lobe, swept back and down to a point.
    ctx.quadraticCurveTo(w * 0.78, h * 0.42, w * 0.7, h * 0.26);
    ctx.quadraticCurveTo(w * 0.82, h * 0.34, w * 0.88, h * 0.4);
    // Right lobe.
    ctx.quadraticCurveTo(w * 0.96, h * 0.26, w * 1.06, h * 0.18);
    ctx.quadraticCurveTo(w * 1.0, h * 0.4, w * 0.92, h * 0.52);
    ctx.quadraticCurveTo(w * 0.9, h * 0.72, w * 0.9, h * 0.92);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    // The notch between the lobes.
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.87, h * 0.44);
    ctx.lineTo(w * 0.85, h * 0.56);
    ctx.stroke();

    seaLines(ctx, p.sea, w, sea + h * 0.06, 3, h * 0.07, h * 0.03, 0.65, 2.2);
    // Spray thrown off the breach.
    pen(ctx, p.sea, 2);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const x = w * (0.28 + i * 0.05);
      ctx.moveTo(x, sea + h * 0.04);
      ctx.lineTo(x + w * 0.02, sea - h * (0.1 + (i % 3) * 0.06));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  'Cathedral of Foam': (ctx, w, h, p) => {
    const base = h * 0.84;
    const cx = w * 0.5;
    const left = w * 0.24;
    const right = w * 0.76;
    const spring = h * 0.42;
    const apex = h * 0.06;

    // Trace the outline of a great pointed arch: up the left pier,
    // over the crown, down the right.
    const steps = 9;
    const edge = [];
    for (let i = 0; i <= steps; i++) {
      edge.push([left, base - (base - spring) * (i / steps)]);
    }
    for (let side = 0; side < 2; side++) {
      const x0 = side ? cx : left;
      const y0 = side ? apex : spring;
      const x2 = side ? right : cx;
      const y2 = side ? spring : apex;
      const x1 = side ? right - w * 0.03 : left + w * 0.03;
      const y1 = apex + h * 0.04;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        edge.push([
          u * u * x0 + 2 * u * t * x1 + t * t * x2,
          u * u * y0 + 2 * u * t * y1 + t * t * y2,
        ]);
      }
    }
    for (let i = 1; i <= steps; i++) {
      edge.push([right, spring + (base - spring) * (i / steps)]);
    }

    // The arch is built of foam: a chain of bursting scallops. Drawn
    // first, then the interior floods over their inner halves, so the
    // silhouette is nothing but breaking water.
    const fr = Math.min(w, h) * 0.075;
    for (let i = 0; i < edge.length; i++) {
      const r = fr * (i % 3 === 1 ? 0.72 : 1);
      ctx.beginPath();
      ctx.arc(edge[i][0], edge[i][1], r, 0, TAU);
      ctx.fillStyle = p.sail;
      ctx.fill();
      pen(ctx, p.ink, 2.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(edge[0][0], edge[0][1]);
    for (const e of edge) ctx.lineTo(e[0], e[1]);
    ctx.lineTo(right, base);
    ctx.lineTo(left, base);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.sea, left, apex, right - left, base - apex, w * 0.05, -0.35, 0.18, 1.5);
    ctx.restore();

    // Rose window: a foam whorl caught mid-turn.
    const rr = Math.min(w, h) * 0.13;
    ctx.beginPath();
    ctx.arc(cx, h * 0.38, rr, 0, TAU);
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.line, 2);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      ctx.moveTo(cx + Math.cos(a) * rr * 0.28, h * 0.38 + Math.sin(a) * rr * 0.28);
      ctx.lineTo(cx + Math.cos(a) * rr, h * 0.38 + Math.sin(a) * rr);
    }
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, h * 0.38, rr * 0.26, 0, TAU);
    ctx.fill();

    // Twin lancets beneath, like a nave seen end-on.
    pen(ctx, p.ink, 2.6);
    for (const lx of [cx - w * 0.1, cx + w * 0.1]) {
      ctx.beginPath();
      ctx.moveTo(lx - w * 0.045, base);
      ctx.lineTo(lx - w * 0.045, h * 0.66);
      ctx.quadraticCurveTo(lx, h * 0.5, lx + w * 0.045, h * 0.66);
      ctx.lineTo(lx + w * 0.045, base);
      ctx.stroke();
    }

    // Spires of spray flung above the crown of the arch.
    pen(ctx, p.sea, 2.2);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const [sx, sh] of [[cx - w * 0.14, 0.1], [cx, 0.16], [cx + w * 0.14, 0.1]]) {
      ctx.moveTo(sx, apex + h * 0.16);
      ctx.lineTo(sx, apex - h * sh);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    seaLines(ctx, p.sea, w, base, 2, h * 0.08, h * 0.028, 0.7, 2.4);
  },

  'Admiral Whitetide': (ctx, w, h, p) => {
    const cx = w * 0.5;
    // Shoulders and coat — one heavy dark mass.
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 1.02);
    ctx.quadraticCurveTo(w * 0.2, h * 0.68, cx - w * 0.08, h * 0.62);
    ctx.lineTo(cx + w * 0.09, h * 0.62);
    ctx.quadraticCurveTo(w * 0.8, h * 0.68, w * 0.86, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();

    // Lapels and sash, cut back out of the coat in pale cloth.
    ctx.fillStyle = p.sail;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, h * 0.64);
    ctx.lineTo(cx - w * 0.16, h * 1.02);
    ctx.lineTo(cx - w * 0.06, h * 1.02);
    ctx.lineTo(cx + w * 0.01, h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.08, h * 0.64);
    ctx.lineTo(cx + w * 0.17, h * 1.02);
    ctx.lineTo(cx + w * 0.07, h * 1.02);
    ctx.lineTo(cx + w * 0.015, h * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, h * 0.74);
    ctx.lineTo(cx + w * 0.16, h * 0.98);
    ctx.lineTo(cx + w * 0.19, h * 1.02);
    ctx.lineTo(cx - w * 0.19, h * 0.84);
    ctx.closePath();
    ctx.fill();

    // Epaulettes.
    ctx.fillStyle = p.gold;
    for (const ex of [cx - w * 0.19, cx + w * 0.2]) {
      ctx.beginPath();
      ctx.ellipse(ex, h * 0.72, w * 0.05, h * 0.045, 0, 0, TAU);
      ctx.fill();
      pen(ctx, p.ink, 2.2);
      ctx.stroke();
      pen(ctx, p.gold, 2);
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(ex - w * 0.03 + i * w * 0.02, h * 0.755);
        ctx.lineTo(ex - w * 0.035 + i * w * 0.02, h * 0.83);
      }
      ctx.stroke();
    }

    // Head and high collar.
    ctx.fillStyle = p.paperDark;
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.44, w * 0.075, h * 0.15, 0, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.055, h * 0.46);
    ctx.lineTo(cx - w * 0.03, h * 0.47);
    ctx.moveTo(cx + w * 0.03, h * 0.47);
    ctx.lineTo(cx + w * 0.055, h * 0.46);
    ctx.stroke();

    // The bicorne, worn athwart — the whole read of the card.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.28, h * 0.34);
    ctx.quadraticCurveTo(cx - w * 0.1, h * 0.04, cx, h * 0.06);
    ctx.quadraticCurveTo(cx + w * 0.1, h * 0.04, cx + w * 0.28, h * 0.34);
    ctx.quadraticCurveTo(cx, h * 0.42, cx - w * 0.28, h * 0.34);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    // Cockade and plume.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx + w * 0.11, h * 0.2, Math.min(w, h) * 0.03, 0, TAU);
    ctx.fill();
    pen(ctx, p.sail, 2.4);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.02, h * 0.08);
    ctx.quadraticCurveTo(cx - w * 0.14, h * 0.0, cx - w * 0.22, h * 0.08);
    ctx.stroke();

    // A low white breaker at his back.
    seaLines(ctx, p.sea, w, h * 0.92, 2, h * 0.07, h * 0.025, 0.4, 2);
  },

  'The Ghost Armada': (ctx, w, h, p) => {
    const sea = h * 0.8;
    // Four hulls in file, each fainter and smaller than the last.
    const fleet = [
      [w * 0.26, 1.25, 1.0],
      [w * 0.62, 0.8, 0.62],
      [w * 0.86, 0.5, 0.36],
    ];
    for (const [x, s, a] of fleet) {
      ctx.save();
      ctx.globalAlpha = a;
      const hw = w * 0.3 * s;
      const hh = h * 0.14 * s;
      const deck = sea - hh * 0.5;
      hull(ctx, x, sea - hh * 0.3, hw, hh);
      ctx.fillStyle = p.ink;
      ctx.fill();
      pen(ctx, p.line, 3 * s);
      ctx.stroke();

      // Masts and rotten canvas.
      pen(ctx, p.ink, 3 * s);
      ctx.beginPath();
      for (const m of [-0.22, 0.04, 0.26]) {
        ctx.moveTo(x + hw * m, deck);
        ctx.lineTo(x + hw * m, deck - h * 0.5 * s);
      }
      ctx.moveTo(x - hw * 0.34, deck - h * 0.5 * s);
      ctx.lineTo(x + hw * 0.4, deck - h * 0.48 * s);
      ctx.stroke();

      for (const m of [-0.22, 0.04, 0.26]) {
        const mx = x + hw * m;
        const top = deck - h * 0.42 * s;
        const sw = hw * 0.3;
        ctx.beginPath();
        ctx.moveTo(mx - sw * 0.3, top);
        ctx.quadraticCurveTo(mx + sw * 0.9, top + h * 0.06 * s, mx + sw * 0.72, deck - h * 0.06 * s);
        // Ragged lower edge — the canvas is holed through.
        ctx.lineTo(mx + sw * 0.5, deck - h * 0.17 * s);
        ctx.lineTo(mx + sw * 0.34, deck - h * 0.04 * s);
        ctx.lineTo(mx + sw * 0.1, deck - h * 0.16 * s);
        ctx.lineTo(mx - sw * 0.24, deck - h * 0.03 * s);
        ctx.closePath();
        ctx.fillStyle = p.sail;
        ctx.globalAlpha = a * 0.8;
        ctx.fill();
        ctx.globalAlpha = a;
        pen(ctx, p.line, 2.6 * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Fog, rolling in off the right and taking the rear of the line.
    ctx.save();
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = p.paperDark;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(
        w * (0.5 + i * 0.075),
        h * (0.42 + (i % 3) * 0.14),
        w * 0.13,
        h * 0.1,
        0, 0, TAU,
      );
      ctx.fill();
    }
    ctx.restore();

    // A single cold light on the flagship's stern.
    glow(ctx, w * 0.36, sea - h * 0.12, h * 0.13, p.accent, 0.55);
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(w * 0.36, sea - h * 0.12, Math.min(w, h) * 0.022, 0, TAU);
    ctx.fill();

    seaLines(ctx, p.sea, w, sea + h * 0.03, 3, h * 0.06, h * 0.022, 0.5, 2.2);
  },

  // ----------------------------------------------------------
  // SAPPHIRE — deep water, storm and drowned majesty
  // ----------------------------------------------------------

  'The Krakens Eye': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const cy = h * 0.5;
    const ew = w * 0.3;
    const eh = h * 0.3;

    // Tentacles crowding in from every corner.
    pen(ctx, p.ink, 4);
    const arms = [
      [-0.05, -0.1, 0.2, 0.34, 0.34, 0.2],
      [1.05, -0.1, 0.8, 0.32, 0.68, 0.18],
      [-0.05, 1.1, 0.2, 0.68, 0.34, 0.82],
      [1.05, 1.1, 0.8, 0.7, 0.68, 0.84],
    ];
    for (const a of arms) {
      ctx.beginPath();
      ctx.moveTo(w * a[0], h * a[1]);
      ctx.bezierCurveTo(w * a[2], h * a[3], w * a[4], h * a[5], w * (a[4] * 0.6 + 0.2), h * (a[5] * 0.5 + 0.25));
      ctx.stroke();
    }
    // Suckers along the arms.
    ctx.fillStyle = p.seaDeep;
    for (const a of arms) {
      for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const x = w * (a[0] + (a[4] - a[0]) * t);
        const y = h * (a[1] + (a[5] - a[1]) * t);
        ctx.beginPath();
        ctx.arc(x, y, Math.min(w, h) * 0.018, 0, TAU);
        ctx.fill();
      }
    }

    // The eye itself: a hard almond, lid over lid.
    ctx.beginPath();
    ctx.moveTo(cx - ew, cy);
    ctx.quadraticCurveTo(cx, cy - eh * 1.5, cx + ew, cy);
    ctx.quadraticCurveTo(cx, cy + eh * 1.5, cx - ew, cy);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.sea, cx - ew, cy - eh * 1.5, ew * 2, eh * 3, w * 0.03, 0.4, 0.22, 1.6);
    ctx.restore();

    // Iris and the goat-slit pupil.
    ctx.beginPath();
    ctx.arc(cx, cy, eh * 0.82, 0, TAU);
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.seaDeep, 2);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.moveTo(cx + Math.cos(a) * eh * 0.36, cy + Math.sin(a) * eh * 0.36);
      ctx.lineTo(cx + Math.cos(a) * eh * 0.78, cy + Math.sin(a) * eh * 0.78);
    }
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.ellipse(cx, cy, eh * 0.16, eh * 0.74, 0, 0, TAU);
    ctx.fill();
    // Catchlight.
    ctx.fillStyle = p.sail;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(cx - eh * 0.34, cy - eh * 0.36, eh * 0.14, eh * 0.09, -0.5, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Heavy brow above, folds of hide below.
    pen(ctx, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx - ew * 1.1, cy - eh * 0.6);
    ctx.quadraticCurveTo(cx, cy - eh * 1.9, cx + ew * 1.1, cy - eh * 0.6);
    ctx.moveTo(cx - ew * 0.9, cy + eh * 0.95);
    ctx.quadraticCurveTo(cx, cy + eh * 1.7, cx + ew * 0.9, cy + eh * 0.95);
    ctx.stroke();
  },

  'Throne of the Deep': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const floor = h * 0.9;

    // Stepped plinth.
    ctx.fillStyle = p.seaDeep;
    for (let i = 0; i < 2; i++) {
      const sw = w * (0.44 + i * 0.1);
      const y = floor - h * 0.06 * (2 - i);
      ctx.beginPath();
      ctx.rect(cx - sw / 2, y, sw, h * 0.06);
      ctx.fill();
      pen(ctx, p.ink, 2.6);
      ctx.stroke();
    }

    // Whale ribs fanning out behind the seat, drawn as outlined bone
    // so they read against the parchment rather than against the throne.
    for (const pass of [0, 1]) {
      pen(ctx, pass ? p.sail : p.ink, pass ? 5 : 9);
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const dir = Math.sign(i);
        const n = Math.abs(i);
        ctx.beginPath();
        ctx.moveTo(cx + dir * w * 0.05, floor - h * 0.24);
        ctx.quadraticCurveTo(
          cx + dir * w * (0.12 + n * 0.09),
          h * 0.42,
          cx + dir * w * (0.1 + n * 0.11),
          h * (0.3 - n * 0.09),
        );
        ctx.stroke();
      }
    }

    // Throne back: a narrow slab with a spiked crest.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.13, floor - h * 0.12);
    ctx.lineTo(cx - w * 0.14, h * 0.26);
    for (let i = 0; i < 4; i++) {
      const x0 = cx - w * 0.14 + (w * 0.28 * i) / 4;
      const x1 = cx - w * 0.14 + (w * 0.28 * (i + 1)) / 4;
      ctx.lineTo((x0 + x1) / 2, h * 0.08);
      ctx.lineTo(x1, h * 0.26);
    }
    ctx.lineTo(cx + w * 0.13, floor - h * 0.12);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3.4);
    ctx.stroke();

    // Seat, thrown forward of the back, with arms projecting either side.
    ctx.fillStyle = p.metalDark;
    ctx.beginPath();
    ctx.rect(cx - w * 0.22, floor - h * 0.3, w * 0.44, h * 0.09);
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    for (const dir of [-1, 1]) {
      // Armrest, cantilevered out over the steps.
      ctx.beginPath();
      ctx.moveTo(cx + dir * w * 0.12, floor - h * 0.44);
      ctx.lineTo(cx + dir * w * 0.26, floor - h * 0.42);
      ctx.lineTo(cx + dir * w * 0.26, floor - h * 0.34);
      ctx.lineTo(cx + dir * w * 0.12, floor - h * 0.36);
      ctx.closePath();
      ctx.fillStyle = p.metalDark;
      ctx.fill();
      pen(ctx, p.ink, 3);
      ctx.stroke();
      // Its post.
      ctx.beginPath();
      ctx.rect(cx + dir * w * 0.22, floor - h * 0.36, w * 0.04, h * 0.08);
      ctx.fill();
      ctx.stroke();
    }

    // The gem set in the headrest — the one bright note.
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.3);
    ctx.lineTo(cx + w * 0.05, h * 0.39);
    ctx.lineTo(cx, h * 0.5);
    ctx.lineTo(cx - w * 0.05, h * 0.39);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 2.6);
    ctx.stroke();
    glow(ctx, cx, h * 0.4, h * 0.22, p.accent, 0.4);

    // Kelp fronds leaning in on the current.
    pen(ctx, p.leaf, 3);
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (const kx of [w * 0.1, w * 0.17, w * 0.86, w * 0.93]) {
      ctx.moveTo(kx, floor + h * 0.06);
      ctx.bezierCurveTo(kx + w * 0.06, h * 0.6, kx - w * 0.05, h * 0.38, kx + w * 0.03, h * 0.14);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    bubbles(ctx, p.sea, [
      [w * 0.24, h * 0.22, h * 0.03],
      [w * 0.29, h * 0.36, h * 0.019],
      [w * 0.74, h * 0.3, h * 0.025],
      [w * 0.79, h * 0.46, h * 0.015],
    ], 0.7, 2);

    seaLines(ctx, p.sea, w, floor + h * 0.05, 1, h * 0.06, h * 0.02, 0.4, 2);
  },

  'Tempest Sovereign': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const cy = h * 0.42;

    // Three heavy spiral arms, drawn as solid banks of cloud that
    // taper as they wind in towards the eye.
    for (let arm = 0; arm < 3; arm++) {
      const base = (arm / 3) * TAU;
      ctx.beginPath();
      for (let side = 0; side < 2; side++) {
        const steps = 30;
        for (let s = 0; s <= steps; s++) {
          const t = side ? steps - s : s;
          const a = base + t * 0.19;
          const r = Math.min(w, h) * 0.13 * Math.exp(t * 0.045);
          const thick = (h * 0.075) * (0.3 + t / steps);
          const off = side ? -thick : thick;
          const x = cx + Math.cos(a) * (r * 1.45 + off * 0.5);
          const y = cy + Math.sin(a) * (r * 0.8 + off * 0.5) + off * 0.5;
          if (side === 0 && s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fillStyle = p.sea;
      ctx.fill();
      pen(ctx, p.seaDeep, 3);
      ctx.stroke();
    }

    // The eye of the storm, scoured clear, and the crown that rules it.
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.13, h * 0.17, 0, 0, TAU);
    ctx.fillStyle = p.paper;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    crown(ctx, cx, cy, w * 0.19, h * 0.24, 3);
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, cy + h * 0.08, Math.min(w, h) * 0.028, 0, TAU);
    ctx.fill();
    pen(ctx, p.line, 2);
    ctx.stroke();

    // Lightning thrown down out of the arms.
    pen(ctx, p.accent, 3.4);
    const bolts = [[0.2, 0.3], [0.82, 0.26], [0.68, 0.7]];
    for (const [bx, by] of bolts) {
      ctx.beginPath();
      ctx.moveTo(w * bx, h * by);
      ctx.lineTo(w * (bx + 0.04), h * (by + 0.1));
      ctx.lineTo(w * (bx - 0.01), h * (by + 0.11));
      ctx.lineTo(w * (bx + 0.05), h * (by + 0.26));
      ctx.stroke();
    }

    // Rain, raked hard across the lower panel.
    hatch(ctx, p.sea, 0, h * 0.62, w, h * 0.3, w * 0.035, -0.35, 0.35, 1.8);

    // A crest breaking at the foot.
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, h * 1.02);
    ctx.quadraticCurveTo(w * 0.22, h * 0.86, w * 0.42, h * 0.94);
    ctx.quadraticCurveTo(w * 0.7, h * 1.02, w * 1.02, h * 0.88);
    ctx.lineTo(w * 1.02, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.seaDeep;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
  },

  'The Drowning Crown': (ctx, w, h, p) => {
    const line = h * 0.26;

    // Shafts of light coming down through the surface.
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = p.sky;
    for (let i = 0; i < 4; i++) {
      const x = w * (0.16 + i * 0.22);
      ctx.beginPath();
      ctx.moveTo(x, line);
      ctx.lineTo(x + w * 0.05, line);
      ctx.lineTo(x + w * 0.16, h);
      ctx.lineTo(x - w * 0.06, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // The surface, seen from below.
    pen(ctx, p.sea, 3.4);
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, line);
    for (let x = -w * 0.02; x < w * 1.04; x += w * 0.17) {
      ctx.quadraticCurveTo(x + w * 0.042, line - h * 0.045, x + w * 0.085, line);
      ctx.quadraticCurveTo(x + w * 0.127, line + h * 0.045, x + w * 0.17, line);
    }
    ctx.stroke();
    hatch(ctx, p.sea, 0, line + h * 0.05, w, h * 0.9, w * 0.06, 0.2, 0.14, 1.6);

    // The crown, turning over as it goes down.
    const cx = w * 0.5;
    const cy = h * 0.62;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(0.32);
    crown(ctx, 0, 0, w * 0.34, h * 0.36, 5);
    ctx.fillStyle = p.gold;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    // Band and its rivets.
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.moveTo(-w * 0.17, h * 0.075);
    ctx.lineTo(w * 0.17, h * 0.075);
    ctx.stroke();
    ctx.fillStyle = p.woodDark;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * w * 0.06, h * 0.12, Math.min(w, h) * 0.016, 0, TAU);
      ctx.fill();
    }
    // One surviving stone.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.02);
    ctx.lineTo(w * 0.035, h * 0.04);
    ctx.lineTo(0, h * 0.1);
    ctx.lineTo(-w * 0.035, h * 0.04);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();
    ctx.restore();

    // The bubbles it left on the way down.
    bubbles(ctx, p.sea, [
      [w * 0.36, h * 0.44, h * 0.028],
      [w * 0.42, h * 0.34, h * 0.018],
      [w * 0.62, h * 0.4, h * 0.022],
      [w * 0.68, h * 0.31, h * 0.014],
      [w * 0.5, h * 0.36, h * 0.012],
    ], 0.8, 2.2);

    // Silt floor.
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, h * 1.02);
    ctx.quadraticCurveTo(w * 0.3, h * 0.9, w * 0.56, h * 0.95);
    ctx.quadraticCurveTo(w * 0.82, h * 1.0, w * 1.02, h * 0.92);
    ctx.lineTo(w * 1.02, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.seaDeep;
    ctx.fill();
  },

  // ----------------------------------------------------------
  // EMERALD — jungle green, serpents and old bargains
  // ----------------------------------------------------------

  'The Sea Serpent': (ctx, w, h, p) => {
    const sea = h * 0.62;

    // Three coils breaking the surface, left to right.
    const coils = [
      [w * 0.12, w * 0.3],
      [w * 0.42, w * 0.3],
      [w * 0.7, w * 0.26],
    ];
    for (const [x0, span] of coils) {
      const rise = h * 0.3 + span * 0.05;
      ctx.beginPath();
      ctx.moveTo(x0, sea + h * 0.05);
      ctx.bezierCurveTo(x0 + span * 0.1, sea - rise, x0 + span * 0.9, sea - rise, x0 + span, sea + h * 0.05);
      ctx.lineTo(x0 + span * 0.76, sea + h * 0.05);
      ctx.bezierCurveTo(x0 + span * 0.72, sea - rise * 0.55, x0 + span * 0.28, sea - rise * 0.55, x0 + span * 0.24, sea + h * 0.05);
      ctx.closePath();
      ctx.fillStyle = p.leaf;
      ctx.fill();
      pen(ctx, p.ink, 3.4);
      ctx.stroke();
      ctx.save();
      ctx.clip();
      hatch(ctx, p.ink, x0, sea - rise, span, rise + h * 0.1, w * 0.03, 0.5, 0.26, 1.6);
      ctx.restore();
      // Dorsal spines, standing up off the crown of each coil.
      pen(ctx, p.ink, 2.6);
      ctx.fillStyle = p.leaf;
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const sx = x0 + span * t;
        // Follow the cubic's crown so the spines sit on the back.
        const u = 1 - t;
        const sy = 3 * u * u * t * (sea - rise) + 3 * u * t * t * (sea - rise)
          + t * t * t * (sea + h * 0.05) + u * u * u * (sea + h * 0.05);
        ctx.beginPath();
        ctx.moveTo(sx - span * 0.06, sy + h * 0.01);
        ctx.lineTo(sx, sy - h * 0.1);
        ctx.lineTo(sx + span * 0.06, sy + h * 0.01);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    // The head, reared clear over the last coil.
    const hx = w * 0.84;
    const hy = h * 0.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.74, h * 0.46);
    ctx.quadraticCurveTo(w * 0.74, hy - h * 0.06, hx, hy - h * 0.1);
    ctx.quadraticCurveTo(w * 1.0, hy - h * 0.1, w * 1.02, hy + h * 0.02);
    ctx.lineTo(w * 0.88, hy + h * 0.06);
    ctx.quadraticCurveTo(w * 1.0, hy + h * 0.16, w * 0.94, hy + h * 0.24);
    ctx.quadraticCurveTo(w * 0.82, hy + h * 0.2, w * 0.8, h * 0.5);
    ctx.closePath();
    ctx.fillStyle = p.leaf;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();

    // Slit eye, and a frill behind the jaw.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.ellipse(w * 0.86, hy - h * 0.02, w * 0.02, h * 0.028, 0.3, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 2);
    ctx.stroke();
    pen(ctx, p.ink, 2.6);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = -0.9 + i * 0.4;
      ctx.moveTo(w * 0.78, hy + h * 0.06);
      ctx.lineTo(w * 0.78 - Math.cos(a) * w * 0.1, hy + h * 0.06 - Math.sin(a) * h * 0.18);
    }
    ctx.stroke();

    seaLines(ctx, p.sea, w, sea + h * 0.06, 4, h * 0.08, h * 0.03, 0.6, 2.4);
    // Wake thrown where each coil cuts the water.
    pen(ctx, p.sea, 2.2);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (const [x0, span] of coils) {
      ctx.moveTo(x0 - w * 0.03, sea + h * 0.06);
      ctx.quadraticCurveTo(x0 + span * 0.5, sea + h * 0.12, x0 + span + w * 0.03, sea + h * 0.06);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  'Heart of the Isle': (ctx, w, h, p) => {
    const sea = h * 0.86;
    // The island, drawn as a cutaway peak.
    ctx.beginPath();
    ctx.moveTo(w * 0.06, sea);
    ctx.lineTo(w * 0.32, h * 0.22);
    ctx.lineTo(w * 0.44, h * 0.34);
    ctx.lineTo(w * 0.56, h * 0.14);
    ctx.lineTo(w * 0.72, h * 0.38);
    ctx.lineTo(w * 0.94, sea);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.1, w, h, w * 0.04, -0.4, 0.26, 1.8);
    // Strata inside the rock.
    pen(ctx, p.wood, 2.2);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = h * (0.5 + i * 0.1);
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(w * 0.5, y - h * 0.04, w, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // The heart: a cut gem buried in the root of the mountain.
    const gx = w * 0.5;
    const gy = h * 0.58;
    const gr = Math.min(w, h) * 0.13;
    glow(ctx, gx, gy, gr * 3.2, p.accent, 0.55);
    ctx.beginPath();
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx + gr * 0.8, gy - gr * 0.25);
    ctx.lineTo(gx + gr * 0.5, gy + gr);
    ctx.lineTo(gx - gr * 0.5, gy + gr);
    ctx.lineTo(gx - gr * 0.8, gy - gr * 0.25);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.ink, 2);
    ctx.beginPath();
    ctx.moveTo(gx - gr * 0.8, gy - gr * 0.25);
    ctx.lineTo(gx + gr * 0.8, gy - gr * 0.25);
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx - gr * 0.5, gy + gr);
    ctx.moveTo(gx, gy - gr);
    ctx.lineTo(gx + gr * 0.5, gy + gr);
    ctx.stroke();

    // Veins of light running out of the gem into the rock.
    pen(ctx, p.accent, 2.4);
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3;
      ctx.moveTo(gx + Math.cos(a) * gr, gy + Math.sin(a) * gr);
      ctx.lineTo(gx + Math.cos(a) * gr * 2.1, gy + Math.sin(a) * gr * 1.9);
      ctx.lineTo(gx + Math.cos(a + 0.3) * gr * 2.9, gy + Math.sin(a + 0.3) * gr * 2.5);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Palms on the ridge.
    pen(ctx, p.ink, 2.6);
    for (const [px, py] of [[w * 0.26, h * 0.3], [w * 0.78, h * 0.46]]) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + w * 0.01, py - h * 0.1, px + w * 0.03, py - h * 0.17);
      ctx.stroke();
      pen(ctx, p.leaf, 3);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI + 0.35 + (i / 4) * (Math.PI - 0.7);
        ctx.moveTo(px + w * 0.03, py - h * 0.17);
        ctx.quadraticCurveTo(
          px + w * 0.03 + Math.cos(a) * w * 0.03,
          py - h * 0.17 + Math.sin(a) * h * 0.06,
          px + w * 0.03 + Math.cos(a) * w * 0.06,
          py - h * 0.15 + Math.sin(a) * h * 0.04,
        );
      }
      ctx.stroke();
      pen(ctx, p.ink, 2.6);
    }

    seaLines(ctx, p.sea, w, sea, 2, h * 0.07, h * 0.026, 0.7, 2.4);
  },

  'Viridian Warlord': (ctx, w, h, p) => {
    const cx = w * 0.46;
    // Cloak, thrown wide behind him.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.04, h * 0.3);
    ctx.quadraticCurveTo(w * 0.02, h * 0.6, w * 0.06, h * 1.04);
    ctx.lineTo(w * 0.74, h * 1.04);
    ctx.quadraticCurveTo(w * 0.6, h * 0.62, cx + w * 0.12, h * 0.3);
    ctx.closePath();
    ctx.fillStyle = p.leaf;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.28, w, h, w * 0.045, 0.15, 0.26, 1.8);
    ctx.restore();

    // Torso in scale armour.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.11, h * 0.46);
    ctx.lineTo(cx + w * 0.11, h * 0.46);
    ctx.lineTo(cx + w * 0.09, h * 1.04);
    ctx.lineTo(cx - w * 0.09, h * 1.04);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.metal, 1.8);
    ctx.beginPath();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        const sx = cx - w * 0.08 + c * w * 0.053;
        const sy = h * 0.54 + r * h * 0.1;
        ctx.moveTo(sx - w * 0.02, sy);
        ctx.quadraticCurveTo(sx, sy + h * 0.05, sx + w * 0.02, sy);
      }
    }
    ctx.stroke();

    // Helm: a horned mask crowned with fronds.
    const hy = h * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, hy - h * 0.1);
    ctx.lineTo(cx + w * 0.07, hy - h * 0.1);
    ctx.lineTo(cx + w * 0.065, hy + h * 0.13);
    ctx.quadraticCurveTo(cx, hy + h * 0.2, cx - w * 0.065, hy + h * 0.13);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.rect(cx - w * 0.05, hy - h * 0.01, w * 0.1, h * 0.028);
    ctx.fill();
    // Horns.
    pen(ctx, p.ink, 3.4);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.07, hy - h * 0.06);
    ctx.quadraticCurveTo(cx - w * 0.17, hy - h * 0.14, cx - w * 0.14, hy - h * 0.28);
    ctx.moveTo(cx + w * 0.07, hy - h * 0.06);
    ctx.quadraticCurveTo(cx + w * 0.17, hy - h * 0.14, cx + w * 0.14, hy - h * 0.28);
    ctx.stroke();
    // Leaf plume.
    pen(ctx, p.leaf, 3);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.28;
      ctx.moveTo(cx, hy - h * 0.1);
      ctx.lineTo(cx + Math.cos(a) * w * 0.07, hy - h * 0.1 + Math.sin(a) * h * 0.16);
    }
    ctx.stroke();

    // Cutlass raised in the right hand.
    pen(ctx, p.ink, 3.4);
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.1, h * 0.58);
    ctx.lineTo(w * 0.78, h * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.78, h * 0.42);
    ctx.quadraticCurveTo(w * 0.92, h * 0.24, w * 0.98, h * 0.04);
    ctx.quadraticCurveTo(w * 0.9, h * 0.26, w * 0.76, h * 0.36);
    ctx.closePath();
    ctx.fillStyle = p.metal;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();

    // Round shield on the off arm.
    ctx.beginPath();
    ctx.arc(w * 0.18, h * 0.66, Math.min(w, h) * 0.16, 0, TAU);
    ctx.fillStyle = p.wood;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    pen(ctx, p.ink, 2.2);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.moveTo(w * 0.18, h * 0.66);
      ctx.lineTo(w * 0.18 + Math.cos(a) * Math.min(w, h) * 0.16, h * 0.66 + Math.sin(a) * Math.min(w, h) * 0.16);
    }
    ctx.stroke();
    ctx.fillStyle = p.leaf;
    ctx.beginPath();
    ctx.arc(w * 0.18, h * 0.66, Math.min(w, h) * 0.045, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();
  },

  'The Emerald Compact': (ctx, w, h, p) => {
    const cy = h * 0.52;
    const cx = w * 0.5;

    // The charter itself, unrolled between its dowels.
    ctx.beginPath();
    ctx.moveTo(w * 0.14, h * 0.2);
    ctx.lineTo(w * 0.86, h * 0.2);
    ctx.quadraticCurveTo(w * 0.9, h * 0.54, w * 0.86, h * 0.88);
    ctx.lineTo(w * 0.14, h * 0.88);
    ctx.quadraticCurveTo(w * 0.1, h * 0.54, w * 0.14, h * 0.2);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();

    // The terms, and the two marks set against them. No letters —
    // just the rhythm of a hand that has written far too much.
    pen(ctx, p.inkSoft, 2);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const y = h * (0.3 + i * 0.085);
      ctx.moveTo(w * 0.2, y);
      ctx.lineTo(w * (0.8 - (i % 2) * 0.12), y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    pen(ctx, p.ink, 2.4);
    for (const sx0 of [w * 0.2, w * 0.58]) {
      ctx.beginPath();
      ctx.moveTo(sx0, h * 0.72);
      for (let i = 0; i < 4; i++) {
        const x = sx0 + (i * w * 0.055);
        ctx.quadraticCurveTo(x + w * 0.014, h * 0.63, x + w * 0.028, h * 0.72);
        ctx.quadraticCurveTo(x + w * 0.042, h * 0.79, x + w * 0.055, h * 0.72);
      }
      ctx.stroke();
    }

    // Rolled dowels at each edge.
    ctx.fillStyle = p.wood;
    for (const rx of [w * 0.12, w * 0.88]) {
      ctx.beginPath();
      ctx.ellipse(rx, cy, w * 0.026, h * 0.38, 0, 0, TAU);
      ctx.fill();
      pen(ctx, p.ink, 3);
      ctx.stroke();
    }

    // A dagger driven through the middle of it: the compact is not
    // the sort you walk away from.
    const dx = cx + w * 0.02;
    // Torn slit where the blade went in.
    ctx.beginPath();
    ctx.moveTo(dx - w * 0.04, h * 0.42);
    ctx.lineTo(dx + w * 0.04, h * 0.44);
    ctx.lineTo(dx + w * 0.02, h * 0.48);
    ctx.lineTo(dx - w * 0.05, h * 0.46);
    ctx.closePath();
    ctx.fillStyle = p.paperDark;
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();

    // Blade, tapering to a point below the foot of the charter.
    ctx.beginPath();
    ctx.moveTo(dx - w * 0.028, h * 0.36);
    ctx.lineTo(dx + w * 0.028, h * 0.36);
    ctx.lineTo(dx + w * 0.019, h * 0.86);
    ctx.lineTo(dx, h * 1.02);
    ctx.lineTo(dx - w * 0.019, h * 0.86);
    ctx.closePath();
    ctx.fillStyle = p.metal;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    // Fuller down the centre of the blade.
    pen(ctx, p.metalDark, 2.2);
    ctx.beginPath();
    ctx.moveTo(dx, h * 0.38);
    ctx.lineTo(dx, h * 0.92);
    ctx.stroke();

    // Crossguard.
    ctx.beginPath();
    ctx.moveTo(dx - w * 0.11, h * 0.31);
    ctx.quadraticCurveTo(dx, h * 0.26, dx + w * 0.11, h * 0.31);
    ctx.lineTo(dx + w * 0.09, h * 0.37);
    ctx.quadraticCurveTo(dx, h * 0.33, dx - w * 0.09, h * 0.37);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();

    // Grip and pommel, standing above the top edge of the charter.
    ctx.beginPath();
    ctx.rect(dx - w * 0.022, h * 0.1, w * 0.044, h * 0.21);
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.wood, 2);
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      ctx.moveTo(dx - w * 0.022, h * (0.14 + i * 0.042));
      ctx.lineTo(dx + w * 0.022, h * (0.12 + i * 0.042));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dx, h * 0.08, Math.min(w, h) * 0.045, 0, TAU);
    ctx.fillStyle = p.gold;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();

    // Wax seal, set with the stone that binds the bargain.
    const sx = w * 0.27;
    const sy = h * 0.84;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const r = Math.min(w, h) * (i % 2 ? 0.085 : 0.115);
      const x = sx + Math.cos(a) * r;
      const y = sy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.arc(sx, sy, Math.min(w, h) * 0.038, 0, TAU);
    ctx.fill();

    // Ribbons hanging from the seal, off the foot of the card.
    pen(ctx, p.leaf, 3.4);
    ctx.beginPath();
    ctx.moveTo(sx - w * 0.025, sy + h * 0.06);
    ctx.quadraticCurveTo(sx - w * 0.07, h * 0.98, sx - w * 0.05, h * 1.06);
    ctx.moveTo(sx + w * 0.025, sy + h * 0.06);
    ctx.quadraticCurveTo(sx + w * 0.07, h * 0.98, sx + w * 0.05, h * 1.06);
    ctx.stroke();
  },

  // ----------------------------------------------------------
  // RUBY — fire, forge and slaughter
  // ----------------------------------------------------------

  'The Burning Fleet': (ctx, w, h, p) => {
    const sea = h * 0.8;
    const ships = [
      [w * 0.2, 0.9],
      [w * 0.52, 1.15],
      [w * 0.82, 0.8],
    ];

    // Smoke first, so the hulls sit in front of it.
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = p.ink;
    for (const [x, s] of ships) {
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        ctx.beginPath();
        ctx.ellipse(
          x + (i % 2 ? 1 : -1) * w * 0.04 * t,
          sea - h * (0.36 + t * 0.42) * s,
          w * (0.06 + t * 0.06) * s,
          h * (0.06 + t * 0.05) * s,
          0, 0, TAU,
        );
        ctx.fill();
      }
    }
    ctx.restore();

    for (const [x, s] of ships) {
      const hw = w * 0.26 * s;
      const hh = h * 0.13 * s;
      const deck = sea - hh * 0.8;
      hull(ctx, x, sea - hh * 0.3, hw, hh);
      ctx.fillStyle = p.ink;
      ctx.fill();
      pen(ctx, p.line, 3);
      ctx.stroke();

      // Masts, half burnt through and leaning.
      pen(ctx, p.ink, 3.2);
      ctx.beginPath();
      ctx.moveTo(x - hw * 0.2, deck);
      ctx.lineTo(x - hw * 0.3, deck - h * 0.34 * s);
      ctx.moveTo(x + hw * 0.16, deck);
      ctx.lineTo(x + hw * 0.24, deck - h * 0.4 * s);
      ctx.moveTo(x - hw * 0.44, deck - h * 0.24 * s);
      ctx.lineTo(x + hw * 0.42, deck - h * 0.3 * s);
      ctx.stroke();

      // Fire taking the deck.
      for (let i = 0; i < 5; i++) {
        const fx = x - hw * 0.4 + (i / 4) * hw * 0.8;
        flame(ctx, fx, deck + h * 0.01, w * 0.05 * s, h * (0.14 + (i % 3) * 0.07) * s, w * 0.012);
        ctx.fillStyle = p.flame;
        ctx.fill();
        pen(ctx, p.ink, 2.2);
        ctx.stroke();
      }
      ctx.fillStyle = p.accent;
      flame(ctx, x, deck, w * 0.03 * s, h * 0.13 * s, w * 0.008);
      ctx.fill();
      glow(ctx, x, deck, h * 0.3 * s, p.flame, 0.35);
    }

    // Burning water under the wrecks.
    seaLines(ctx, p.sea, w, sea + h * 0.05, 3, h * 0.06, h * 0.024, 0.6, 2.4);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = p.flame;
    for (const [x, s] of ships) {
      ctx.beginPath();
      ctx.ellipse(x, sea + h * 0.08, w * 0.11 * s, h * 0.03, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  },

  'Forge of the Fallen': (ctx, w, h, p) => {
    const floor = h * 0.9;
    const cx = w * 0.46;

    // Hood of the forge, built in the shape of a skull.
    skull(ctx, cx, h * 0.3, Math.min(w, h) * 0.3);
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 3.6);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, 0, w, h * 0.7, w * 0.035, 0.45, 0.3, 1.8);
    ctx.restore();
    // Sockets, lit from inside.
    skullFace(ctx, cx, h * 0.3, Math.min(w, h) * 0.3, p.flame);
    glow(ctx, cx - w * 0.07, h * 0.24, h * 0.12, p.flame, 0.6);
    glow(ctx, cx + w * 0.07, h * 0.24, h * 0.12, p.flame, 0.6);
    // Coals burning in the jaw.
    ctx.fillStyle = p.flame;
    for (let i = 0; i < 4; i++) {
      flame(ctx, cx - w * 0.06 + i * w * 0.04, h * 0.54, w * 0.035, h * 0.1, 0);
      ctx.fill();
    }
    glow(ctx, cx, h * 0.5, h * 0.28, p.flame, 0.45);

    // The anvil.
    const ax = w * 0.46;
    const ay = h * 0.74;
    ctx.beginPath();
    ctx.moveTo(ax - w * 0.16, ay);
    ctx.lineTo(ax + w * 0.11, ay);
    ctx.quadraticCurveTo(ax + w * 0.22, ay + h * 0.02, ax + w * 0.12, ay + h * 0.05);
    ctx.lineTo(ax + w * 0.09, ay + h * 0.06);
    ctx.lineTo(ax + w * 0.05, ay + h * 0.1);
    ctx.lineTo(ax + w * 0.06, floor);
    ctx.lineTo(ax - w * 0.13, floor);
    ctx.lineTo(ax - w * 0.12, ay + h * 0.1);
    ctx.lineTo(ax - w * 0.16, ay + h * 0.06);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3.2);
    ctx.stroke();

    // Work on the anvil face, glowing.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.rect(ax - w * 0.08, ay - h * 0.035, w * 0.13, h * 0.035);
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();

    // Hammer, at the top of its swing.
    pen(ctx, p.ink, 8);
    ctx.beginPath();
    ctx.moveTo(w * 0.74, h * 0.72);
    ctx.lineTo(w * 0.87, h * 0.36);
    ctx.stroke();
    pen(ctx, p.wood, 5);
    ctx.stroke();
    ctx.save();
    ctx.translate(w * 0.88, h * 0.33);
    ctx.rotate(-0.34);
    // Head: a squat block with a flared face and a peen behind.
    ctx.beginPath();
    ctx.moveTo(-w * 0.075, -h * 0.07);
    ctx.lineTo(w * 0.045, -h * 0.055);
    ctx.lineTo(w * 0.075, -h * 0.02);
    ctx.lineTo(w * 0.075, h * 0.03);
    ctx.lineTo(w * 0.045, h * 0.065);
    ctx.lineTo(-w * 0.075, h * 0.08);
    ctx.closePath();
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    pen(ctx, p.metal, 2.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.04, -h * 0.05);
    ctx.lineTo(w * 0.04, h * 0.06);
    ctx.stroke();
    ctx.restore();

    // Sparks off the strike.
    pen(ctx, p.flame, 2.4);
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      const a = -2.5 + i * 0.22;
      const r = h * (0.1 + (i % 3) * 0.06);
      ctx.moveTo(ax + w * 0.02, ay - h * 0.04);
      ctx.lineTo(ax + w * 0.02 + Math.cos(a) * r * 1.6, ay - h * 0.04 + Math.sin(a) * r);
    }
    ctx.stroke();

    // Cinders on the floor.
    hatch(ctx, p.ink, 0, floor, w, h * 0.12, w * 0.03, 0.2, 0.4, 2);
  },

  'Crimson Corsair King': (ctx, w, h, p) => {
    const cx = w * 0.44;
    // Coat and shoulders, facing the viewer down.
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 1.04);
    ctx.quadraticCurveTo(w * 0.16, h * 0.64, cx - w * 0.1, h * 0.6);
    ctx.lineTo(cx + w * 0.12, h * 0.6);
    ctx.quadraticCurveTo(w * 0.74, h * 0.66, w * 0.82, h * 1.04);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, 0, h * 0.58, w, h * 0.5, w * 0.04, -0.25, 0.28, 1.8);
    ctx.restore();
    // Open front, baldric across the chest.
    pen(ctx, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.64);
    ctx.lineTo(cx - w * 0.02, h * 1.04);
    ctx.moveTo(cx + w * 0.08, h * 0.64);
    ctx.lineTo(cx + w * 0.05, h * 1.04);
    ctx.stroke();
    ctx.fillStyle = p.woodDark;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.72);
    ctx.lineTo(w * 0.66, h * 1.04);
    ctx.lineTo(w * 0.73, h * 1.04);
    ctx.lineTo(w * 0.2, h * 0.68);
    ctx.closePath();
    ctx.fill();

    // Head — drawn big, so the face still reads at thumbnail size.
    const hy = h * 0.38;
    const hr = w * 0.115;
    ctx.fillStyle = p.paperDark;
    ctx.beginPath();
    ctx.ellipse(cx, hy, hr, h * 0.2, 0, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();

    // Full beard, squared off at the jaw.
    ctx.beginPath();
    ctx.moveTo(cx - hr, hy + h * 0.02);
    ctx.quadraticCurveTo(cx - hr * 1.05, hy + h * 0.3, cx - hr * 0.45, hy + h * 0.34);
    ctx.quadraticCurveTo(cx, hy + h * 0.42, cx + hr * 0.45, hy + h * 0.34);
    ctx.quadraticCurveTo(cx + hr * 1.05, hy + h * 0.3, cx + hr, hy + h * 0.02);
    ctx.quadraticCurveTo(cx, hy + h * 0.14, cx - hr, hy + h * 0.02);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3);
    ctx.stroke();
    // Moustache.
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.7, hy + h * 0.05);
    ctx.quadraticCurveTo(cx, hy + h * 0.12, cx + hr * 0.7, hy + h * 0.05);
    ctx.quadraticCurveTo(cx, hy + h * 0.02, cx - hr * 0.7, hy + h * 0.05);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();

    // Eyepatch over the left eye, strap running up under the crown.
    pen(ctx, p.ink, 3.2);
    ctx.beginPath();
    ctx.moveTo(cx - hr * 1.05, hy - h * 0.16);
    ctx.lineTo(cx + hr * 0.35, hy - h * 0.03);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx - hr * 0.48, hy - h * 0.05, hr * 0.42, h * 0.05, 0.22, 0, TAU);
    ctx.fillStyle = p.ink;
    ctx.fill();
    // The open eye.
    ctx.beginPath();
    ctx.arc(cx + hr * 0.46, hy - h * 0.04, Math.min(w, h) * 0.026, 0, TAU);
    ctx.fill();
    // Heavy brow.
    pen(ctx, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx + hr * 0.15, hy - h * 0.12);
    ctx.lineTo(cx + hr * 0.82, hy - h * 0.09);
    ctx.stroke();

    // The crown, jammed straight down onto his head.
    ctx.beginPath();
    ctx.moveTo(cx - hr * 1.25, hy - h * 0.16);
    ctx.quadraticCurveTo(cx, hy - h * 0.09, cx + hr * 1.25, hy - h * 0.16);
    ctx.quadraticCurveTo(cx, hy - h * 0.26, cx - hr * 1.25, hy - h * 0.16);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    crown(ctx, cx, h * 0.12, w * 0.24, h * 0.2, 4);
    ctx.fillStyle = p.gold;
    ctx.fill();
    pen(ctx, p.ink, 3.2);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, h * 0.16, Math.min(w, h) * 0.026, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 2.2);
    ctx.stroke();

    // Cutlass shouldered, blade crossing the top corner.
    pen(ctx, p.woodDark, 5);
    ctx.beginPath();
    ctx.moveTo(w * 0.7, h * 0.86);
    ctx.lineTo(w * 0.76, h * 0.68);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.72, h * 0.7);
    ctx.quadraticCurveTo(w * 0.84, h * 0.42, w * 0.96, h * 0.1);
    ctx.lineTo(w * 1.02, h * 0.18);
    ctx.quadraticCurveTo(w * 0.9, h * 0.46, w * 0.79, h * 0.74);
    ctx.closePath();
    ctx.fillStyle = p.metal;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
  },

  'The Last Broadside': (ctx, w, h, p) => {
    const sea = h * 0.82;
    const deck = h * 0.44;

    // Heeling hull, guns run out to starboard.
    ctx.save();
    ctx.translate(w * 0.4, h * 0.6);
    ctx.rotate(-0.1);
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, -h * 0.18);
    ctx.lineTo(w * 0.44, -h * 0.2);
    ctx.quadraticCurveTo(w * 0.46, h * 0.1, w * 0.3, h * 0.2);
    ctx.lineTo(-w * 0.32, h * 0.2);
    ctx.quadraticCurveTo(-w * 0.48, h * 0.06, -w * 0.44, -h * 0.18);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 3.6);
    ctx.stroke();
    // Gunports, lids up, muzzles out.
    for (let i = 0; i < 5; i++) {
      const gx = -w * 0.32 + i * w * 0.17;
      ctx.fillStyle = p.ink;
      ctx.beginPath();
      ctx.rect(gx - w * 0.035, -h * 0.07, w * 0.07, h * 0.075);
      ctx.fill();
      pen(ctx, p.line, 2.4);
      ctx.stroke();
      pen(ctx, p.metalDark, 5);
      ctx.beginPath();
      ctx.moveTo(gx, -h * 0.035);
      ctx.lineTo(gx + w * 0.055, -h * 0.045);
      ctx.stroke();
    }
    pen(ctx, p.wood, 2);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = h * (0.06 + i * 0.05);
      ctx.moveTo(-w * 0.42, y);
      ctx.lineTo(w * 0.36, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Masts and a torn topsail above the smoke.
    pen(ctx, p.ink, 3.2);
    ctx.beginPath();
    ctx.moveTo(w * 0.32, deck);
    ctx.lineTo(w * 0.3, h * 0.04);
    ctx.moveTo(w * 0.58, deck);
    ctx.lineTo(w * 0.58, h * 0.16);
    ctx.moveTo(w * 0.18, h * 0.16);
    ctx.lineTo(w * 0.46, h * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.19, h * 0.17);
    ctx.quadraticCurveTo(w * 0.33, h * 0.24, w * 0.46, h * 0.15);
    ctx.quadraticCurveTo(w * 0.5, h * 0.3, w * 0.48, h * 0.42);
    // Shot-torn foot.
    ctx.lineTo(w * 0.41, h * 0.32);
    ctx.lineTo(w * 0.36, h * 0.44);
    ctx.lineTo(w * 0.3, h * 0.33);
    ctx.lineTo(w * 0.24, h * 0.43);
    ctx.quadraticCurveTo(w * 0.19, h * 0.3, w * 0.19, h * 0.17);
    ctx.closePath();
    ctx.fillStyle = p.sail;
    ctx.fill();
    pen(ctx, p.ink, 2.8);
    ctx.stroke();

    // The broadside going off: gouts of smoke and flame to starboard.
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = p.inkSoft;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(w * (0.68 + i * 0.06), h * (0.52 - (i % 3) * 0.05), w * 0.07, h * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = p.flame;
    for (let i = 0; i < 3; i++) {
      const fx = w * (0.62 + i * 0.05);
      const fy = h * (0.56 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + w * 0.11, fy - h * 0.06);
      ctx.lineTo(fx + w * 0.09, fy + h * 0.01);
      ctx.lineTo(fx + w * 0.14, fy + h * 0.05);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(w * 0.72, h * 0.54, Math.min(w, h) * 0.035, 0, TAU);
    ctx.fill();

    // Shot in flight, trailing arcs.
    pen(ctx, p.ink, 2.2);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const y = h * (0.3 + i * 0.14);
      ctx.moveTo(w * 0.8, y);
      ctx.quadraticCurveTo(w * 0.9, y - h * 0.04, w * 1.0, y - h * 0.02);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.ink;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * 1.0, h * (0.3 + i * 0.14) - h * 0.02, Math.min(w, h) * 0.022, 0, TAU);
      ctx.fill();
    }

    seaLines(ctx, p.sea, w, sea, 3, h * 0.07, h * 0.028, 0.6, 2.4);
  },

  // ----------------------------------------------------------
  // ONYX — black flags, black vaults, black water
  // ----------------------------------------------------------

  'The Black Flag': (ctx, w, h, p) => {
    // Staff.
    pen(ctx, p.woodDark, 6);
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 1.02);
    ctx.lineTo(w * 0.12, h * 0.06);
    ctx.stroke();
    ctx.fillStyle = p.metal;
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.0);
    ctx.lineTo(w * 0.155, h * 0.08);
    ctx.lineTo(w * 0.085, h * 0.08);
    ctx.closePath();
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.stroke();

    // The field itself, snapping out on the wind and torn at the fly.
    ctx.beginPath();
    ctx.moveTo(w * 0.12, h * 0.12);
    ctx.quadraticCurveTo(w * 0.42, h * 0.02, w * 0.68, h * 0.14);
    ctx.quadraticCurveTo(w * 0.84, h * 0.2, w * 0.98, h * 0.1);
    ctx.lineTo(w * 0.9, h * 0.34);
    ctx.lineTo(w * 1.0, h * 0.42);
    ctx.lineTo(w * 0.88, h * 0.56);
    ctx.lineTo(w * 0.96, h * 0.7);
    ctx.quadraticCurveTo(w * 0.7, h * 0.66, w * 0.44, h * 0.8);
    ctx.quadraticCurveTo(w * 0.26, h * 0.88, w * 0.12, h * 0.84);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3.2);
    ctx.stroke();

    // Device, cut out of the black in bare cloth.
    const cx = w * 0.53;
    const cy = h * 0.44;
    const r = Math.min(w, h) * 0.17;
    pen(ctx, p.sail, 7);
    ctx.beginPath();
    ctx.moveTo(cx - r * 1.5, cy + r * 1.35);
    ctx.lineTo(cx + r * 1.5, cy + r * 0.25);
    ctx.moveTo(cx + r * 1.5, cy + r * 1.35);
    ctx.lineTo(cx - r * 1.5, cy + r * 0.25);
    ctx.stroke();
    // Hilts on the crossed sabres.
    ctx.fillStyle = p.sail;
    for (const [hx, hy] of [[cx - r * 1.55, cy + r * 1.4], [cx + r * 1.55, cy + r * 1.4]]) {
      ctx.beginPath();
      ctx.arc(hx, hy, r * 0.22, 0, TAU);
      ctx.fill();
    }
    skull(ctx, cx, cy, r);
    ctx.fillStyle = p.sail;
    ctx.fill();
    skullFace(ctx, cx, cy, r, p.ink);
    // A single red eye-light.
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx - r * 0.42, cy - r * 0.22, r * 0.11, 0, TAU);
    ctx.fill();

    // Ripples in the cloth.
    pen(ctx, p.line, 2.4);
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const x = w * (0.2 + i * 0.07);
      ctx.moveTo(x, h * 0.14);
      ctx.quadraticCurveTo(x + w * 0.03, h * 0.46, x, h * 0.82);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  },

  'Vault of Dead Men': (ctx, w, h, p) => {
    const cx = w * 0.5;
    const base = h * 0.94;

    // Lid, thrown back.
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.46);
    ctx.quadraticCurveTo(w * 0.24, h * 0.04, w * 0.7, h * 0.1);
    ctx.lineTo(w * 0.8, h * 0.32);
    ctx.quadraticCurveTo(w * 0.42, h * 0.26, w * 0.28, h * 0.5);
    ctx.closePath();
    ctx.fillStyle = p.woodDark;
    ctx.fill();
    pen(ctx, p.ink, 3.4);
    ctx.stroke();
    ctx.save();
    ctx.clip();
    hatch(ctx, p.ink, w * 0.16, 0, w * 0.68, h * 0.55, w * 0.04, 0.3, 0.3, 1.8);
    ctx.restore();

    // Body of the chest.
    ctx.beginPath();
    ctx.rect(w * 0.16, h * 0.5, w * 0.68, base - h * 0.5);
    ctx.fillStyle = p.wood;
    ctx.fill();
    pen(ctx, p.ink, 3.6);
    ctx.stroke();
    // Iron bands.
    ctx.fillStyle = p.metalDark;
    for (const bx of [w * 0.24, w * 0.68]) {
      ctx.beginPath();
      ctx.rect(bx, h * 0.5, w * 0.06, base - h * 0.5);
      ctx.fill();
      pen(ctx, p.ink, 2.4);
      ctx.stroke();
    }

    // Skulls looking out over the rim.
    for (const [sx, sr] of [[w * 0.34, 0.075], [cx + w * 0.02, 0.092], [w * 0.68, 0.07]]) {
      const r = Math.min(w, h) * sr;
      skull(ctx, sx, h * 0.5 - r * 0.15, r);
      ctx.fillStyle = p.sail;
      ctx.fill();
      pen(ctx, p.ink, 2.6);
      ctx.stroke();
      skullFace(ctx, sx, h * 0.5 - r * 0.15, r, p.ink);
    }

    // Coin spilling over the front edge.
    ctx.fillStyle = p.gold;
    const coins = [
      [w * 0.2, h * 0.9], [w * 0.28, h * 0.96], [w * 0.42, h * 0.92],
      [w * 0.6, h * 0.97], [w * 0.76, h * 0.9], [w * 0.88, h * 0.98],
      [w * 0.12, h * 0.98],
    ];
    for (const [ccx, ccy] of coins) {
      ctx.beginPath();
      ctx.ellipse(ccx, ccy, Math.min(w, h) * 0.038, Math.min(w, h) * 0.026, 0.2, 0, TAU);
      ctx.fill();
      pen(ctx, p.ink, 2.2);
      ctx.stroke();
    }

    // Lock plate, hanging open.
    ctx.fillStyle = p.metal;
    ctx.beginPath();
    ctx.rect(cx - w * 0.055, h * 0.62, w * 0.11, h * 0.16);
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx, h * 0.7, Math.min(w, h) * 0.028, 0, TAU);
    ctx.fill();
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.arc(cx + w * 0.03, h * 0.58, h * 0.07, Math.PI * 0.6, Math.PI * 1.9);
    ctx.stroke();
  },

  'Lord of the Long Night': (ctx, w, h, p) => {
    const cx = w * 0.46;
    // Moon behind him, low and thin.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = p.paperDark;
    ctx.beginPath();
    ctx.arc(w * 0.74, h * 0.28, Math.min(w, h) * 0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    pen(ctx, p.line, 2.6);
    ctx.beginPath();
    ctx.arc(w * 0.74, h * 0.28, Math.min(w, h) * 0.2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = p.ink;
    for (const [sx, sy, sr] of [[w * 0.14, h * 0.12, h * 0.03], [w * 0.3, h * 0.06, h * 0.022], [w * 0.92, h * 0.6, h * 0.024]]) {
      star(ctx, sx, sy, sr);
      ctx.fill();
    }

    // The figure: a single unbroken black cowl.
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, h * 1.04);
    ctx.quadraticCurveTo(cx - w * 0.15, h * 0.48, cx - w * 0.09, h * 0.3);
    ctx.quadraticCurveTo(cx - w * 0.06, h * 0.06, cx + w * 0.03, h * 0.08);
    ctx.quadraticCurveTo(cx + w * 0.13, h * 0.12, cx + w * 0.1, h * 0.34);
    ctx.quadraticCurveTo(cx + w * 0.17, h * 0.56, cx + w * 0.22, h * 1.04);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3.4);
    ctx.stroke();
    // Folds.
    pen(ctx, p.inkSoft, 2.2);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.06, h * 0.44);
    ctx.quadraticCurveTo(cx - w * 0.1, h * 0.72, cx - w * 0.12, h * 1.0);
    ctx.moveTo(cx + w * 0.05, h * 0.46);
    ctx.quadraticCurveTo(cx + w * 0.1, h * 0.74, cx + w * 0.13, h * 1.0);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The dark under the hood, with two cold points of light.
    ctx.fillStyle = p.metalDark;
    ctx.beginPath();
    ctx.ellipse(cx + w * 0.005, h * 0.24, w * 0.045, h * 0.075, 0.06, 0, TAU);
    ctx.fill();
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.arc(cx - w * 0.013, h * 0.23, Math.min(w, h) * 0.014, 0, TAU);
    ctx.arc(cx + w * 0.025, h * 0.235, Math.min(w, h) * 0.014, 0, TAU);
    ctx.fill();

    // Lantern held out at arm's length — the only light for miles.
    const lx = w * 0.2;
    const ly = h * 0.58;
    pen(ctx, p.ink, 3);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.14, h * 0.48);
    ctx.lineTo(lx, h * 0.42);
    ctx.lineTo(lx, ly - h * 0.11);
    ctx.stroke();
    glow(ctx, lx, ly, h * 0.36, p.accent, 0.5);
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.045, ly - h * 0.1);
    ctx.lineTo(lx + w * 0.045, ly - h * 0.1);
    ctx.lineTo(lx + w * 0.035, ly + h * 0.12);
    ctx.lineTo(lx - w * 0.035, ly + h * 0.12);
    ctx.closePath();
    ctx.fillStyle = p.accent;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.ink, 2.4);
    ctx.beginPath();
    ctx.moveTo(lx, ly - h * 0.1);
    ctx.lineTo(lx, ly + h * 0.12);
    ctx.moveTo(lx - w * 0.05, ly - h * 0.1);
    ctx.lineTo(lx + w * 0.05, ly - h * 0.1);
    ctx.moveTo(lx - w * 0.042, ly + h * 0.12);
    ctx.lineTo(lx + w * 0.042, ly + h * 0.12);
    ctx.stroke();

    // The shadow he drags behind him.
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.14, h * 1.02);
    ctx.quadraticCurveTo(w * 0.86, h * 0.98, w * 1.02, h * 0.86);
    ctx.lineTo(w * 1.02, h * 1.02);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  'The Unlit Sea': (ctx, w, h, p) => {
    const horizon = h * 0.56;

    // A few stars, and nothing else in the sky.
    ctx.fillStyle = p.ink;
    for (const [sx, sy, sr] of [
      [w * 0.14, h * 0.14, h * 0.026], [w * 0.36, h * 0.08, h * 0.018],
      [w * 0.62, h * 0.18, h * 0.014], [w * 0.88, h * 0.1, h * 0.022],
      [w * 0.5, h * 0.3, h * 0.012],
    ]) {
      star(ctx, sx, sy, sr);
      ctx.fill();
    }

    // The tower: dark, and out.
    const tx = w * 0.27;
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.075, horizon + h * 0.04);
    ctx.lineTo(tx - w * 0.045, h * 0.22);
    ctx.lineTo(tx + w * 0.045, h * 0.22);
    ctx.lineTo(tx + w * 0.075, horizon + h * 0.04);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    pen(ctx, p.line, 3.4);
    ctx.stroke();
    // Lamp room — glazed, empty, unlit.
    ctx.beginPath();
    ctx.rect(tx - w * 0.055, h * 0.1, w * 0.11, h * 0.12);
    ctx.fillStyle = p.metalDark;
    ctx.fill();
    pen(ctx, p.ink, 3);
    ctx.stroke();
    pen(ctx, p.inkSoft, 2);
    ctx.beginPath();
    ctx.moveTo(tx, h * 0.1);
    ctx.lineTo(tx, h * 0.22);
    ctx.moveTo(tx - w * 0.055, h * 0.16);
    ctx.lineTo(tx + w * 0.055, h * 0.16);
    ctx.stroke();
    // Gallery rail and cap.
    ctx.fillStyle = p.ink;
    ctx.beginPath();
    ctx.rect(tx - w * 0.075, h * 0.22, w * 0.15, h * 0.03);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.07, h * 0.1);
    ctx.lineTo(tx, h * 0.03);
    ctx.lineTo(tx + w * 0.07, h * 0.1);
    ctx.closePath();
    ctx.fill();
    // One cold ember where the light should be.
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(tx, h * 0.16, Math.min(w, h) * 0.016, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;

    // The rock it stands on.
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.19, horizon + h * 0.06);
    ctx.lineTo(tx - w * 0.09, horizon + h * 0.01);
    ctx.lineTo(tx + w * 0.08, horizon + h * 0.02);
    ctx.lineTo(tx + w * 0.2, horizon + h * 0.07);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();

    // The sea: a solid black field, absolutely flat.
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, horizon + h * 0.05);
    ctx.lineTo(w * 1.02, horizon + h * 0.05);
    ctx.lineTo(w * 1.02, h * 1.02);
    ctx.lineTo(-w * 0.02, h * 1.02);
    ctx.closePath();
    ctx.fillStyle = p.ink;
    ctx.fill();
    // Barely-there swell, scratched back into the black.
    ctx.save();
    ctx.clip();
    seaLines(ctx, p.metalDark, w, horizon + h * 0.14, 4, h * 0.1, h * 0.012, 0.5, 2);
    ctx.restore();

    // The horizon, drawn hard.
    pen(ctx, p.ink, 4);
    ctx.beginPath();
    ctx.moveTo(-w * 0.02, horizon + h * 0.05);
    ctx.lineTo(w * 1.02, horizon + h * 0.05);
    ctx.stroke();
  },
};
