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
import {
  HostSession, ClientSession, SoloSession, cleanName,
  loadHostSnapshot, forgetHostSnapshot,
} from './game/session.js';

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

  bootProgress(60, 'Burying the treasure…');
  await nextFrame();

  world.start();

  bootProgress(85, 'Setting the table…');
  await nextFrame();

  // Ease the camera in from a wide establishing shot.
  world.rig.moveTo({ dist: 56, pitch: 0.9, yaw: ISLAND_VIEW.yaw - 0.55, instant: true });
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

function applyGameplay(gameplay) {
  setTooltipsEnabled(gameplay.tooltips);
  document.body.classList.toggle('cb-labels', gameplay.colourblindLabels);
  hud?.refreshGameplaySettings();
}

onSettingsChange((all, patch) => {
  if (patch.graphics) applyGraphicsSettings(all.graphics);
  if (patch.audio) applyAudio(all.audio);
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
  heldForOthers = [];
  heldForSelf = false;
  refreshHeld();
  if (session) { session.leave(); session = null; }
  clear(uiMount);

  world?.rig.setEnabled(true);
  world?.rig.moveTo(ISLAND_VIEW);

  const params = new URLSearchParams(location.search);
  const joinCode = params.get('room') || params.get('r') || '';

  renderTitle(uiMount, {
    name: settings.profile.name,
    joinCodeFromUrl: joinCode.toUpperCase(),
    // A voyage this tab was hosting when it reloaded. The crew is still
    // out there holding the same room code.
    resumable: loadHostSnapshot(),
    onNameChange: (value) => updateSettings({ profile: { name: value } }),
    onSolo: () => startSolo(),
    onHost: (status) => hostGame(status),
    onJoin: (code, status) => joinGame(code, status),
    onResume: (status) => resumeHosting(status),
    onDiscardResume: () => { forgetHostSnapshot(); showTitle(); },
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

async function resumeHosting(status) {
  unlockAudio();
  const snap = loadHostSnapshot();
  if (!snap) { showTitle(); return; }
  status.classList.remove('is-bad');
  status.textContent = 'Reclaiming the room…';
  try {
    session = await HostSession.resume(snap);
    wireSession();
    if (session.phase === 'playing' && session.view) showTable();
    else showLobby();
  } catch (error) {
    console.error(error);
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
  heldForOthers = [];
  heldForSelf = false;
  refreshHeld();
  teardownGame();
  clear(uiMount);

  world?.rig.setEnabled(true);
  world?.rig.moveTo({ ...ISLAND_VIEW, dist: 26 });

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

  session.on('paused', (waiting, until) => {
    heldForOthers = waiting || [];
    graceUntil = until || 0;
    refreshHeld();
  });

  session.on('status', (status) => {
    // 'reconnecting' is only the signalling socket blinking, which the
    // game does not care about; 'rejoining' means our channel is gone.
    if (status === 'rejoining') { heldForSelf = true; refreshHeld(); }
    else if (status === 'connected') { heldForSelf = false; refreshHeld(); }
  });

  // The host's own line to the matchmaker. The game carries on without
  // it, but nobody can rejoin until it is back, which is worth saying.
  session.on('netStatus', (status) => {
    if (status === 'offline' || status === 'closed') {
      hud?.toast('Trouble reaching the matchmaking server — the game is fine, but nobody can rejoin until it is back.', 'bad');
    } else if (status === 'online') {
      hud?.toast('Back in touch with the matchmaking server.', 'good');
    }
  });

  session.on('lost', (reason) => {
    play('deny');
    // We have stopped looking, so the "finding the table" panel has to
    // go or it sits behind this one still claiming to be trying.
    heldForSelf = false;
    heldForOthers = [];
    refreshHeld();
    showDisconnected(reason);
  });

  session.on('error', (error) => {
    console.error('[net]', error);
  });
}

/*
 * The table is held while somebody is adrift. Nothing is played for
 * them -- they keep their seat until they reconnect, or until the host
 * decides the voyage cannot wait any longer.
 */
let heldOverlay = null;
let heldForOthers = [];
let heldForSelf = false;
let graceUntil = 0;
let graceTicker = 0;

function refreshHeld() {
  // Our own line parting takes precedence: there is nothing useful to
  // say about the rest of the table while we cannot see it.
  const self = heldForSelf;
  const waiting = self ? [] : heldForOthers;
  if (!self && !waiting.length) {
    clearInterval(graceTicker);
    graceTicker = 0;
    heldOverlay?.remove();
    heldOverlay = null;
    return;
  }
  if (screen !== 'table') return;
  heldOverlay?.remove();

  const countdown = el('p.panel__sub.held__clock');
  const canCover = !self && session?.isHost && typeof session.coverForAdrift === 'function';

  heldOverlay = el('div.overlay', {},
    el('div.panel.modal', { style: { '--modal-w': '460px' } },
      el('h2.panel__title', {}, self ? 'Finding the table' : 'The voyage is held'),
      el('p.panel__sub', {}, self
        ? 'Your line to the host parted. Trying to pick it back up — your seat and cards are waiting.'
        : `Waiting for ${waiting.join(' and ')} to come back aboard. Nobody is playing their hand.`),
      session?.code && !self
        ? el('p.panel__sub', {}, 'They can rejoin with the same code: ', el('b', {}, session.code))
        : null,
      self ? null : countdown,
      canCover
        ? el('div.modal__foot', {},
          button('Sail without them', {
            class: 'btn--ghost',
            onClick: () => { session.coverForAdrift(); },
          }),
        )
        : null,
    ),
  );
  document.body.append(heldOverlay);

  // Nobody waits in silence: say how long the table will hold.
  clearInterval(graceTicker);
  graceTicker = 0;
  if (!self && graceUntil) {
    const tick = () => {
      const left = Math.max(0, Math.ceil((graceUntil - Date.now()) / 1000));
      countdown.textContent = left
        ? `The crew takes over in ${left}s if they are not back.`
        : 'Sailing on without them…';
    };
    tick();
    graceTicker = setInterval(tick, 500);
  }
}

let adriftOverlay = null;
function showDisconnected(reason) {
  // A drop and a kick can both land; one panel is enough.
  adriftOverlay?.remove();
  const dropped = session;
  const canRetry = dropped && !dropped.isHost && typeof dropped.retry === 'function' && dropped.code;
  const status = el('p.panel__sub');

  const overlay = adriftOverlay = el('div.overlay', {},
    el('div.panel.modal', { style: { '--modal-w': '440px' } },
      el('h2.panel__title', {}, 'Cast adrift'),
      el('p.panel__sub', {}, reason),
      canRetry
        ? el('p.panel__sub', {}, 'Your seat is held as long as the table is still sailing. ',
          el('b', {}, dropped.code), ' will take you back to it.')
        : null,
      status,
      el('div.modal__foot', {},
        button('Back to the docks', {
          class: 'btn--ghost',
          onClick: () => { overlay.remove(); adriftOverlay = null; showTitle(); },
        }),
        canRetry
          ? button('Try the room again', {
            class: 'btn--gold',
            onClick: async (event) => {
              const btn = event.currentTarget;
              btn.disabled = true;
              status.classList.remove('is-bad');
              status.textContent = 'Rowing back over…';
              try {
                await dropped.retry();
                overlay.remove();
                adriftOverlay = null;
                status.textContent = '';
              } catch (error) {
                btn.disabled = false;
                status.classList.add('is-bad');
                status.textContent = describeNetError(error);
                play('deny');
              }
            },
          })
          : null,
      ),
    ),
  );
  document.body.append(overlay);
}

// ------------------------------------------------------------
// Global keys
// ------------------------------------------------------------

// W, A, S and D belong to the camera, so no panel is bound to a letter
// the camera uses. Settings live on Escape instead.
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

  if (event.key === 'Escape') {
    if (settingsOpen()) { closeSettings(); return; }
    if (howToPlayOpen()) { closeHowToPlay(); return; }
    // Let the table back out of whatever it is in the middle of first;
    // only open settings when there is nothing else to dismiss.
    if (hud?.consumeEscape()) return;
    showSettings();
    return;
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

/*
 * A closing tab and a refresh look exactly the same from here, so treat
 * every one as a refresh: let go of the connection but keep the claim
 * on the seat -- or, for a host, the saved voyage. Somebody who really
 * has gone is covered by the host's grace clock instead.
 */
window.addEventListener('pagehide', (event) => {
  // A page put in the back/forward cache is coming back with everything
  // still wired up; the liveness clock picks the channel up again by
  // itself, so there is nothing to tear down here.
  if (event.persisted) return;
  if (typeof session?.detach === 'function') session.detach();
  else session?.leave();
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
