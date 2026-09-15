// ============================================================
// Doubloons! — sound
//
// Every effect is synthesised at runtime with WebAudio. Nothing
// here loads a file; the only audio asset in the game is the
// background music track.
// ============================================================

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let ambienceBus = null;
let ambienceNodes = null;
let gullTimer = null;

export const audioSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  musicVolume: 0.45,
  ambienceVolume: 0.5,
  muted: false,
};

/** Lazily create the audio graph. Must be called from a user gesture. */
export function initAudio() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();

  master = ctx.createGain();
  master.gain.value = audioSettings.muted ? 0 : audioSettings.masterVolume;
  master.connect(ctx.destination);

  sfxBus = ctx.createGain();
  sfxBus.gain.value = audioSettings.sfxVolume;
  sfxBus.connect(master);

  musicBus = ctx.createGain();
  musicBus.gain.value = audioSettings.musicVolume;
  musicBus.connect(master);

  ambienceBus = ctx.createGain();
  ambienceBus.gain.value = audioSettings.ambienceVolume;
  ambienceBus.connect(master);

  return ctx;
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

export function getContext() { return ctx; }
export function getMusicBus() { return musicBus; }

export function applyAudioSettings(partial = {}) {
  Object.assign(audioSettings, partial);
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(audioSettings.muted ? 0 : audioSettings.masterVolume, t, 0.02);
  sfxBus.gain.setTargetAtTime(audioSettings.sfxVolume, t, 0.02);
  musicBus.gain.setTargetAtTime(audioSettings.musicVolume, t, 0.05);
  ambienceBus.gain.setTargetAtTime(audioSettings.ambienceVolume, t, 0.05);
}

// ------------------------------------------------------------
// Synth primitives
// ------------------------------------------------------------

function noiseBuffer(seconds = 1) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** One enveloped oscillator. */
function tone({ freq, type = 'sine', start = 0, dur = 0.2, gain = 0.3, attack = 0.005, glideTo = null, bus = sfxBus, detune = 0 }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(env).connect(bus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return osc;
}

/** Filtered noise burst — used for whooshes, splashes and impacts. */
function noise({ start = 0, dur = 0.2, gain = 0.2, type = 'bandpass', freq = 1200, q = 1, sweepTo = null, bus = sfxBus }) {
  const t0 = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(Math.max(0.15, dur));

  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + dur);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(env).connect(bus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

const SEMITONE = 2 ** (1 / 12);
const note = (semitonesFromA4) => 440 * SEMITONE ** semitonesFromA4;

// ------------------------------------------------------------
// The effects
// ------------------------------------------------------------

const EFFECTS = {
  /** A gem token dropping onto the table. */
  token() {
    const base = 520 + Math.random() * 180;
    tone({ freq: base, type: 'triangle', dur: 0.13, gain: 0.16, glideTo: base * 0.7 });
    tone({ freq: base * 2.02, type: 'sine', dur: 0.09, gain: 0.07, start: 0.005 });
    noise({ dur: 0.05, gain: 0.05, freq: 3400, q: 2 });
  },

  /** Gold doubloon — brighter and more metallic than a gem. */
  coin() {
    const base = 880 + Math.random() * 120;
    tone({ freq: base, type: 'triangle', dur: 0.22, gain: 0.15 });
    tone({ freq: base * 1.5, type: 'sine', dur: 0.26, gain: 0.09, start: 0.01 });
    tone({ freq: base * 2.67, type: 'sine', dur: 0.18, gain: 0.05, start: 0.02 });
    noise({ dur: 0.06, gain: 0.04, freq: 5200, q: 3 });
  },

  /** Card sliding across wood. */
  cardSlide() {
    noise({ dur: 0.22, gain: 0.1, type: 'bandpass', freq: 900, q: 0.7, sweepTo: 2600 });
  },

  /** Card flipping face up. */
  cardFlip() {
    noise({ dur: 0.1, gain: 0.13, type: 'bandpass', freq: 1800, q: 0.8, sweepTo: 700 });
    tone({ freq: 240, type: 'sine', dur: 0.06, gain: 0.05, start: 0.06 });
  },

  /** A card bought — coins paid, then a small triumphant flourish. */
  purchase() {
    noise({ dur: 0.18, gain: 0.08, freq: 1400, q: 0.6, sweepTo: 3000 });
    [0, 4, 7].forEach((step, i) => {
      tone({ freq: note(step - 5), type: 'triangle', start: 0.04 + i * 0.055, dur: 0.24, gain: 0.13 });
    });
  },

  /** Stowing a card in your hold. */
  reserve() {
    noise({ dur: 0.26, gain: 0.1, type: 'bandpass', freq: 700, q: 0.6, sweepTo: 1900 });
    tone({ freq: 180, type: 'sine', dur: 0.12, gain: 0.07, start: 0.12, glideTo: 120 });
  },

  /** A Pirate Lord joins your crew. Short brass-ish fanfare. */
  lord() {
    const seq = [0, 4, 7, 12];
    seq.forEach((step, i) => {
      tone({ freq: note(step - 9), type: 'sawtooth', start: i * 0.1, dur: 0.34, gain: 0.075 });
      tone({ freq: note(step - 9) * 1.005, type: 'sawtooth', start: i * 0.1, dur: 0.34, gain: 0.055 });
    });
    tone({ freq: note(-21), type: 'sine', start: 0, dur: 0.8, gain: 0.1 });
  },

  /** Your turn begins — a ship's bell. */
  turn() {
    tone({ freq: 1180, type: 'sine', dur: 0.9, gain: 0.12 });
    tone({ freq: 1770, type: 'sine', dur: 0.6, gain: 0.05, start: 0.005 });
    tone({ freq: 2380, type: 'sine', dur: 0.35, gain: 0.025, start: 0.01 });
  },

  /** Clock running down. */
  tick() {
    tone({ freq: 1500, type: 'square', dur: 0.03, gain: 0.05 });
  },

  /** Last few seconds of the turn timer. */
  tickUrgent() {
    tone({ freq: 1900, type: 'square', dur: 0.05, gain: 0.1 });
  },

  /** Illegal move — a dull thud on the table. */
  deny() {
    tone({ freq: 150, type: 'sawtooth', dur: 0.18, gain: 0.12, glideTo: 80 });
    noise({ dur: 0.1, gain: 0.06, type: 'lowpass', freq: 400 });
  },

  /** UI button. */
  click() {
    tone({ freq: 420, type: 'square', dur: 0.045, gain: 0.07, glideTo: 300 });
    noise({ dur: 0.03, gain: 0.03, freq: 2200, q: 1.5 });
  },

  hover() {
    tone({ freq: 700, type: 'sine', dur: 0.04, gain: 0.025 });
  },

  /** Somebody joins the table. */
  join() {
    [0, 5, 9].forEach((step, i) => tone({ freq: note(step - 7), type: 'triangle', start: i * 0.07, dur: 0.2, gain: 0.1 }));
  },

  leave() {
    [9, 5, 0].forEach((step, i) => tone({ freq: note(step - 7), type: 'triangle', start: i * 0.07, dur: 0.2, gain: 0.09 }));
  },

  /** Victory — a proper little sea shanty cadence. */
  victory() {
    const melody = [0, 0, 4, 7, 12, 7, 12, 16];
    melody.forEach((step, i) => {
      const start = i * 0.16;
      tone({ freq: note(step - 9), type: 'sawtooth', start, dur: 0.3, gain: 0.07 });
      tone({ freq: note(step - 9) / 2, type: 'triangle', start, dur: 0.3, gain: 0.06 });
    });
    tone({ freq: note(-21), type: 'sine', start: 0, dur: 1.6, gain: 0.09 });
    noise({ start: 1.1, dur: 0.7, gain: 0.05, type: 'bandpass', freq: 800, q: 0.5, sweepTo: 3000 });
  },

  defeat() {
    [4, 2, 0, -3].forEach((step, i) => {
      tone({ freq: note(step - 9), type: 'triangle', start: i * 0.2, dur: 0.45, gain: 0.08 });
    });
  },

  /** Digging in the sand — used for the chest on the title screen. */
  dig() {
    noise({ dur: 0.3, gain: 0.12, type: 'bandpass', freq: 500, q: 0.5, sweepTo: 180 });
  },

  /** A gull, somewhere overhead. */
  gull() {
    const base = 900 + Math.random() * 400;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const start = i * (0.13 + Math.random() * 0.06);
      tone({ freq: base, type: 'sawtooth', start, dur: 0.14, gain: 0.035, glideTo: base * 1.6, bus: ambienceBus });
      tone({ freq: base * 1.01, type: 'sawtooth', start, dur: 0.14, gain: 0.02, glideTo: base * 1.55, bus: ambienceBus });
    }
  },

  /** A small wave breaking. */
  wave() {
    noise({ dur: 1.6, gain: 0.05, type: 'lowpass', freq: 900, sweepTo: 200, bus: ambienceBus });
  },
};

/** Play a named effect. Safe to call before audio is initialised. */
export function play(name) {
  if (!ctx || audioSettings.muted) return;
  const effect = EFFECTS[name];
  if (!effect) return;
  try { effect(); } catch { /* an overloaded audio graph should never break the game */ }
}

export const SFX_NAMES = Object.keys(EFFECTS);

// ------------------------------------------------------------
// Ambience: surf, wind and the occasional gull
// ------------------------------------------------------------

export function startAmbience() {
  if (!ctx || ambienceNodes) return;

  // Surf: brown-ish noise through a slow, swelling lowpass.
  const surf = ctx.createBufferSource();
  surf.buffer = noiseBuffer(4);
  surf.loop = true;

  const surfFilter = ctx.createBiquadFilter();
  surfFilter.type = 'lowpass';
  surfFilter.frequency.value = 420;
  surfFilter.Q.value = 0.4;

  const surfGain = ctx.createGain();
  surfGain.gain.value = 0.12;

  // Slow swell so the surf breathes rather than hisses.
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.11;
  const swellDepth = ctx.createGain();
  swellDepth.gain.value = 260;
  swell.connect(swellDepth).connect(surfFilter.frequency);

  // Wind: a thin band, panned gently.
  const wind = ctx.createBufferSource();
  wind.buffer = noiseBuffer(4);
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 620;
  windFilter.Q.value = 0.8;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.03;

  surf.connect(surfFilter).connect(surfGain).connect(ambienceBus);
  wind.connect(windFilter).connect(windGain).connect(ambienceBus);
  surf.start();
  wind.start();
  swell.start();

  ambienceNodes = { surf, wind, swell, surfGain, windGain };

  const scheduleGull = () => {
    gullTimer = setTimeout(() => {
      if (!audioSettings.muted) play('gull');
      scheduleGull();
    }, 9000 + Math.random() * 22000);
  };
  scheduleGull();
}

export function stopAmbience() {
  if (gullTimer) { clearTimeout(gullTimer); gullTimer = null; }
  if (!ambienceNodes) return;
  try {
    ambienceNodes.surf.stop();
    ambienceNodes.wind.stop();
    ambienceNodes.swell.stop();
  } catch { /* already stopped */ }
  ambienceNodes = null;
}

export function ambienceRunning() { return !!ambienceNodes; }
