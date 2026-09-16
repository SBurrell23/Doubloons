// Settings live here, persisted to localStorage and broadcast to
// whoever cares (audio engine, renderer, HUD).

import { DEFAULT_GRAPHICS } from '../three/scene.js';

const KEY = 'doubloons.settings.v1';

export const DEFAULTS = {
  audio: {
    masterVolume: 0.8,
    sfxVolume: 0.8,
    musicVolume: 0.4,
    ambienceVolume: 0.5,
    muted: false,
    musicEnabled: true,
    ambienceEnabled: true,
  },
  graphics: { ...DEFAULT_GRAPHICS, showFps: false },
  gameplay: {
    tooltips: true,
    confirmPurchase: false,
    highlightAffordable: true,
    animationSpeed: 1,
    whiteGem: false,
    autoPassTokens: true,
    showLegalOnly: true,
  },
  profile: { name: '' },
};

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof base?.[key] === 'object') {
      out[key] = deepMerge(base[key], value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    return deepMerge(structuredClone(DEFAULTS), JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULTS);
  }
}

const state = load();
const listeners = new Set();

export function getSettings() { return state; }

/** Patch a section and notify. `patch` is { audio: {...} } shaped. */
export function updateSettings(patch) {
  const merged = deepMerge(state, patch);
  Object.assign(state, merged);
  persist();
  for (const fn of listeners) {
    try { fn(state, patch); } catch (error) { console.error('[settings]', error); }
  }
  return state;
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSection(section) {
  updateSettings({ [section]: structuredClone(DEFAULTS[section]) });
}

let persistTimer = 0;
function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  }, 180);
}

/** A sensible starting quality based on what the device looks like. */
export function detectQuality() {
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dpr = window.devicePixelRatio || 1;
  if (mobile || cores <= 4) {
    return { shadows: 'low', oceanDetail: 'medium', pixelRatioCap: Math.min(1.5, dpr), antialias: !mobile };
  }
  if (cores >= 8 && dpr <= 2) return { shadows: 'high', oceanDetail: 'high', pixelRatioCap: 2, antialias: true };
  return { shadows: 'high', oceanDetail: 'medium', pixelRatioCap: 2, antialias: true };
}

/** Applied once on first run so a weak device is not thrown in the deep end. */
export function applyAutoDetectOnce() {
  try {
    if (localStorage.getItem(`${KEY}.autodetected`)) return;
    updateSettings({ graphics: detectQuality() });
    localStorage.setItem(`${KEY}.autodetected`, '1');
  } catch { /* private mode: just use defaults */ }
}
