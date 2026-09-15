// ============================================================
// Doubloons! — background music
//
// The one audio file in the project. Streamed through an
// <audio> element so playback starts quickly, then routed into
// the WebAudio graph so the settings sliders control it.
// ============================================================

import { initAudio, getContext, getMusicBus, audioSettings } from './sfx.js';

// Lives in public/, so it is served from the site root (or the repo
// sub-path on GitHub Pages) rather than being bundled.
const TRACK_URL = `${import.meta.env.BASE_URL}audio/pirates-dance.mp3`;

let element = null;
let sourceNode = null;
let wanted = true;

function ensureElement() {
  if (element) return element;
  element = new Audio();
  element.src = TRACK_URL;
  element.loop = true;
  element.preload = 'auto';
  element.crossOrigin = 'anonymous';
  element.volume = 1;
  return element;
}

/** Connect the element to the music bus so volume settings apply. */
function route() {
  const ctx = getContext();
  const bus = getMusicBus();
  if (!ctx || !bus || sourceNode || !element) return;
  try {
    sourceNode = ctx.createMediaElementSource(element);
    sourceNode.connect(bus);
  } catch {
    // Some browsers refuse a second source for the same element;
    // fall back to controlling element.volume directly.
    sourceNode = null;
  }
}

export function startMusic() {
  wanted = true;
  initAudio();
  ensureElement();
  route();
  syncVolume();
  const promise = element.play();
  if (promise && promise.catch) {
    // Autoplay was blocked — the next user gesture will retry.
    promise.catch(() => {});
  }
}

export function stopMusic() {
  wanted = false;
  if (element) element.pause();
}

export function musicWanted() { return wanted; }

export function isMusicPlaying() {
  return !!element && !element.paused;
}

/** Called whenever the audio settings change. */
export function syncVolume() {
  if (!element) return;
  if (!sourceNode) {
    // Unrouted fallback: fold the bus gains into the element volume.
    const level = audioSettings.muted ? 0 : audioSettings.masterVolume * audioSettings.musicVolume;
    element.volume = Math.max(0, Math.min(1, level));
  } else {
    element.volume = 1;
  }
}

/** Retry playback after a user gesture, if music is meant to be on. */
export function nudgeMusic() {
  if (!wanted) return;
  if (!element) { startMusic(); return; }
  if (element.paused) element.play().catch(() => {});
}

export function musicDuration() {
  return element?.duration || 0;
}
