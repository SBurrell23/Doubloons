// ============================================================
// Doubloons! — application entry point.
//
// Owns the screen flow (title → lobby → table), the 3D world,
// and the wiring between session events and the HUD.
// ============================================================

import './ui/styles/base.css';
import './ui/styles/screens.css';
import './ui/styles/game.css';

import { createWorld, TABLE_VIEW, ISLAND_VIEW } from './three/scene.js';
import { createBoard } from './three/board.js';
import { createHud } from './ui/hud.js';
import { renderTitle, renderLobby } from './ui/lobby.js';
import { openSettings, closeSettings, settingsOpen } from './ui/settings.js';
import { openHowToPlay, closeHowToPlay, howToPlayOpen } from './ui/howtoplay.js';
import { installTooltips, setTooltipsEnabled } from './ui/tooltip.js';
import { getSettings, updateSettings, onSettingsChange, applyAutoDetectOnce } from './ui/settings-store.js';
import { el, clear, button } from './ui/dom.js';
import { icon } from './ui/icons.js';
import { installCursor } from './ui/cursor.js';
import {
  initAudio, resumeAudio, applyAudioSettings, play,
  startAmbience, stopAmbience, ambienceRunning,
} from './audio/sfx.js';
import { startMusic, stopMusic, nudgeMusic, syncVolume } from './audio/music.js';
import { HostSession, ClientSession, SoloSession, cleanName } from './game/session.js';

const sceneMount = document.getElementById('scene');
const uiMount = document.getElementById('ui');
const settings = getSettings();

let world = null;
let boardView = null;
let hud = null;
let session = null;
let lobbyUi = null;
let screen = 'boot';
let perfNode = null;
let perfTimer = 0;

// ------------------------------------------------------------
// Boot
// ------------------------------------------------------------

const boot = el('div.boot', {},
  el('div.boot__inner', {},
    el('div.boot__crest', {}, icon('skull', { size: '3rem' })),
    el('h1.boot__logo', {}, 'Doubloons'),
    el('div.boot__bar', {}, el('div.boot__fill')),
    el('p.boot__msg', {}, 'Hoisting the mainsail…'),
  ),
);
document.body.append(boot);

function bootProgress(pct, message) {
  boot.querySelector('.boot__fill').style.width = `${pct}%`;
  if (message) boot.querySelector('.boot__msg').textContent = message;
}

async function start() {
  applyAutoDetectOnce();
  installCursor();
  installTooltips();
  setTooltipsEnabled(settings.gameplay.tooltips);
  document.body.classList.toggle('cb-labels', settings.gameplay.colourblindLabels);

  // The card and tile textures are painted with Canvas2D, so the display
  // face has to be loaded first or they bake with the fallback serif.
  bootProgress(8, 'Unrolling the charts…');
  try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch { /* no font API */ }

  bootProgress(18, 'Charting the island…');
  await nextFrame();

  world = createWorld(sceneMount, settings.graphics);
  applyControlSettings(settings.controls);

  bootProgress(60, 'Burying the treasure…');
  await nextFrame();

  world.start();

  bootProgress(85, 'Setting the table…');
  await nextFrame();

  // Ease the camera in from a wide establishing shot.
  world.rig.moveTo({ dist: 74, pitch: 0.95, yaw: ISLAND_VIEW.yaw - 0.6, instant: true });
  world.rig.moveTo(ISLAND_VIEW);

  applyGraphicsSettings(settings.graphics);
  showTitle();

  bootProgress(100, 'Weigh anchor!');
  setTimeout(() => {
    boot.classList.add('is-done');
    setTimeout(() => boot.remove(), 600);
  }, 300);
}

/**
 * Yield so the boot bar can paint. A hidden tab never fires
 * requestAnimationFrame, so fall back to a timer — otherwise opening
 * the game in a background tab would hang on the loading screen.
 */
const nextFrame = () => new Promise((resolve) => {
  let settled = false;
  const finish = () => { if (!settled) { settled = true; resolve(); } };
  requestAnimationFrame(() => setTimeout(finish, 0));
  setTimeout(finish, 150);
});

// ------------------------------------------------------------
// Audio needs a gesture before it can make a sound
// ------------------------------------------------------------

let audioReady = false;
function unlockAudio() {
  if (audioReady) return;
  audioReady = true;
  initAudio();
  applyAudioSettings(settings.audio);
  if (settings.audio.ambienceEnabled && !settings.audio.muted) startAmbience();
  if (settings.audio.musicEnabled && !settings.audio.muted) startMusic();
  syncVolume();
}

for (const event of ['pointerdown', 'keydown', 'touchstart']) {
  window.addEventListener(event, () => { unlockAudio(); resumeAudio(); nudgeMusic(); }, { once: false, passive: true });
}

// ------------------------------------------------------------
// Settings plumbing
// ------------------------------------------------------------

function applyGraphicsSettings(graphics) {
  world?.applyGraphics(graphics);
  togglePerf(graphics.showFps);
}

function applyAudio(audio) {
  applyAudioSettings(audio);
  syncVolume();
  if (audio.muted || !audio.musicEnabled) stopMusic();
  else if (audioReady) startMusic();

  if (audio.muted || !audio.ambienceEnabled) stopAmbience();
  else if (audioReady && !ambienceRunning()) startAmbience();
}

function applyControlSettings(controls) {
  world?.rig.setControls(controls);
}

function applyGameplay(gameplay) {
  setTooltipsEnabled(gameplay.tooltips);
  document.body.classList.toggle('cb-labels', gameplay.colourblindLabels);
  hud?.refreshGameplaySettings();
}

onSettingsChange((all, patch) => {
  if (patch.graphics) applyGraphicsSettings(all.graphics);
  if (patch.audio) applyAudio(all.audio);
  if (patch.controls) applyControlSettings(all.controls);
  if (patch.gameplay) applyGameplay(all.gameplay);
});

function togglePerf(on) {
  if (on && !perfNode) {
    perfNode = el('div.perf');
    document.body.append(perfNode);
    perfTimer = setInterval(() => {
      if (!world) return;
      const s = world.stats;
      perfNode.textContent =
        `${String(s.fps).padStart(3)} fps\n` +
        `${s.drawCalls} draws\n` +
        `${(s.triangles / 1000).toFixed(0)}k tris`;
    }, 250);
  } else if (!on && perfNode) {
    clearInterval(perfTimer);
    perfNode.remove();
    perfNode = null;
  }
}

const settingsHooks = {
  onGraphics: applyGraphicsSettings,
  onAudio: applyAudio,
  onGameplay: applyGameplay,
  onControls: applyControlSettings,
};

function showSettings(tab = 'sound') {
  unlockAudio();
  openSettings(settingsHooks, tab);
}

// ------------------------------------------------------------
// Screens
// ------------------------------------------------------------

function teardownGame() {
  hud?.destroy();
  hud = null;
  boardView?.dispose();
  boardView = null;
}

function showTitle() {
  screen = 'title';
  teardownGame();
  if (session) { session.leave(); session = null; }
  clear(uiMount);

  world?.rig.setEnabled(true);
  world?.rig.moveTo(ISLAND_VIEW);

  const params = new URLSearchParams(location.search);
  const joinCode = params.get('room') || params.get('r') || '';

  renderTitle(uiMount, {
    name: settings.profile.name,
    joinCodeFromUrl: joinCode.toUpperCase(),
    onNameChange: (value) => updateSettings({ profile: { name: value } }),
    onSolo: () => startSolo(),
    onHost: (status) => hostGame(status),
    onJoin: (code, status) => joinGame(code, status),
    onHowTo: () => openHowToPlay(),
    onSettings: () => showSettings(),
  });
}

function myName() {
  return cleanName(settings.profile.name, 'Captain');
}

async function startSolo() {
  unlockAudio();
  session = new SoloSession({ name: myName() });
  await session.open();
  session.addAI('sly');
  wireSession();
  showLobby();
}

async function hostGame(status) {
  unlockAudio();
  status.classList.remove('is-bad');
  status.textContent = 'Claiming a room code…';
  try {
    session = new HostSession({ name: myName() });
    await session.open();
    wireSession();
    showLobby();
  } catch (error) {
    console.error(error);
    session = null;
    status.classList.add('is-bad');
    status.textContent = describeNetError(error);
    play('deny');
  }
}

async function joinGame(code, status) {
  unlockAudio();
  try {
    session = new ClientSession({ name: myName() });
    await session.join(code);
    wireSession();
    showLobby();
  } catch (error) {
    console.error(error);
    session?.leave();
    session = null;
    status.classList.add('is-bad');
    status.textContent = describeNetError(error);
    play('deny');
  }
}

function describeNetError(error) {
  const message = String(error?.message || error?.type || error || '');
  if (/peer-unavailable|No room/i.test(message)) return 'No room with that code is open right now.';
  if (/browser|WebRTC/i.test(message)) return 'This browser cannot do peer-to-peer. Try Chrome, Edge or Firefox.';
  if (/network|server|Timed out/i.test(message)) return 'Could not reach the matchmaking server. Check your connection.';
  if (/full/i.test(message)) return 'That table is full.';
  return message || 'Something went wrong. Try again.';
}

function showLobby() {
  screen = 'lobby';
  teardownGame();
  clear(uiMount);

  world?.rig.setEnabled(true);
  world?.rig.moveTo({ ...ISLAND_VIEW, dist: 32 });

  lobbyUi = renderLobby(uiMount, session, {
    onStart: () => session.start(),
    onLeave: () => { play('leave'); showTitle(); },
    onSettings: () => showSettings(),
    onHowTo: () => openHowToPlay(),
    onCopyLink: (btn) => copyInvite(btn),
  });
}

async function copyInvite(btn) {
  const url = new URL(location.href);
  url.searchParams.set('room', session.code);
  url.hash = '';
  const link = url.toString();
  const original = btn.textContent;
  try {
    await navigator.clipboard.writeText(link);
    btn.textContent = 'Copied!';
  } catch {
    // Clipboard blocked (insecure context or permissions) — show it instead.
    window.prompt('Copy this link and send it to your crew:', link);
    btn.textContent = 'Link shown';
  }
  setTimeout(() => { btn.textContent = original; }, 1800);
}

function showTable() {
  screen = 'table';
  clear(uiMount);

  world.rig.setEnabled(true);
  world.rig.moveTo(TABLE_VIEW);

  // The board and the HUD are mutually dependent, so the board gets
  // lazy references and the HUD is built immediately after.
  boardView = createBoard(world, {
    onPick: (...args) => hud?.hooks.onBoardPick(...args),
    onHover: (...args) => hud?.hooks.onBoardHover(...args),
  });

  hud = createHud(uiMount, {
    session,
    world,
    board: boardView,
    settings,
    onLeave: () => confirmLeave(),
    onSettings: () => showSettings(),
    onHowTo: () => openHowToPlay(),
    onRematch: () => session.rematch(),
  });

  hud.setView(session.view, { reset: true });
  hud.setDeadline(session.deadline);
}

function confirmLeave() {
  const overlay = el('div.overlay', {},
    el('div.panel.modal', { style: { '--modal-w': '440px' } },
      el('h2.panel__title', {}, 'Abandon ship?'),
      el('p.panel__sub', {}, session.isHost && !session.solo
        ? 'You are hosting — leaving ends the game for everyone at the table.'
        : 'You can always start another voyage.'),
      el('div.modal__foot', {},
        button('Stay', { class: 'btn--ghost', onClick: () => overlay.remove() }),
        button('Leave', { class: 'btn--danger', onClick: () => { overlay.remove(); play('leave'); showTitle(); } }),
      ),
    ),
  );
  document.body.append(overlay);
}

// ------------------------------------------------------------
// Session events
// ------------------------------------------------------------

function wireSession() {
  session.on('lobby', (lobby) => {
    if (lobby.phase === 'lobby' && screen === 'table') {
      showLobby();
      return;
    }
    if (screen === 'lobby') lobbyUi?.update(lobby);
  });

  session.on('chat', (entry) => {
    if (screen === 'lobby') lobbyUi?.appendChat(entry);
  });

  session.on('state', (view, meta) => {
    if (screen !== 'table') showTable();
    hud?.setView(view, meta);
  });

  session.on('deadline', (value) => hud?.setDeadline(value));

  session.on('reject', (reason) => {
    play('deny');
    hud?.toast(reason, 'bad');
  });

  session.on('toast', ({ text, kind, sound }) => {
    if (sound) play(sound);
    hud?.toast(text, kind);
  });

  session.on('lost', (reason) => {
    play('deny');
    showDisconnected(reason);
  });

  session.on('error', (error) => {
    console.error('[net]', error);
  });
}

function showDisconnected(reason) {
  const overlay = el('div.overlay', {},
    el('div.panel.modal', { style: { '--modal-w': '440px' } },
      el('h2.panel__title', {}, 'Cast adrift'),
      el('p.panel__sub', {}, reason),
      el('div.modal__foot', {},
        button('Back to the docks', {
          class: 'btn--gold',
          onClick: () => { overlay.remove(); showTitle(); },
        }),
      ),
    ),
  );
  document.body.append(overlay);
}

// ------------------------------------------------------------
// Global keys
// ------------------------------------------------------------

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.key === 'Escape') {
    if (settingsOpen()) { closeSettings(); return; }
    if (howToPlayOpen()) { closeHowToPlay(); return; }
    return;
  }
  if (event.key === 's' || event.key === 'S') {
    if (settingsOpen()) closeSettings(); else showSettings();
  }
  if (event.key === 'h' || event.key === 'H') {
    if (howToPlayOpen()) closeHowToPlay(); else openHowToPlay();
  }
});

// Pause the renderer when the tab is hidden, so a backgrounded game
// stops eating battery.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) world?.stop();
  else world?.start();
});

window.addEventListener('beforeunload', () => {
  session?.leave();
});

// A handle for poking at the running game from the console.
if (import.meta.env.DEV) {
  window.__doubloons = {
    get world() { return world; },
    get board() { return boardView; },
    get hud() { return hud; },
    get session() { return session; },
    get screen() { return screen; },
    settings,
    startSolo, showTitle, showLobby,
  };
}

start().catch((error) => {
  console.error(error);
  boot.querySelector('.boot__msg').textContent = 'Something went wrong starting the game. Check the console.';
});
