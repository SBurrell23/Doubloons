// ============================================================
// The world: sky, sea, sun, island and the render loop.
// ============================================================

import * as THREE from 'three';
import { createNoise, rng } from './noise.js';
import {
  createIsland, createPalm, createRock, createCoconuts,
  createDriftwood, createCrab, createTreasurePit, createTable,
} from './props.js';

const noise = createNoise(5150);

export const DEFAULT_GRAPHICS = {
  fpsCap: 60,             // 30 | 60 | 120 | 0 (uncapped)
  antialias: true,
  shadows: 'high',        // off | low | high
  pixelRatioCap: 2,
  oceanDetail: 'high',    // low | medium | high
  wildlife: true,         // crabs and gulls
  sparkles: true,
  fov: 48,
  cameraShake: true,
};

// ------------------------------------------------------------
// Sky
// ------------------------------------------------------------

const SKY_VERT = /* glsl */`
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */`
  // The renderer already injects the tone-mapping and colour-space
  // declarations into every program, so only the calls go here.
  varying vec3 vWorldPosition;
  uniform vec3 topColor;
  uniform vec3 horizonColor;
  uniform vec3 sunColor;
  uniform vec3 sunDirection;
  uniform float offset;
  uniform float exponent;

  void main() {
    float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
    float t = pow(max(h, 0.0), exponent);
    vec3 col = mix(horizonColor, topColor, t);

    // Sun disc and a soft bloom around it.
    float sun = max(dot(normalize(vWorldPosition), normalize(sunDirection)), 0.0);
    col += sunColor * pow(sun, 620.0) * 3.0;
    col += sunColor * pow(sun, 18.0) * 0.28;

    gl_FragColor = vec4(col, 1.0);

    // Same tone map and colour space as everything else, so the fogged
    // sea meets the sky without a seam.
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createSky(sunDirection) {
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x2273cc) },
      horizonColor: { value: new THREE.Color(HAZE) },
      sunColor: { value: new THREE.Color(0xfff4d0) },
      sunDirection: { value: sunDirection.clone().normalize() },
      offset: { value: 40 },
      exponent: { value: 0.72 },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'sky';
  return mesh;
}

/** Fluffy cloud billboards well above the horizon. */
function createClouds() {
  const group = new THREE.Group();
  const rand = rng(88);
  const size = 256;
  const el = document.createElement('canvas');
  el.width = el.height = size;
  const ctx = el.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 10, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.SpriteMaterial({
    map: texture, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
  });

  for (let i = 0; i < 26; i++) {
    const cluster = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 4);
    for (let p = 0; p < puffs; p++) {
      const sprite = new THREE.Sprite(material);
      const s = 60 + rand() * 90;
      sprite.scale.set(s, s * (0.5 + rand() * 0.25), 1);
      sprite.position.set((rand() - 0.5) * 110, (rand() - 0.5) * 22, (rand() - 0.5) * 40);
      cluster.add(sprite);
    }
    const angle = rand() * Math.PI * 2;
    const dist = 330 + rand() * 340;
    cluster.position.set(Math.cos(angle) * dist, 90 + rand() * 130, Math.sin(angle) * dist);
    cluster.userData.drift = 0.35 + rand() * 0.6;
    group.add(cluster);
  }
  group.userData.update = (time) => {
    for (const cluster of group.children) {
      cluster.position.x += cluster.userData.drift * 0.02;
      if (cluster.position.x > 720) cluster.position.x = -720;
    }
  };
  return group;
}

// ------------------------------------------------------------
// Ocean — waves are done on the GPU by patching the standard material
// ------------------------------------------------------------

const OCEAN_SEGMENTS = { low: 64, medium: 128, high: 200 };

/**
 * Distance haze. Shared by the fog, the sky's horizon band and the
 * clear colour so all three meet seamlessly. Kept saturated: a paler
 * blue tone-maps to grey and the horizon stops reading as sky.
 */
export const HAZE = 0x8dc3e8;

/** Island radius. The water shader needs it to place the lagoon. */
const ISLAND_RADIUS = 26;

function createOcean(detail = 'high', shoreRadius = 26) {
  const segments = OCEAN_SEGMENTS[detail] ?? 128;
  const geo = new THREE.PlaneGeometry(2200, 2200, segments, segments);
  geo.rotateX(-Math.PI / 2);

  // Water is a dielectric: no metalness, very low roughness, and the
  // look comes from what it reflects rather than from its own colour.
  const material = new THREE.MeshStandardMaterial({
    color: 0x10597d,
    roughness: 0.06,
    metalness: 0,
  });

  const uniforms = {
    uTime: { value: 0 },
    uWaveHeight: { value: 1.0 },
    uShore: { value: shoreRadius },
  };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWaveHeight = uniforms.uWaveHeight;
    shader.uniforms.uShore = uniforms.uShore;

    // ---- vertex: three long, slow swells ----
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        uniform float uTime;
        uniform float uWaveHeight;
        varying vec3 vWorldPos;
        varying float vCrest;

        // Direction, wavelength, amplitude, phase speed.
        // Long and lazy: a calm day, not a storm.
        const vec2 DIR0 = vec2(0.943, 0.333);
        const vec2 DIR1 = vec2(-0.510, 0.860);
        const vec2 DIR2 = vec2(0.220, -0.976);
        const float LEN0 = 78.0, LEN1 = 41.0, LEN2 = 23.0;
        const float AMP0 = 0.58, AMP1 = 0.31, AMP2 = 0.13;
        const float SPD0 = 1.35, SPD1 = 0.95, SPD2 = 0.62;

        float wavePhase(vec2 dir, float len, float spd, vec2 p) {
          return (6.2831853 / len) * (dot(dir, p) - spd * uTime);
        }

        float waveHeight(vec2 p) {
          float h = 0.0;
          h += AMP0 * sin(wavePhase(DIR0, LEN0, SPD0, p));
          h += AMP1 * sin(wavePhase(DIR1, LEN1, SPD1, p));
          h += AMP2 * sin(wavePhase(DIR2, LEN2, SPD2, p));
          return h * uWaveHeight;
        }

        // Exact surface normal, from the analytic gradient of the sum.
        vec3 waveNormal(vec2 p) {
          float k0 = 6.2831853 / LEN0;
          float k1 = 6.2831853 / LEN1;
          float k2 = 6.2831853 / LEN2;
          vec2 g = vec2(0.0);
          g += AMP0 * k0 * DIR0 * cos(wavePhase(DIR0, LEN0, SPD0, p));
          g += AMP1 * k1 * DIR1 * cos(wavePhase(DIR1, LEN1, SPD1, p));
          g += AMP2 * k2 * DIR2 * cos(wavePhase(DIR2, LEN2, SPD2, p));
          g *= uWaveHeight;
          return normalize(vec3(-g.x, 1.0, -g.y));
        }
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        #include <begin_vertex>
        vec3 worldish = (modelMatrix * vec4(transformed, 1.0)).xyz;
        float h = waveHeight(worldish.xz);
        transformed.y += h;
        vCrest = h;
        vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vNormal = normalize(normalMatrix * waveNormal(worldish.xz));
      `);

    // ---- fragment: fine ripples, Fresnel sky, a little foam ----
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`
        #include <common>
        uniform float uTime;
        uniform float uShore;
        varying vec3 vWorldPos;
        varying float vCrest;
      `)
      .replace('#include <normal_fragment_begin>', /* glsl */`
        #include <normal_fragment_begin>
        // Capillary detail, added per pixel so it never aliases into
        // the mesh. Small and slow; it only breaks up the highlight.
        vec2 rp = vWorldPos.xz;
        vec3 wobble = vec3(0.0);
        wobble.x += 0.045 * cos(rp.x * 0.62 + rp.y * 0.21 + uTime * 0.55);
        wobble.z += 0.045 * cos(rp.y * 0.58 - rp.x * 0.19 - uTime * 0.48);
        wobble.x += 0.022 * cos(rp.y * 1.73 - uTime * 0.85);
        wobble.z += 0.022 * cos(rp.x * 1.81 + uTime * 0.79);
        // The shading normal is in view space and the wobble is world
        // space, so rotate it across. normalMatrix is vertex-stage only.
        vec3 wobbleView = (viewMatrix * vec4(wobble, 0.0)).xyz;
        normal = normalize(normal + wobbleView);
      `)
      .replace('#include <fog_fragment>', /* glsl */`

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        vec3 worldNormal = normalize(vec3(0.0, 1.0, 0.0) + vec3(
          -0.35 * cos(vWorldPos.x * 0.62 + uTime * 0.55),
           0.0,
          -0.35 * cos(vWorldPos.z * 0.58 - uTime * 0.48)));

        // Water reflects the sky at grazing angles and almost nothing
        // straight down. Keep the mix gentle so the sun's specular — the
        // thing that actually reads as water — survives.
        float fres = pow(1.0 - clamp(dot(worldNormal, viewDir), 0.0, 1.0), 5.0);

        vec3 skyTint = vec3(0.40, 0.66, 0.84);
        vec3 deep = vec3(0.020, 0.145, 0.235);

        // Troughs sit deeper and darker, crests catch more light.
        float lift = smoothstep(-0.75, 0.70, vCrest);
        vec3 body = mix(deep, gl_FragColor.rgb, 0.45 + lift * 0.55);

        gl_FragColor.rgb = mix(body, skyTint, clamp(fres, 0.0, 1.0) * 0.42);

        // A little sun glitter scattered over the crests.
        float glitter = smoothstep(0.55, 0.95, vCrest) * fres;
        gl_FragColor.rgb += vec3(0.16, 0.18, 0.18) * glitter;

        // The lagoon: water over the island's sand shelf runs shallow
        // and turquoise. Done here rather than as a ring of geometry,
        // which would fight the wave displacement for depth.
        float shore = 1.0 - smoothstep(uShore * 0.72, uShore * 1.46, length(vWorldPos.xz));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.30, 0.72, 0.70), shore * 0.62);

        // Foam only where the swells genuinely pile up, and a fringe
        // where they run out over the shallows.
        float foam = smoothstep(0.78, 1.00, vCrest);
        foam = max(foam, smoothstep(0.34, 0.62, vCrest) * smoothstep(0.55, 0.92, shore));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.90, 0.96, 0.97), foam * 0.42);

        #include <fog_fragment>
      `);
  };
  material.customProgramCacheKey = () => `ocean-v5-${detail}`;

  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -1.4;
  mesh.name = 'ocean';
  mesh.userData.uniforms = uniforms;
  return mesh;
}

// ------------------------------------------------------------
// Camera rig — orbit around the table, with limits
// ------------------------------------------------------------

function createCameraRig(camera, domElement, target, initial = {}) {
  const state = {
    target: target.clone(),
    azimuth: initial.azimuth ?? Math.PI / 2,
    polar: initial.polar ?? 0.72,
    distance: initial.distance ?? 15,
    minDistance: 9,
    maxDistance: 78,
    minPolar: 0.10,
    maxPolar: 1.30,
    enabled: true,
  };

  const desired = { azimuth: state.azimuth, polar: state.polar, distance: state.distance };
  let dragging = false;
  let lastX = 0, lastY = 0;
  let pointers = new Map();
  let pinchStart = 0;

  const onPointerDown = (e) => {
    if (!state.enabled) return;
    // Ignore drags that begin on HUD elements layered over the canvas.
    if (e.target !== domElement && !(e.target instanceof HTMLCanvasElement)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart > 0) {
        desired.distance = clamp(desired.distance * (pinchStart / dist), state.minDistance, state.maxDistance);
      }
      pinchStart = dist;
      return;
    }
    if (!dragging || !state.enabled) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    desired.azimuth -= dx * 0.005;
    desired.polar = clamp(desired.polar - dy * 0.004, state.minPolar, state.maxPolar);
  };

  const onPointerUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (pointers.size === 0) dragging = false;
  };

  const onWheel = (e) => {
    if (!state.enabled) return;
    e.preventDefault();
    desired.distance = clamp(desired.distance * (1 + Math.sign(e.deltaY) * 0.09), state.minDistance, state.maxDistance);
  };

  domElement.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  const targetTarget = state.target.clone();

  function update(dt) {
    const ease = 1 - Math.pow(0.0015, dt);
    state.azimuth += (desired.azimuth - state.azimuth) * ease;
    state.polar += (desired.polar - state.polar) * ease;
    state.distance += (desired.distance - state.distance) * ease;
    state.target.lerp(targetTarget, ease);

    const sinPolar = Math.sin(state.polar);
    camera.position.set(
      state.target.x + state.distance * sinPolar * Math.cos(state.azimuth),
      state.target.y + state.distance * Math.cos(state.polar),
      state.target.z + state.distance * sinPolar * Math.sin(state.azimuth),
    );
    camera.lookAt(state.target);
  }

  return {
    state,
    desired,
    update,
    setTarget(v) { targetTarget.copy(v); },
    moveTo({ azimuth, polar, distance }) {
      if (azimuth !== undefined) desired.azimuth = azimuth;
      if (polar !== undefined) desired.polar = clamp(polar, state.minPolar, state.maxPolar);
      if (distance !== undefined) desired.distance = clamp(distance, state.minDistance, state.maxDistance);
    },
    setEnabled(v) { state.enabled = v; if (!v) { dragging = false; pointers.clear(); } },
    isDragging: () => dragging,
    dispose() {
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
    },
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ------------------------------------------------------------
// World
// ------------------------------------------------------------

export function createWorld(container, graphics = {}) {
  const settings = { ...DEFAULT_GRAPHICS, ...graphics };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HAZE, 60, 480);

  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 2400);

  let renderer = null;
  let canvasEl = null;

  function buildRenderer() {
    const next = new THREE.WebGLRenderer({
      antialias: settings.antialias,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    next.outputColorSpace = THREE.SRGBColorSpace;
    next.toneMapping = THREE.ACESFilmicToneMapping;
    next.toneMappingExposure = 1.02;
    next.shadowMap.enabled = settings.shadows !== 'off';
    next.shadowMap.type = settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    next.setClearColor(HAZE, 1);
    next.domElement.classList.add('game-canvas');
    return next;
  }

  renderer = buildRenderer();
  canvasEl = renderer.domElement;
  container.appendChild(canvasEl);

  // --- sun & light ---
  const sunDirection = new THREE.Vector3(-0.55, 0.62, 0.56).normalize();
  const sun = new THREE.DirectionalLight(0xfff3d6, 2.1);
  sun.position.copy(sunDirection).multiplyScalar(90);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 200;
  const extent = 32;
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(0xb6e4ff, 0xe0c28d, 1.0);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0xbfe0ff, 0.22);
  fill.position.set(30, 22, -40);
  scene.add(fill);

  // --- sky & environment map ---
  const sky = createSky(sunDirection);
  scene.add(sky);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envScene = new THREE.Scene();
  envScene.add(createSky(sunDirection));
  const envTarget = pmrem.fromScene(envScene, 0, 0.1, 1000);
  const envMap = envTarget.texture;
  scene.environment = envMap;

  const clouds = createClouds();
  scene.add(clouds);

  // --- ocean ---
  let ocean = createOcean(settings.oceanDetail, ISLAND_RADIUS);
  scene.add(ocean);

  // --- island ---
  const { mesh: islandMesh, heightAt, radius: islandRadius } = createIsland({ radius: ISLAND_RADIUS });
  scene.add(islandMesh);

  const props = new THREE.Group();
  scene.add(props);

  const plant = (object, x, z, { yOffset = 0, tilt = 0 } = {}) => {
    object.position.set(x, heightAt(x, z) + yOffset, z);
    if (tilt) {
      object.rotation.x += (Math.random() - 0.5) * tilt;
      object.rotation.z += (Math.random() - 0.5) * tilt;
    }
    props.add(object);
    return object;
  };

  // One palm, leaning out over the water behind the table.
  const palm = createPalm({ height: 11.5, lean: 0.62, seed: 11 });
  plant(palm, -13.6, -8.4);
  palm.rotation.y = 2.5;

  // Rocks.
  const rockRand = rng(313);
  const rockSpots = [
    [12.6, -10.4, 1.3], [15.4, -6.8, 0.85], [-14.4, 7.2, 1.55],
    [-11.0, 11.8, 1.0], [8.0, 14.0, 1.2], [-16.6, -3.0, 0.75],
    [16.8, 3.2, 1.05], [3.0, -15.6, 0.9], [-4.8, 16.6, 0.8],
    [-16.4, -9.0, 1.4], [18.4, -1.0, 0.9], [-7.6, -15.2, 1.1],
    [10.4, 17.0, 0.8], [-19.0, 2.6, 1.0],
  ];
  for (const [x, z, r] of rockSpots) {
    const rock = createRock({ radius: r, seed: Math.floor(rockRand() * 9999), detail: 1 });
    plant(rock, x, z, { yOffset: -r * 0.35, tilt: 0.5 });
    rock.rotation.y = rockRand() * Math.PI * 2;
  }

  // Coconuts fallen around the foot of the palm.
  const nutSpots = [];
  for (let i = 0; i < 8; i++) {
    const a = rockRand() * Math.PI * 2;
    const d = 1.6 + rockRand() * 3.4;
    const x = -12.8 + Math.cos(a) * d;
    const z = -7.6 + Math.sin(a) * d;
    nutSpots.push({ x, z, y: heightAt(x, z), rx: rockRand() * 3, ry: rockRand() * 3, rz: rockRand() * 3 });
  }
  props.add(createCoconuts(nutSpots));

  const driftwood = createDriftwood(2);
  plant(driftwood, 12.4, 10.6, { yOffset: 0.3 });

  // --- crabs ---
  const crabs = [];
  if (settings.wildlife) {
    const homes = [
      new THREE.Vector3(10.6, 0, 6.6),
      new THREE.Vector3(-12.2, 0, 2.6),
      new THREE.Vector3(2.4, 0, 13.2),
      new THREE.Vector3(-5.6, 0, -12.4),
    ];
    homes.forEach((home, i) => {
      const crab = createCrab({ seed: i + 3, home, range: 3.0, scale: 0.8 + i * 0.06 });
      props.add(crab);
      crabs.push(crab);
    });
  }

  // --- the dug hole with the chest ---
  const pit = createTreasurePit({ radius: 2.9, depth: 1.6, env: envMap });
  const pitX = 10.4, pitZ = -6.0;
  pit.position.set(pitX, heightAt(pitX, pitZ) + 0.02, pitZ);
  pit.rotation.y = 0.75;
  scene.add(pit);

  // --- the table ---
  const table = createTable({ radius: 6.8, height: 2.5, env: envMap });
  const tableX = 0, tableZ = 0;
  table.position.set(tableX, heightAt(tableX, tableZ), tableZ);
  scene.add(table);

  const boardAnchor = new THREE.Group();
  boardAnchor.position.set(tableX, table.position.y + table.userData.surfaceY, tableZ);
  scene.add(boardAnchor);

  sun.target.position.copy(boardAnchor.position);

  // --- camera ---
  // The rig listens on the container, not the canvas, so toggling
  // antialias (which rebuilds the renderer) does not drop its input.
  // Aim a little forward of the board's centre: the gem dishes sit at
  // the near edge and would otherwise hide behind the action bar.
  const focus = boardAnchor.position.clone().add(new THREE.Vector3(0, 0, 0.9));
  camera.position.set(0, focus.y + 11, 16);
  let rig = createCameraRig(camera, container, focus);

  // --- loop ---
  const clock = new THREE.Clock();
  let running = false;
  let rafId = 0;
  let accumulator = 0;
  const frameCallbacks = new Set();
  const stats = { fps: 0, frames: 0, lastSample: 0, drawCalls: 0, triangles: 0 };

  function renderFrame(dt, time) {
    ocean.userData.uniforms.uTime.value = time;
    palm.userData.sway(time, 1);
    clouds.userData.update(time);
    if (settings.sparkles) pit.userData.update(time);
    for (const crab of crabs) crab.userData.update(time, dt, heightAt);

    for (const cb of frameCallbacks) cb(dt, time);

    renderer.render(scene, camera);
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(0.1, clock.getDelta());
    const time = clock.elapsedTime;

    if (settings.fpsCap > 0) {
      accumulator += dt;
      const step = 1 / settings.fpsCap;
      // Allow a little slack so a 60Hz display hitting a 60 cap never stutters.
      if (accumulator < step - 0.0015) return;
      accumulator = Math.min(accumulator - step, step);
    }

    rig.update(dt);
    renderFrame(dt, time);

    stats.frames++;
    if (time - stats.lastSample >= 0.5) {
      stats.fps = Math.round(stats.frames / (time - stats.lastSample));
      stats.frames = 0;
      stats.lastSample = time;
      stats.drawCalls = renderer.info.render.calls;
      stats.triangles = renderer.info.render.triangles;
    }
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.pixelRatioCap));
    renderer.setSize(width, height, false);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();

  // --- picking ---
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pick(clientX, clientY, objects, recursive = true) {
    const rect = canvasEl.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(objects, recursive);
  }

  function projectToScreen(vector3) {
    const v = vector3.clone().project(camera);
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (v.x * 0.5 + 0.5) * rect.width + rect.left,
      y: (-v.y * 0.5 + 0.5) * rect.height + rect.top,
      behind: v.z > 1,
    };
  }

  // --- quality changes ---
  function applyGraphics(next) {
    const needsRebuild = next.antialias !== undefined && next.antialias !== settings.antialias;
    const oceanChanged = next.oceanDetail !== undefined && next.oceanDetail !== settings.oceanDetail;
    Object.assign(settings, next);

    if (needsRebuild) {
      // Antialiasing is fixed at context creation, so the renderer has
      // to be rebuilt. The camera keeps exactly where it was pointing.
      const old = renderer;
      old.domElement.remove();
      renderer = buildRenderer();
      canvasEl = renderer.domElement;
      container.appendChild(canvasEl);
      old.dispose();
    }

    renderer.shadowMap.enabled = settings.shadows !== 'off';
    renderer.shadowMap.type = settings.shadows === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    sun.castShadow = settings.shadows !== 'off';
    sun.shadow.mapSize.set(settings.shadows === 'high' ? 2048 : 1024, settings.shadows === 'high' ? 2048 : 1024);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });

    camera.fov = settings.fov;
    camera.updateProjectionMatrix();

    if (oceanChanged) {
      scene.remove(ocean);
      ocean.geometry.dispose();
      ocean.material.dispose();
      ocean = createOcean(settings.oceanDetail, ISLAND_RADIUS);
      scene.add(ocean);
    }

    for (const crab of crabs) crab.visible = settings.wildlife;
    resize();
  }

  return {
    scene, camera, container,
    get renderer() { return renderer; },
    get canvas() { return canvasEl; },
    boardAnchor, table, pit, island: islandMesh, heightAt, rig, settings, stats, envMap,
    pick, projectToScreen, resize, applyGraphics,
    onFrame(cb) { frameCallbacks.add(cb); return () => frameCallbacks.delete(cb); },
    start() { if (!running) { running = true; clock.start(); tick(); } },
    stop() { running = false; cancelAnimationFrame(rafId); },
    dispose() {
      this.stop();
      window.removeEventListener('resize', onResize);
      rig.dispose();
      pmrem.dispose();
      envTarget.dispose();
      renderer.dispose();
      canvasEl.remove();
    },
  };
}
