// ============================================================
// The playing surface: decks, the twelve face-up cards, the
// Pirate Lord tiles and the six gem piles — all real meshes on
// the table, with hover and click picking.
// ============================================================

import * as THREE from 'three';
import { GEMS, GOLD, ALL_TOKENS, GEM_INFO, TIER_INFO } from '../game/data.js';
import { cardFaceTexture, cardBackTexture, lordTexture } from './textures.js';
import { gemGeometry, coinGeometry, makeGemMaterial } from './props.js';

export const CARD_W = 1.46;
export const CARD_H = 2.04;
const CARD_T = 0.032;
// The Lord tiles are taller than they are wide, like the texture on
// them; they used to be square and the artwork had nowhere to go.
const LORD_W = 1.06;
const LORD_D = 1.36;

const COL_X = [-3.36, -1.68, 0, 1.68, 3.36];
const ROW_Z = { 3: -2.35, 2: -0.05, 1: 2.25 };
const LORD_Z = -4.34;
const TOKEN_Z = 4.26;

// ------------------------------------------------------------
// Tiny tween helper
// ------------------------------------------------------------

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class Tweens {
  constructor() { this.items = []; }

  add({ duration = 0.4, delay = 0, ease = easeOutCubic, onUpdate, onComplete }) {
    const item = { t: -delay, duration, ease, onUpdate, onComplete, done: false };
    this.items.push(item);
    return item;
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.t += dt;
      if (item.t < 0) continue;
      const raw = Math.min(1, item.t / item.duration);
      item.onUpdate?.(item.ease(raw), raw);
      if (raw >= 1) {
        item.onComplete?.();
        this.items.splice(i, 1);
      }
    }
  }

  get busy() { return this.items.length > 0; }
  clear() { this.items.length = 0; }
}

// ------------------------------------------------------------
// Meshes
// ------------------------------------------------------------

const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xe8d9b4, roughness: 0.85 });

/** A soft round dot, used for the glints above the gem dishes. */
let sparkTexture = null;
function getSparkTexture() {
  if (sparkTexture) return sparkTexture;
  const el = document.createElement('canvas');
  el.width = el.height = 64;
  const ctx = el.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,248,222,0.65)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  sparkTexture = new THREE.CanvasTexture(el);
  sparkTexture.colorSpace = THREE.SRGBColorSpace;
  return sparkTexture;
}

function cardGeometry() {
  return new THREE.BoxGeometry(CARD_W, CARD_T, CARD_H);
}

/**
 * A card lying face up on the table. Box face order is
 * +X, -X, +Y, -Y, +Z, -Z, so index 2 is the top.
 */
function makeCardMesh(card, geometry) {
  const face = cardFaceTexture(card);
  const back = cardBackTexture(card.tier);
  const materials = [
    edgeMaterial, edgeMaterial,
    new THREE.MeshStandardMaterial({ map: face, roughness: 0.62, metalness: 0 }),
    new THREE.MeshStandardMaterial({ map: back, roughness: 0.62, metalness: 0 }),
    edgeMaterial, edgeMaterial,
  ];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBackMesh(tier, geometry) {
  const back = cardBackTexture(tier);
  const backMat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.62 });
  const materials = [edgeMaterial, edgeMaterial, backMat, backMat, edgeMaterial, edgeMaterial];
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeLordMesh(lord) {
  const geo = new THREE.BoxGeometry(LORD_W, 0.06, LORD_D);
  const texture = lordTexture(lord);
  const materials = [
    edgeMaterial, edgeMaterial,
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6 }),
    edgeMaterial, edgeMaterial, edgeMaterial,
  ];
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A glowing ring used to show hover and selection. */
function makeHighlight(width, height, color = 0xffd86b) {
  const shape = new THREE.Shape();
  const r = 0.09;
  const w = width / 2 + 0.07;
  const h = height / 2 + 0.07;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);

  const hole = new THREE.Path();
  const iw = width / 2 - 0.005;
  const ih = height / 2 - 0.005;
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  shape.holes.push(hole);

  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 4;
  return mesh;
}

// ------------------------------------------------------------
// Board
// ------------------------------------------------------------

export function createBoard(world, { onPick, onHover } = {}) {
  const root = new THREE.Group();
  world.boardAnchor.add(root);

  const tweens = new Tweens();
  const geometry = cardGeometry();

  // Slots that never change identity — cards swap in and out of them.
  const slots = { 1: [], 2: [], 3: [] };
  const deckMeshes = {};
  const deckLabels = {};
  const lordSlots = [];
  const tokenPiles = {};
  const pickables = [];
  const flying = new THREE.Group();
  root.add(flying);

  // ---- face-up card slots ----
  for (const tier of [1, 2, 3]) {
    for (let i = 0; i < 4; i++) {
      const holder = new THREE.Group();
      holder.position.set(COL_X[i + 1], CARD_T / 2 + 0.002, ROW_Z[tier]);
      root.add(holder);

      const highlight = makeHighlight(CARD_W, CARD_H);
      highlight.position.y = 0.012;
      holder.add(highlight);

      const slot = {
        tier, index: i, holder, highlight,
        mesh: null, card: null,
        home: holder.position.clone(),
      };
      slots[tier].push(slot);
    }
  }

  // ---- decks ----
  for (const tier of [1, 2, 3]) {
    const group = new THREE.Group();
    group.position.set(COL_X[0], 0, ROW_Z[tier]);
    root.add(group);

    const stack = new THREE.Group();
    group.add(stack);
    deckMeshes[tier] = { group, stack, cards: [], highlight: null };

    const highlight = makeHighlight(CARD_W, CARD_H, 0x9fe0ff);
    highlight.position.y = 0.012;
    group.add(highlight);
    deckMeshes[tier].highlight = highlight;

    // A small carved plaque naming the tier.
    const label = makeTierPlaque(tier);
    label.position.set(-1.28, 0.02, 0);
    group.add(label);
    deckLabels[tier] = label;
  }

  // ---- lord tiles ----
  for (let i = 0; i < 5; i++) {
    const holder = new THREE.Group();
    holder.position.set(0, 0.03, LORD_Z);
    root.add(holder);
    const highlight = makeHighlight(LORD_W, LORD_D, 0xffe9a8);
    highlight.position.y = 0.012;
    holder.add(highlight);
    lordSlots.push({ holder, highlight, mesh: null, lord: null });
  }

  // ---- gem piles ----
  const GEM_R = 0.21;
  const PILE_SPREAD = 1.34;
  const gemGeo = gemGeometry(GEM_R);
  const coinGeo = coinGeometry(GEM_R * 1.2);
  const pileOrder = [...GEMS, GOLD];

  /**
   * Where the nth stone sits in a pile: a ring of four resting in the
   * dish, then three nested on top. Spaced so no two merge into a blob.
   */
  function heapSlot(index) {
    if (index < 4) {
      const angle = (index / 4) * Math.PI * 2 + 0.4;
      return { x: Math.cos(angle) * 0.30, y: 0.35, z: Math.sin(angle) * 0.30, spin: angle };
    }
    const angle = ((index - 4) / 3) * Math.PI * 2 + 1.1;
    return { x: Math.cos(angle) * 0.17, y: 0.56, z: Math.sin(angle) * 0.17, spin: angle };
  }

  pileOrder.forEach((token, i) => {
    const group = new THREE.Group();
    group.position.set((i - (pileOrder.length - 1) / 2) * PILE_SPREAD, 0, TOKEN_Z);
    root.add(group);

    // A shallow dish of dark wood under each colour, with a brass rim.
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.48, 0.11, 28),
      new THREE.MeshStandardMaterial({ color: 0x3f2814, roughness: 0.8, metalness: 0.08 }),
    );
    bowl.position.y = 0.055;
    bowl.receiveShadow = true;
    group.add(bowl);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.555, 0.035, 6, 28),
      new THREE.MeshStandardMaterial({ color: 0x8a6a2e, roughness: 0.45, metalness: 0.6 }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.11;
    group.add(rim);

    const highlight = makeHighlight(1.08, 1.08, token === GOLD ? 0xffe08a : GEM_INFO[token].hex);
    highlight.position.y = 0.125;
    group.add(highlight);

    const material = makeGemMaterial(token, world.envMap);
    const stack = new THREE.Group();
    group.add(stack);

    const gems = [];
    for (let g = 0; g < 7; g++) {
      const mesh = new THREE.Mesh(token === GOLD ? coinGeo : gemGeo, material);
      const slot = heapSlot(g);
      if (token === GOLD) {
        // Coins lie flat and stack, rather than standing like stones.
        mesh.position.set(slot.x * 0.62, 0.15 + Math.floor(g / 3) * 0.08, slot.z * 0.62);
        mesh.rotation.set(0.05 * (g % 3), slot.spin, 0.04 * (g % 2));
      } else {
        mesh.position.set(slot.x, slot.y, slot.z);
        // A little tilt so neighbouring stones do not catch the sun identically.
        mesh.rotation.set((g % 3 - 1) * 0.10, slot.spin, (g % 2 ? 1 : -1) * 0.09);
      }
      mesh.castShadow = true;
      stack.add(mesh);
      gems.push(mesh);
    }

    // Glints drifting over the heap. Cheap, and they do most of the
    // work of making a pile of stones look precious.
    const sparkCount = 7;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    const sparkPhase = [];
    for (let k = 0; k < sparkCount; k++) {
      const a = (k / sparkCount) * Math.PI * 2 + 0.7;
      const rad = 0.12 + (k % 3) * 0.13;
      sparkPos[k * 3] = Math.cos(a) * rad;
      sparkPos[k * 3 + 1] = 0.44 + (k % 4) * 0.07;
      sparkPos[k * 3 + 2] = Math.sin(a) * rad;
      sparkPhase.push(a * 1.7 + k);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
      map: getSparkTexture(),
      color: token === GOLD ? 0xfff0bc : 0xffffff,
      size: 0.3,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    }));
    sparks.visible = world.settings.sparkles !== false;
    group.add(sparks);

    tokenPiles[token] = {
      group, stack, gems, highlight, token, count: 0, material,
      sparks, sparkPhase, sparkBaseY: [...sparkPos].filter((_, i) => i % 3 === 1),
    };
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.1, 12),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hit.position.y = 0.5;
    hit.userData.pick = { kind: 'token', token };
    group.add(hit);
    pickables.push(hit);
  });

  function makeTierPlaque(tier) {
    const el = document.createElement('canvas');
    el.width = 256; el.height = 128;
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#6b4a24';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#d9b978';
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 236, 108);
    ctx.fillStyle = '#f3dfae';
    ctx.font = '600 38px Cinzel, Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(TIER_INFO[tier].sub, 128, 64);
    const texture = new THREE.CanvasTexture(el);
    texture.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.BoxGeometry(0.9, 0.05, 0.45);
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, [
      edgeMaterial, edgeMaterial, mat, edgeMaterial, edgeMaterial, edgeMaterial,
    ]);
    mesh.rotation.y = Math.PI / 2;
    mesh.castShadow = true;
    return mesh;
  }

  // ------------------------------------------------------------
  // Syncing to game state
  // ------------------------------------------------------------

  let currentView = null;
  const cardMeshCache = new Map();

  function meshFor(card) {
    if (!cardMeshCache.has(card.id)) {
      cardMeshCache.set(card.id, makeCardMesh(card, geometry));
    }
    return cardMeshCache.get(card.id);
  }

  /** Point the board sync at a fresh state snapshot. */
  function sync(view, { animate = true } = {}) {
    const previous = currentView;
    currentView = view;

    // --- face-up cards ---
    for (const tier of [1, 2, 3]) {
      view.board[tier].forEach((card, i) => {
        const slot = slots[tier][i];
        const sameCard = slot.card && card && slot.card.id === card.id;
        if (sameCard) return;

        if (slot.mesh) {
          slot.holder.remove(slot.mesh);
          slot.mesh = null;
        }
        slot.card = card || null;
        if (!card) return;

        const mesh = meshFor(card);
        mesh.position.set(0, 0, 0);
        mesh.rotation.set(0, 0, 0);
        mesh.scale.setScalar(1);
        mesh.userData.pick = { kind: 'card', cardId: card.id, tier, from: 'board' };
        slot.holder.add(mesh);
        slot.mesh = mesh;
        if (!pickables.includes(mesh)) pickables.push(mesh);

        if (animate && previous) {
          // Deal the replacement in from the deck.
          const from = new THREE.Vector3(COL_X[0] - slot.home.x, 0.4, 0);
          mesh.position.copy(from);
          mesh.rotation.z = -0.5;
          tweens.add({
            duration: 0.42,
            onUpdate: (t) => {
              mesh.position.lerpVectors(from, new THREE.Vector3(0, 0, 0), t);
              mesh.rotation.z = -0.5 * (1 - t);
            },
          });
        }
      });
    }

    // --- decks ---
    for (const tier of [1, 2, 3]) {
      const entry = deckMeshes[tier];
      const remaining = view.deckCounts ? view.deckCounts[tier] : 0;
      const wanted = Math.min(8, Math.ceil(remaining / 5));
      while (entry.cards.length > wanted) {
        const mesh = entry.cards.pop();
        entry.stack.remove(mesh);
      }
      while (entry.cards.length < wanted) {
        const mesh = makeBackMesh(tier, geometry);
        mesh.position.y = CARD_T / 2 + 0.002 + entry.cards.length * CARD_T;
        mesh.rotation.y = (Math.random() - 0.5) * 0.02;
        entry.stack.add(mesh);
        entry.cards.push(mesh);
      }
      const top = entry.cards[entry.cards.length - 1];
      entry.group.userData.remaining = remaining;
      for (const mesh of entry.cards) {
        mesh.userData.pick = null;
        const idx = pickables.indexOf(mesh);
        if (idx >= 0) pickables.splice(idx, 1);
      }
      if (top && remaining > 0) {
        top.userData.pick = { kind: 'deck', tier };
        pickables.push(top);
      }
      entry.highlight.visible = remaining > 0;
    }

    // --- lords ---
    const lords = view.lords || [];
    lordSlots.forEach((slot, i) => {
      const lord = lords[i] || null;
      const same = slot.lord && lord && slot.lord.id === lord.id;
      if (!same) {
        if (slot.mesh) { slot.holder.remove(slot.mesh); slot.mesh = null; }
        slot.lord = lord;
        if (lord) {
          const mesh = makeLordMesh(lord);
          mesh.userData.pick = { kind: 'lord', lordId: lord.id };
          slot.holder.add(mesh);
          slot.mesh = mesh;
          pickables.push(mesh);
        }
      }
      slot.holder.visible = !!lord;
    });
    // Re-centre the row as tiles are claimed.
    const live = lordSlots.filter((s) => s.lord);
    live.forEach((slot, i) => {
      const x = (i - (live.length - 1) / 2) * (LORD_W + 0.24);
      slot.holder.position.x = x;
    });

    // --- gem piles ---
    for (const token of ALL_TOKENS) {
      const pile = tokenPiles[token];
      const count = view.supply[token] || 0;
      pile.count = count;
      pile.gems.forEach((mesh, i) => { mesh.visible = i < count; });
      pile.group.userData.empty = count === 0;
    }

    prunePickables();
  }

  function prunePickables() {
    for (let i = pickables.length - 1; i >= 0; i--) {
      const object = pickables[i];
      if (!object.parent || !object.userData.pick) pickables.splice(i, 1);
    }
  }

  // ------------------------------------------------------------
  // Hover & click
  // ------------------------------------------------------------

  let hovered = null;
  let hoverEnabled = true;
  const selection = new Set();   // pick keys currently marked selected
  const dimmed = new Set();      // pick keys shown as unavailable

  function keyOf(pick) {
    if (!pick) return null;
    if (pick.kind === 'card') return `card:${pick.cardId}`;
    if (pick.kind === 'deck') return `deck:${pick.tier}`;
    if (pick.kind === 'token') return `token:${pick.token}`;
    if (pick.kind === 'lord') return `lord:${pick.lordId}`;
    return null;
  }

  function highlightFor(pick) {
    if (!pick) return null;
    if (pick.kind === 'card') {
      const slot = slots[pick.tier]?.find((s) => s.card && s.card.id === pick.cardId);
      return slot?.highlight || null;
    }
    if (pick.kind === 'deck') return deckMeshes[pick.tier].highlight;
    if (pick.kind === 'token') return tokenPiles[pick.token].highlight;
    if (pick.kind === 'lord') {
      const slot = lordSlots.find((s) => s.lord && s.lord.id === pick.lordId);
      return slot?.highlight || null;
    }
    return null;
  }

  function anchorFor(pick) {
    const highlight = highlightFor(pick);
    if (!highlight) return null;
    const v = new THREE.Vector3();
    highlight.getWorldPosition(v);
    return v;
  }

  function handleMove(event) {
    if (!hoverEnabled || world.rig.isDragging()) {
      setHovered(null);
      return;
    }
    const hits = world.pick(event.clientX, event.clientY, pickables, false);
    const hit = hits.find((h) => h.object.userData.pick);
    setHovered(hit ? hit.object.userData.pick : null);
  }

  function setHovered(pick) {
    const key = keyOf(pick);
    const oldKey = keyOf(hovered);
    if (key === oldKey) return;
    hovered = pick;
    onHover?.(pick, pick ? anchorFor(pick) : null);
  }

  let downPos = null;
  function handleDown(event) {
    // Right and middle drag orbit the camera; they never pick.
    if (event.button !== 0 || event.shiftKey) { downPos = null; return; }
    downPos = { x: event.clientX, y: event.clientY };
  }

  function handleUp(event) {
    if (!downPos || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
    downPos = null;
    if (moved > 6) return;           // that was a camera drag
    if (!hoverEnabled) return;
    const hits = world.pick(event.clientX, event.clientY, pickables, false);
    const hit = hits.find((h) => h.object.userData.pick);
    onPick?.(hit ? hit.object.userData.pick : null, hit ? anchorFor(hit.object.userData.pick) : null);
  }

  world.container.addEventListener('pointermove', handleMove);
  world.container.addEventListener('pointerdown', handleDown);
  world.container.addEventListener('pointerup', handleUp);
  world.container.addEventListener('pointerleave', () => setHovered(null));

  // ------------------------------------------------------------
  // Visual state
  // ------------------------------------------------------------

  function setSelected(keys) {
    selection.clear();
    for (const key of keys) selection.add(key);
  }

  function setDimmed(keys) {
    dimmed.clear();
    for (const key of keys) dimmed.add(key);
  }

  function setInteractive(value) {
    hoverEnabled = value;
    if (!value) setHovered(null);
  }

  /** Pulse a highlight and lift the mesh a touch when hovered. */
  function updateHighlights(dt, time) {
    const pulse = 0.55 + Math.sin(time * 4.2) * 0.22;

    const apply = (highlight, key, mesh) => {
      if (!highlight) return;
      const isHover = keyOf(hovered) === key;
      const isSelected = selection.has(key);
      const isDim = dimmed.has(key);

      let targetOpacity = 0;
      let color = 0xffd86b;
      if (isSelected) { targetOpacity = 0.95; color = 0x7dffa8; }
      else if (isHover && !isDim) { targetOpacity = pulse; color = 0xffd86b; }
      else if (isHover && isDim) { targetOpacity = pulse * 0.7; color = 0xff7b6b; }

      highlight.material.opacity += (targetOpacity - highlight.material.opacity) * Math.min(1, dt * 14);
      highlight.material.color.setHex(color);
      highlight.visible = highlight.material.opacity > 0.01;

      if (mesh) {
        const lift = (isHover || isSelected) ? 0.10 : 0;
        mesh.position.y += (lift - mesh.position.y) * Math.min(1, dt * 12);
      }
    };

    for (const tier of [1, 2, 3]) {
      for (const slot of slots[tier]) {
        if (!slot.card) { slot.highlight.visible = false; continue; }
        apply(slot.highlight, `card:${slot.card.id}`, slot.mesh);
      }
      const entry = deckMeshes[tier];
      apply(entry.highlight, `deck:${tier}`, null);
    }
    for (const slot of lordSlots) {
      if (!slot.lord) continue;
      apply(slot.highlight, `lord:${slot.lord.id}`, slot.mesh);
    }
    for (const token of ALL_TOKENS) {
      const pile = tokenPiles[token];
      apply(pile.highlight, `token:${token}`, null);
      // Gems bob gently when the pile is selectable.
      const hoverKey = keyOf(hovered) === `token:${token}`;
      const target = hoverKey ? 0.09 : 0;
      pile.stack.position.y += (target - pile.stack.position.y) * Math.min(1, dt * 12);
      pile.stack.rotation.y += dt * (hoverKey ? 0.9 : 0.12);

      if (pile.sparks) {
        const show = world.settings.sparkles !== false && pile.count > 0;
        pile.sparks.visible = show;
        if (show) {
          const attr = pile.sparks.geometry.attributes.position;
          for (let k = 0; k < pile.sparkPhase.length; k++) {
            const ph = pile.sparkPhase[k];
            attr.setY(k, pile.sparkBaseY[k] + Math.sin(time * 1.4 + ph) * 0.05);
          }
          attr.needsUpdate = true;
          // Each glint winks in and out on its own clock.
          pile.sparks.material.opacity =
            (0.28 + Math.abs(Math.sin(time * 2.1 + pile.sparkPhase[0])) * 0.62) * (hoverKey ? 1 : 0.8);
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Animations for effects coming out of the rules engine
  // ------------------------------------------------------------

  /** Fly a small gem from a pile toward a screen-space seat marker. */
  function flyToken(token, toWorld, delay = 0) {
    const pile = tokenPiles[token];
    const start = new THREE.Vector3();
    pile.group.getWorldPosition(start);
    start.y += 0.4;
    root.worldToLocal(start);
    const end = toWorld.clone();
    root.worldToLocal(end);

    const mesh = new THREE.Mesh(
      token === GOLD ? coinGeo : gemGeo,
      pile.material,
    );
    mesh.position.copy(start);
    mesh.castShadow = false;
    flying.add(mesh);

    const arc = 1.4;
    tweens.add({
      duration: 0.55, delay, ease: easeInOutCubic,
      onUpdate: (t) => {
        mesh.position.lerpVectors(start, end, t);
        mesh.position.y += Math.sin(t * Math.PI) * arc;
        mesh.rotation.x += 0.16;
        mesh.rotation.y += 0.12;
        mesh.scale.setScalar(1 - t * 0.45);
      },
      onComplete: () => flying.remove(mesh),
    });
  }

  /** Sweep a card off toward a seat. */
  function flyCard(cardId, toWorld, delay = 0) {
    const mesh = cardMeshCache.get(cardId);
    if (!mesh) return;
    const startWorld = new THREE.Vector3();
    mesh.getWorldPosition(startWorld);
    const start = root.worldToLocal(startWorld.clone());
    const end = root.worldToLocal(toWorld.clone());

    const ghost = mesh.clone();
    ghost.position.copy(start);
    ghost.rotation.set(0, 0, 0);
    flying.add(ghost);

    tweens.add({
      duration: 0.6, delay, ease: easeInOutCubic,
      onUpdate: (t) => {
        ghost.position.lerpVectors(start, end, t);
        ghost.position.y += Math.sin(t * Math.PI) * 1.9;
        ghost.rotation.z = t * 0.9;
        ghost.scale.setScalar(1 - t * 0.5);
        for (const m of ghost.material) m.opacity = 1 - Math.pow(t, 3);
      },
      onComplete: () => flying.remove(ghost),
    });
  }

  /** A burst of gold motes when a Pirate Lord joins a crew. */
  function lordFlourish(lordId, toWorld) {
    const slot = lordSlots.find((s) => s.lord?.id === lordId);
    const origin = new THREE.Vector3();
    if (slot) slot.holder.getWorldPosition(origin);
    else world.boardAnchor.getWorldPosition(origin);
    root.worldToLocal(origin);
    const end = root.worldToLocal(toWorld.clone());

    const count = 22;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const offsets = [];
    for (let i = 0; i < count; i++) {
      offsets.push(new THREE.Vector3(
        (Math.random() - 0.5) * 1.1,
        Math.random() * 0.9,
        (Math.random() - 0.5) * 1.1,
      ));
      positions[i * 3] = origin.x;
      positions[i * 3 + 1] = origin.y;
      positions[i * 3 + 2] = origin.z;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffe9a8, size: 0.2, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flying.add(points);

    tweens.add({
      duration: 1.0, ease: easeOutCubic,
      onUpdate: (t) => {
        const attr = geo.attributes.position;
        for (let i = 0; i < count; i++) {
          const o = offsets[i];
          attr.setXYZ(i,
            origin.x + (end.x - origin.x) * t + o.x * (1 - t),
            origin.y + (end.y - origin.y) * t + o.y + Math.sin(t * Math.PI) * 1.2,
            origin.z + (end.z - origin.z) * t + o.z * (1 - t));
        }
        attr.needsUpdate = true;
        points.material.opacity = 1 - t;
      },
      onComplete: () => { flying.remove(points); geo.dispose(); points.material.dispose(); },
    });
  }

  const unsubscribe = world.onFrame((dt, time) => {
    tweens.update(dt);
    updateHighlights(dt, time);
  });

  return {
    root, slots, deckMeshes, lordSlots, tokenPiles, tweens,
    sync, setSelected, setDimmed, setInteractive,
    anchorFor, keyOf,
    flyToken, flyCard, lordFlourish,
    get hovered() { return hovered; },
    get busy() { return tweens.busy; },
    dispose() {
      unsubscribe();
      world.container.removeEventListener('pointermove', handleMove);
      world.container.removeEventListener('pointerdown', handleDown);
      world.container.removeEventListener('pointerup', handleUp);
      world.boardAnchor.remove(root);
    },
  };
}

/** Where each seat sits around the table, for fly-to animations. */
export function seatAnchor(world, seatIndex, seatCount) {
  const angle = Math.PI / 2 + (seatIndex / Math.max(1, seatCount)) * Math.PI * 2;
  const radius = 8.4;
  const v = new THREE.Vector3(Math.cos(angle) * radius, 0.4, Math.sin(angle) * radius);
  return world.boardAnchor.localToWorld(v);
}
