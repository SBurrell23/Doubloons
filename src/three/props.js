// ============================================================
// Every object on the island, built from code.
// ============================================================

import * as THREE from 'three';
import { createNoise, rng } from './noise.js';
import { sandTexture, sandBump, woodTexture, rockTexture, barkTexture } from './textures.js';
import { GEM_INFO } from '../game/data.js';

const noise = createNoise(90210);

// ------------------------------------------------------------
// Shared materials
// ------------------------------------------------------------

export function makeGemMaterial(gem, env) {
  const info = GEM_INFO[gem];
  if (gem === 'doubloon') {
    return new THREE.MeshStandardMaterial({
      color: 0xf0c94e,
      metalness: 0.92,
      roughness: 0.26,
      envMap: env || null,
      envMapIntensity: 2.0,
    });
  }
  // Solid stones rather than glass: transmission washes the colour out
  // at this size, and the facets carry the read instead. No emissive —
  // it flattens exactly the facet-to-facet contrast we want.
  return new THREE.MeshPhysicalMaterial({
    color: info.hex,
    metalness: 0,
    roughness: 0.06,
    clearcoat: 0.55,
    clearcoatRoughness: 0.03,
    reflectivity: 0.85,
    envMap: env || null,
    envMapIntensity: 1.15,
    flatShading: true,
  });
}

/**
 * A cut gem: a tall brilliant crown over a deep pavilion, meeting at
 * the girdle. Eight sides, flat shaded, so every facet reads.
 */
export function gemGeometry(radius = 1) {
  const crownH = radius * 0.85;
  const crown = new THREE.ConeGeometry(radius, crownH, 8, 1);
  crown.translate(0, crownH / 2, 0);
  // Flatten the apex into a table facet.
  const cp = crown.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    if (cp.getY(i) > crownH * 0.92) {
      const a = Math.atan2(cp.getZ(i), cp.getX(i));
      cp.setXYZ(i, Math.cos(a) * radius * 0.32, crownH * 0.66, Math.sin(a) * radius * 0.32);
    }
  }

  const pavH = radius * 1.1;
  const pavilion = new THREE.ConeGeometry(radius, pavH, 8, 1);
  pavilion.rotateX(Math.PI);
  pavilion.translate(0, -pavH / 2, 0);

  const merged = mergeGeometries([crown, pavilion]);
  merged.computeVertexNormals();
  // The girdle sits at y = 0; the tip reaches -1.1r.
  merged.userData = { girdle: 0, tip: -pavH };
  return merged;
}

/** Stitch a few BufferGeometries together without pulling in an addon. */
function mergeGeometries(list) {
  const positions = [];
  const normals = [];
  for (const geo of list) {
    const nonIndexed = geo.index ? geo.toNonIndexed() : geo;
    positions.push(...nonIndexed.attributes.position.array);
    if (nonIndexed.attributes.normal) normals.push(...nonIndexed.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  }
  return out;
}

/** A doubloon: a thick, slightly bevelled disc. */
export function coinGeometry(radius = 1) {
  return new THREE.CylinderGeometry(radius, radius, radius * 0.22, 20, 1);
}

// ------------------------------------------------------------
// Island terrain
// ------------------------------------------------------------

/**
 * A round sandy island. Returns { mesh, heightAt } so props can be
 * planted on the surface.
 */
export function createIsland({ radius = 26, segments = 200 } = {}) {
  // The disc runs well past the island proper so the sand carries on
  // under the water as a shelf rather than stopping at a hard edge.
  const geo = new THREE.CircleGeometry(radius * 1.55, segments, 0, Math.PI * 2);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;

  // Tuned so the middle sits ~3 units clear of the waterline and the
  // beach breaks at roughly 0.88 of the radius — a broad, gentle shore
  // rather than water lapping at the table.
  const HEIGHT = 3.26;
  const SINK = 1.66;

  const heightAt = (x, z) => {
    const angle = Math.atan2(z, x);
    // Wobble the effective radius so the shoreline is not a perfect circle.
    const wobble = 1 + noise.fbm(Math.cos(angle) * 1.7, Math.sin(angle) * 1.7, 3, 3) * 0.13;
    const d = Math.sqrt(x * x + z * z) / (radius * wobble);
    // Clamp before the fractional power: cos goes negative past the rim
    // and a negative base to the power 1.5 is NaN, which would void the
    // whole mesh.
    const dome = Math.pow(Math.max(0, Math.cos(Math.min(1, d) * Math.PI * 0.5)), 1.5);
    const bumps = noise.fbm(x / 12, z / 12, 0, 3) * 0.7;
    const ripples = noise.fbm(x / 3.2, z / 3.2, 7, 2) * 0.13;
    // Past the rim the sand keeps sloping away as an underwater shelf.
    const shelf = d > 1 ? -(d - 1) * 2.6 : 0;
    return dome * HEIGHT - SINK + (bumps + ripples) * dome + shelf;
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    uv.setXY(i, (x / radius) * 3.0 + 0.5, (z / radius) * 3.0 + 0.5);
  }
  geo.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: sandTexture(512),
    bumpMap: sandBump(256),
    bumpScale: 0.4,
    roughness: 0.98,
    metalness: 0,
    color: 0xe2c089,
  });
  material.map.repeat.set(1, 1);

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'island';
  return { mesh, heightAt, radius };
}

/**
 * A band of bright turquoise sitting just under the surface, so the
 * water reads as shallow where it covers the sand shelf.
 */
export function createShallows(radius) {
  // Sits just *above* the water, not below it: the sea itself is opaque,
  // so the lagoon look has to be painted on top of it.
  const geo = new THREE.RingGeometry(radius * 0.80, radius * 1.30, 128, 1);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x63d8d0,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -1.2;
  mesh.renderOrder = 3;
  return mesh;
}

// ------------------------------------------------------------
// Palm tree
// ------------------------------------------------------------

function frondTexture() {
  const w = 256, h = 512;
  const el = document.createElement('canvas');
  el.width = w; el.height = h;
  const ctx = el.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  const mid = w / 2;
  const base = h - 8;      // stem end
  const tip = 14;          // pointed end

  // Half-width of the blade at a given position along the rib.
  // Narrow at the stem, widest a third of the way out, tapering to a point.
  const spanAt = (t) => Math.sin(Math.pow(t, 0.62) * Math.PI) * (w * 0.46) + 6;
  const yAt = (t) => base - t * (base - tip);

  // --- the solid blade, drawn as one silhouette per side ---
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(mid, base, mid + dir * w * 0.46, tip);
    g.addColorStop(0, '#5d9f24');
    g.addColorStop(0.45, '#6cb62c');
    g.addColorStop(1, '#3d7d18');
    ctx.fillStyle = g;

    ctx.beginPath();
    ctx.moveTo(mid, base);
    // Out along the leading edge. Each blade droops a little further
    // from the rib than the last, which gives the frond its curve.
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      ctx.lineTo(mid + dir * spanAt(t), yAt(t) + 14 + t * 26);
    }
    ctx.lineTo(mid, tip);
    ctx.closePath();
    ctx.fill();
  }

  // --- notch the outer edge so it reads as separate leaflets ---
  ctx.globalCompositeOperation = 'destination-out';
  const notches = 22;
  for (const dir of [-1, 1]) {
    for (let i = 1; i < notches; i++) {
      const t = i / notches;
      const span = spanAt(t);
      const y = yAt(t) + 14 + t * 26;
      // A thin wedge cut inward from the edge toward the rib.
      ctx.beginPath();
      ctx.moveTo(mid + dir * span * 1.02, y - 3);
      ctx.lineTo(mid + dir * span * 0.58, y + 7);
      ctx.lineTo(mid + dir * span * 1.02, y + 13);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';

  // --- shading: a darker wash along the underside of each leaflet ---
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = '#2c6410';
  ctx.lineWidth = 2.5;
  for (const dir of [-1, 1]) {
    for (let i = 1; i < notches; i++) {
      const t = i / notches;
      const span = spanAt(t);
      const y = yAt(t) + 14 + t * 26;
      ctx.beginPath();
      ctx.moveTo(mid + dir * span * 0.18, y + 2);
      ctx.quadraticCurveTo(mid + dir * span * 0.7, y + 3, mid + dir * span * 0.99, y + 5);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // --- central rib, thick at the stem and tapering to the tip ---
  const ribGrad = ctx.createLinearGradient(mid, h, mid, 0);
  ribGrad.addColorStop(0, '#7a9c31');
  ribGrad.addColorStop(1, '#a3cc55');
  ctx.strokeStyle = ribGrad;
  ctx.lineCap = 'round';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(mid, h);
  ctx.lineTo(mid, tip + 6);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(mid - 2, h - 20);
  ctx.lineTo(mid - 2, tip + 14);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

let cachedFrond = null;

/**
 * One palm. `sway` is called each frame by the scene to animate the
 * fronds in the breeze.
 */
export function createPalm({ height = 11, lean = 0.42, seed = 5 } = {}) {
  const group = new THREE.Group();
  const rand = rng(seed);

  // --- trunk: a tapered cylinder bent along a gentle arc ---
  const segments = 26;
  const trunk = new THREE.CylinderGeometry(0.22, 0.48, height, 12, segments, true);
  const pos = trunk.attributes.position;
  const bend = (t) => new THREE.Vector3(
    Math.sin(t * Math.PI * 0.42) * lean * height * 0.34,
    0,
    Math.sin(t * Math.PI * 0.30) * lean * height * 0.12,
  );
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + height / 2) / height;
    const offset = bend(t);
    // Slight swelling gives it an organic taper.
    const swell = 1 + Math.sin(t * Math.PI * 3) * 0.05;
    pos.setX(i, pos.getX(i) * swell + offset.x);
    pos.setZ(i, pos.getZ(i) * swell + offset.z);
  }
  trunk.computeVertexNormals();
  const bark = barkTexture(256);
  bark.repeat.set(2, 5);
  const trunkMesh = new THREE.Mesh(trunk, new THREE.MeshStandardMaterial({
    map: bark, roughness: 0.92, metalness: 0,
  }));
  trunkMesh.position.y = height / 2;
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // --- crown ---
  const top = bend(1);
  const crown = new THREE.Group();
  crown.position.set(top.x, height, top.z);
  group.add(crown);

  if (!cachedFrond) cachedFrond = frondTexture();
  const frondMaterial = new THREE.MeshStandardMaterial({
    map: cachedFrond,
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0,
  });

  const frondCount = 9;
  const fronds = [];
  for (let i = 0; i < frondCount; i++) {
    // A plane bent downward into a drooping arc.
    const geo = new THREE.PlaneGeometry(2.3, 5.0, 4, 18);
    const p = geo.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const y = p.getY(v);
      // Clamp before the fractional power: the plane's extreme rows land
      // a hair below zero in floating point, and pow(negative, 2.1) is NaN.
      const t = Math.max(0, (y + 2.5) / 5.0);  // 0 at base, 1 at tip
      p.setZ(v, -Math.pow(t, 2.1) * 2.6);      // droop
      p.setY(v, y * 0.92);
    }
    geo.computeVertexNormals();
    geo.translate(0, 2.3, 0);

    const frond = new THREE.Mesh(geo, frondMaterial);
    const angle = (i / frondCount) * Math.PI * 2 + rand() * 0.25;
    frond.rotation.order = 'YXZ';
    frond.rotation.y = angle;
    frond.rotation.x = -Math.PI / 2 + 0.55 + rand() * 0.28;
    frond.castShadow = true;
    frond.userData.base = { x: frond.rotation.x, z: frond.rotation.z, phase: rand() * Math.PI * 2 };
    crown.add(frond);
    fronds.push(frond);
  }

  // Coconuts nestled in the crown.
  const nutGeo = new THREE.SphereGeometry(0.34, 10, 8);
  const nutMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.88 });
  for (let i = 0; i < 5; i++) {
    const nut = new THREE.Mesh(nutGeo, nutMat);
    const a = rand() * Math.PI * 2;
    nut.position.set(Math.cos(a) * 0.55, -0.35 - rand() * 0.25, Math.sin(a) * 0.55);
    nut.castShadow = true;
    crown.add(nut);
  }

  group.userData.sway = (time, strength = 1) => {
    for (const frond of fronds) {
      const { base } = frond.userData;
      frond.rotation.x = base.x + Math.sin(time * 1.1 + base.phase) * 0.075 * strength;
      frond.rotation.z = base.z + Math.cos(time * 0.83 + base.phase) * 0.10 * strength;
    }
    crown.rotation.z = Math.sin(time * 0.55) * 0.016 * strength;
  };

  return group;
}

// ------------------------------------------------------------
// Rocks, coconuts, driftwood
// ------------------------------------------------------------

export function createRock({ radius = 1, seed = 1, detail = 1 } = {}) {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  const rand = rng(seed);
  const jx = rand() * 100, jy = rand() * 100, jz = rand() * 100;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = noise.fbm(x * 1.2 + jx, y * 1.2 + jy, z * 1.2 + jz, 3);
    const scale = 1 + n * 0.34;
    pos.setXYZ(i, x * scale, y * scale * 0.78, z * scale);
  }
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: rockTexture(256),
    roughness: 0.95,
    metalness: 0,
    color: 0xbfb6a6,
  }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Loose coconuts scattered on the sand, as one instanced mesh. */
export function createCoconuts(spots) {
  const geo = new THREE.SphereGeometry(0.36, 12, 10);
  // Slightly ovoid, like a real husked coconut.
  geo.scale(1, 1.15, 0.94);
  const material = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geo, material, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((spot, i) => {
    dummy.position.set(spot.x, spot.y + 0.3, spot.z);
    dummy.rotation.set(spot.rx || 0, spot.ry || 0, spot.rz || 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A bleached driftwood log. */
export function createDriftwood(seed = 3) {
  const geo = new THREE.CylinderGeometry(0.32, 0.4, 4.6, 9, 6);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const n = noise.fbm(pos.getX(i) * 2, y * 0.9, pos.getZ(i) * 2, 2) * 0.1;
    pos.setX(i, pos.getX(i) * (1 + n) + Math.sin(y * 0.6) * 0.14);
    pos.setZ(i, pos.getZ(i) * (1 + n));
  }
  geo.computeVertexNormals();
  geo.rotateZ(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: 0xb7a189, roughness: 0.95, metalness: 0, map: barkTexture(256),
  }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.y = seed * 0.7;
  return mesh;
}

// ------------------------------------------------------------
// Crabs
// ------------------------------------------------------------

/**
 * A little crab that scuttles around a patch of sand.
 * `update(time, heightAt)` moves it and wiggles its legs.
 */
export function createCrab({ seed = 1, home = new THREE.Vector3(), range = 3.2, scale = 1 } = {}) {
  const rand = rng(seed * 977 + 11);
  const group = new THREE.Group();
  const shellColor = [0xd6552f, 0xc9432b, 0xe0703a, 0xb8412c][Math.floor(rand() * 4)];
  const shellMat = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.52, metalness: 0.05 });
  const limbMat = new THREE.MeshStandardMaterial({ color: shellColor, roughness: 0.6 });

  // Body: a squashed dome.
  const bodyGeo = new THREE.SphereGeometry(0.42, 16, 12);
  bodyGeo.scale(1.25, 0.62, 1);
  const body = new THREE.Mesh(bodyGeo, shellMat);
  body.position.y = 0.30;
  body.castShadow = true;
  group.add(body);

  // Underside, a shade paler.
  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.40, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf0c9a8, roughness: 0.7 }),
  );
  belly.scale.set(1.2, 0.5, 0.95);
  belly.position.y = 0.30;
  group.add(belly);

  // Eyes on stalks.
  const eyes = [];
  for (const dir of [-1, 1]) {
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.26, 6),
      limbMat,
    );
    stalk.position.set(dir * 0.16, 0.56, 0.24);
    group.add(stalk);
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.25 }),
    );
    eye.position.set(dir * 0.16, 0.70, 0.25);
    group.add(eye);
    eyes.push(eye);
  }

  // Claws.
  const claws = [];
  for (const dir of [-1, 1]) {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.42, 6), limbMat);
    upper.rotation.z = dir * 0.9;
    upper.position.set(dir * 0.22, 0, 0);
    arm.add(upper);

    const clawGeo = new THREE.SphereGeometry(0.19, 10, 8);
    clawGeo.scale(1.35, 0.62, 0.8);
    const claw = new THREE.Mesh(clawGeo, shellMat);
    claw.position.set(dir * 0.56, 0.06, 0.06);
    claw.rotation.z = dir * 0.35;
    claw.castShadow = true;
    arm.add(claw);

    // The pincer's lower jaw.
    const jaw = new THREE.Mesh(clawGeo.clone(), shellMat);
    jaw.scale.set(0.8, 0.5, 0.8);
    jaw.position.set(dir * 0.62, -0.08, 0.06);
    arm.add(jaw);

    arm.position.set(dir * 0.38, 0.30, 0.24);
    arm.userData = { dir, jaw, claw };
    group.add(arm);
    claws.push(arm);
  }

  // Legs: four a side.
  const legs = [];
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.36, 5), limbMat);
      thigh.position.y = -0.14;
      thigh.rotation.z = dir * 0.85;
      leg.add(thigh);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.036, 0.30, 5), limbMat);
      shin.position.set(dir * 0.26, -0.30, 0);
      shin.rotation.z = dir * -0.5;
      leg.add(shin);

      leg.position.set(dir * 0.40, 0.30, 0.10 - i * 0.17);
      leg.userData = { dir, phase: i * 0.8 + (dir > 0 ? Math.PI : 0) };
      group.add(leg);
      legs.push(leg);
    }
  }

  group.scale.setScalar(scale);

  // Wandering state.
  const state = {
    pos: home.clone(),
    heading: rand() * Math.PI * 2,
    speed: 0.5 + rand() * 0.5,
    restUntil: 0,
    nextTurn: rand() * 2,
    phase: rand() * 10,
  };

  group.userData.update = (time, dt, heightAt) => {
    const moving = time > state.restUntil;

    if (time > state.nextTurn) {
      state.nextTurn = time + 1.2 + rand() * 2.6;
      if (rand() < 0.22) {
        state.restUntil = time + 0.6 + rand() * 1.8;
      } else {
        state.heading += (rand() - 0.5) * 2.2;
      }
    }

    if (moving) {
      // Crabs walk sideways, so face across the direction of travel.
      const step = state.speed * dt;
      state.pos.x += Math.cos(state.heading) * step;
      state.pos.z += Math.sin(state.heading) * step;

      // Stay near home.
      const away = state.pos.distanceTo(home);
      if (away > range) {
        const back = Math.atan2(home.z - state.pos.z, home.x - state.pos.x);
        state.heading = back + (rand() - 0.5) * 0.8;
      }
    }

    const y = heightAt ? heightAt(state.pos.x, state.pos.z) : 0;
    group.position.set(state.pos.x, y, state.pos.z);
    group.rotation.y = -state.heading + Math.PI / 2;

    // Legs paddle only while walking.
    const gait = moving ? 1 : 0.12;
    for (const leg of legs) {
      const swing = Math.sin(time * 9 + leg.userData.phase) * 0.36 * gait;
      leg.rotation.x = swing;
      leg.rotation.z = Math.cos(time * 9 + leg.userData.phase) * 0.1 * gait;
    }
    // Idle claw waving.
    for (const arm of claws) {
      arm.rotation.z = Math.sin(time * 2.2 + state.phase) * 0.18 * arm.userData.dir;
      arm.userData.jaw.rotation.z = arm.userData.dir * (0.35 + Math.sin(time * 5 + state.phase) * 0.22);
    }
    body.position.y = 0.30 + Math.abs(Math.sin(time * 9)) * 0.012 * gait;
  };

  return group;
}

// ------------------------------------------------------------
// The dug hole and the treasure chest
// ------------------------------------------------------------

/**
 * A hole in the sand with an open chest of gems sitting in it.
 * Returns a group; `userData.update` twinkles the gems.
 */
export function createTreasurePit({ radius = 3.0, depth = 1.5, env = null } = {}) {
  const group = new THREE.Group();
  const rand = rng(4242);

  // --- the pit: a cone-ish bowl of darker sand ---
  const pitGeo = new THREE.CylinderGeometry(radius, radius * 0.55, depth, 40, 6, true);
  const pos = pitGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = noise.fbm(x * 1.5, y * 1.5, z * 1.5, 3) * 0.14;
    pos.setXYZ(i, x * (1 + n), y, z * (1 + n));
  }
  pitGeo.computeVertexNormals();
  const sand = sandTexture(512);
  const pitMat = new THREE.MeshStandardMaterial({
    map: sand,
    color: 0xb59a6e,
    roughness: 1,
    metalness: 0,
    side: THREE.BackSide,
  });
  const pit = new THREE.Mesh(pitGeo, pitMat);
  pit.position.y = -depth / 2;
  pit.receiveShadow = true;
  group.add(pit);

  // Pit floor.
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius * 0.56, 32),
    new THREE.MeshStandardMaterial({ map: sand, color: 0x9d8158, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -depth + 0.02;
  floor.receiveShadow = true;
  group.add(floor);

  // Spoil heaped around the rim.
  const spoilGeo = new THREE.TorusGeometry(radius * 1.06, 0.34, 8, 42);
  const spoilPos = spoilGeo.attributes.position;
  for (let i = 0; i < spoilPos.count; i++) {
    const x = spoilPos.getX(i), y = spoilPos.getY(i), z = spoilPos.getZ(i);
    const n = noise.fbm(x * 1.1, y * 1.1, z * 1.1, 3);
    spoilPos.setXYZ(i, x * (1 + n * 0.22), y * (1 + n * 0.5), z * (1 + n * 0.22));
  }
  spoilGeo.computeVertexNormals();
  spoilGeo.rotateX(-Math.PI / 2);
  const spoil = new THREE.Mesh(spoilGeo, new THREE.MeshStandardMaterial({
    map: sand, color: 0xe8cf9e, roughness: 1,
  }));
  spoil.position.y = 0.04;
  spoil.scale.y = 0.55;
  spoil.castShadow = true;
  spoil.receiveShadow = true;
  group.add(spoil);

  // --- the chest ---
  const chest = new THREE.Group();
  chest.position.set(0, -depth + 0.04, 0);
  chest.rotation.y = -0.38;
  group.add(chest);

  const chestW = 2.0, chestH = 1.0, chestD = 1.3;
  const wood = woodTexture({ size: 512, planks: 5, base: '#7a4a22', dark: '#4e2d12', light: '#9c6634' });
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.82, metalness: 0.05 });
  const ironMat = new THREE.MeshStandardMaterial({
    color: 0x3b3128, roughness: 0.45, metalness: 0.85, envMap: env, envMapIntensity: 1.1,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9a92c, roughness: 0.3, metalness: 0.95, envMap: env, envMapIntensity: 1.3,
  });

  const box = new THREE.Mesh(new THREE.BoxGeometry(chestW, chestH, chestD), woodMat);
  box.position.y = chestH / 2;
  box.castShadow = true;
  box.receiveShadow = true;
  chest.add(box);

  // Iron bands around the base.
  for (const x of [-chestW * 0.34, chestW * 0.34]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.13, chestH + 0.03, chestD + 0.04), ironMat);
    band.position.set(x, chestH / 2, 0);
    chest.add(band);
  }

  // Lid: a half cylinder, hinged open.
  const lid = new THREE.Group();
  lid.position.set(0, chestH, -chestD / 2);
  chest.add(lid);

  const lidGeo = new THREE.CylinderGeometry(chestD / 2, chestD / 2, chestW, 20, 1, false, 0, Math.PI);
  lidGeo.rotateZ(Math.PI / 2);
  const lidMesh = new THREE.Mesh(lidGeo, woodMat);
  lidMesh.position.set(0, 0, chestD / 2);
  lidMesh.castShadow = true;
  lid.add(lidMesh);

  // Flat underside of the lid so it isn't hollow from the front.
  const lidCap = new THREE.Mesh(new THREE.BoxGeometry(chestW, 0.08, chestD), woodMat);
  lidCap.position.set(0, -0.02, chestD / 2);
  lid.add(lidCap);

  for (const x of [-chestW * 0.34, chestW * 0.34]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(chestD / 2 + 0.02, 0.055, 6, 16, Math.PI), ironMat);
    band.rotation.y = Math.PI / 2;
    band.position.set(x, 0, chestD / 2);
    lid.add(band);
  }

  // Thrown open and leaning back.
  lid.rotation.x = -2.05;

  // Lock plate on the front of the box.
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.08), goldMat);
  lock.position.set(0, chestH * 0.62, chestD / 2 + 0.02);
  chest.add(lock);
  const keyhole = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.02, 6, 12), ironMat);
  keyhole.position.set(0, chestH * 0.64, chestD / 2 + 0.07);
  chest.add(keyhole);

  // --- gems heaped inside ---
  const gemNames = ['pearl', 'sapphire', 'emerald', 'ruby', 'onyx'];
  const twinklers = [];
  const gemGeo = gemGeometry(0.15);
  for (const gem of gemNames) {
    const count = 9;
    const mesh = new THREE.InstancedMesh(gemGeo, makeGemMaterial(gem, env), count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * chestW * 0.36;
      dummy.position.set(Math.cos(a) * r, chestH * 0.78 + rand() * 0.16, Math.sin(a) * r * 0.62);
      dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      dummy.scale.setScalar(0.8 + rand() * 0.6);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    chest.add(mesh);
  }

  // A pile of coins under the gems.
  const coinGeo = coinGeometry(0.17);
  const coins = new THREE.InstancedMesh(coinGeo, goldMat, 46);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * chestW * 0.40;
    dummy.position.set(Math.cos(a) * r, chestH * 0.66 + rand() * 0.14, Math.sin(a) * r * 0.6);
    dummy.rotation.set(rand() * 0.7, rand() * 6, rand() * 0.7);
    dummy.updateMatrix();
    coins.setMatrixAt(i, dummy.matrix);
  }
  coins.instanceMatrix.needsUpdate = true;
  coins.castShadow = true;
  chest.add(coins);

  // Sparkles that catch the sun above the hoard.
  const sparkGeo = new THREE.BufferGeometry();
  const sparkCount = 26;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkSeed = new Float32Array(sparkCount);
  for (let i = 0; i < sparkCount; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.8;
    sparkPos[i * 3] = Math.cos(a) * r;
    sparkPos[i * 3 + 1] = chestH * 0.9 + rand() * 0.35;
    sparkPos[i * 3 + 2] = Math.sin(a) * r * 0.65;
    sparkSeed[i] = rand() * Math.PI * 2;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xfff1b8, size: 0.13, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  chest.add(sparks);
  twinklers.push({ sparks, sparkSeed, sparkCount, baseY: Array.from(sparkPos).filter((_, i) => i % 3 === 1) });

  group.userData.update = (time) => {
    for (const t of twinklers) {
      const attr = t.sparks.geometry.attributes.position;
      for (let i = 0; i < t.sparkCount; i++) {
        attr.setY(i, t.baseY[i] + Math.sin(time * 1.6 + t.sparkSeed[i]) * 0.09);
      }
      attr.needsUpdate = true;
      t.sparks.material.opacity = 0.55 + Math.sin(time * 3.1) * 0.3;
    }
  };

  group.userData.chest = chest;
  return group;
}

// ------------------------------------------------------------
// The table the game is played on
// ------------------------------------------------------------

export function createTable({ radius = 6.2, height = 2.5, env = null } = {}) {
  const group = new THREE.Group();
  const topThickness = 0.32;

  const wood = woodTexture({ size: 1024, planks: 9, base: '#9a6636', dark: '#63401c', light: '#b98551', vertical: true });
  wood.repeat.set(1, 1);
  const topMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.68, metalness: 0.04 });

  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, topThickness, 64), topMat);
  top.position.y = height;
  top.castShadow = true;
  top.receiveShadow = true;
  top.name = 'tableTop';
  group.add(top);

  // A rope rim around the edge.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.13, 8, 72),
    new THREE.MeshStandardMaterial({ color: 0xc8a463, roughness: 0.85 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = height + topThickness / 2 - 0.05;
  rim.castShadow = true;
  group.add(rim);

  // Legs: three barrel-ish posts.
  const legMat = new THREE.MeshStandardMaterial({
    map: woodTexture({ size: 256, planks: 3, base: '#7a4a22', dark: '#4e2d12', light: '#9c6634' }),
    roughness: 0.85,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.38, height, 10), legMat);
    leg.position.set(Math.cos(a) * radius * 0.62, height / 2, Math.sin(a) * radius * 0.62);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  }

  // Cross-brace.
  const brace = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.62, 0.09, 6, 36),
    legMat,
  );
  brace.rotation.x = Math.PI / 2;
  brace.position.y = height * 0.28;
  brace.castShadow = true;
  group.add(brace);

  group.userData.surfaceY = height + topThickness / 2;
  group.userData.radius = radius;
  return group;
}
