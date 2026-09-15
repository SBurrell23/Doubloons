// ============================================================
// The settings menu. Always reachable — cog button, Esc or S.
// Four tabs: Sound, Graphics, Gameplay, Controls.
// ============================================================

import { el, button, segmented, slider, toggle, field, clear, trapFocus } from './dom.js';
import { getSettings, updateSettings, resetSection, DEFAULTS } from './settings-store.js';
import { play, SFX_NAMES } from '../audio/sfx.js';
import { setTooltipsEnabled } from './tooltip.js';
import { icon } from './icons.js';

const TABS = [
  { id: 'sound', label: 'Sound', icon: 'horn' },
  { id: 'graphics', label: 'Graphics', icon: 'spyglass' },
  { id: 'gameplay', label: 'Gameplay', icon: 'cutlasses' },
  { id: 'controls', label: 'Controls', icon: 'wheel' },
];

let openInstance = null;

export function settingsOpen() { return !!openInstance; }

export function closeSettings() {
  if (!openInstance) return;
  openInstance.close();
}

/**
 * Open the settings overlay.
 * `hooks` lets the caller react live: { onGraphics, onAudio, onGameplay }.
 */
export function openSettings(hooks = {}, initialTab = 'sound') {
  if (openInstance) {
    openInstance.showTab(initialTab);
    return openInstance;
  }

  const settings = getSettings();
  let active = initialTab;

  const body = el('div.modal__body.scroll.settings__body');
  const tabBar = el('div.tabs', { role: 'tablist', 'aria-label': 'Settings sections' });
  const tabButtons = new Map();

  for (const tab of TABS) {
    const node = el('button.tab', {
      type: 'button',
      role: 'tab',
      id: `settings-tab-${tab.id}`,
      'aria-selected': String(tab.id === active),
      'aria-controls': 'settings-panel',
      onClick: () => { play('click'); showTab(tab.id); },
      onPointerEnter: () => play('hover'),
    }, icon(tab.icon, { size: '0.95rem' }), tab.label);
    tabButtons.set(tab.id, node);
    tabBar.append(node);
  }

  const modal = el('div.panel.panel--dark.modal.settings', { style: { '--modal-w': '620px' } },
    el('div.modal__head', {},
      el('div.grow', {},
        el('h2.panel__title', {}, 'Settings'),
        el('p.panel__sub', {}, 'Trim her to your liking. Everything here is remembered.'),
      ),
      button(icon('close', { size: '1rem' }), {
        class: 'btn--ghost btn-icon',
        'aria-label': 'Close settings',
        onClick: () => close(),
      }),
    ),
    tabBar,
    el('div', { id: 'settings-panel', role: 'tabpanel' }, body),
    el('div.modal__foot', {},
      button('Reset this tab', {
        class: 'btn--ghost btn--sm',
        onClick: () => {
          resetSection(active);
          applyAll();
          showTab(active);
        },
      }),
      button('Done', { class: 'btn--gold', onClick: () => close() }),
    ),
  );

  const overlay = el('div.overlay', {
    onPointerDown: (event) => { if (event.target === overlay) close(); },
  }, modal);

  const releaseFocus = trapFocus(modal);
  const onKey = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); close(); }
  };
  overlay.addEventListener('keydown', onKey);

  document.body.append(overlay);
  modal.querySelector('.tab')?.focus();

  function close() {
    play('click');
    releaseFocus();
    overlay.remove();
    openInstance = null;
    hooks.onClose?.();
  }

  function applyAll() {
    hooks.onAudio?.(settings.audio);
    hooks.onGraphics?.(settings.graphics);
    hooks.onGameplay?.(settings.gameplay);
    hooks.onControls?.(settings.controls);
  }

  function patch(section, values) {
    updateSettings({ [section]: values });
    if (section === 'audio') hooks.onAudio?.(settings.audio);
    if (section === 'graphics') hooks.onGraphics?.(settings.graphics);
    if (section === 'gameplay') hooks.onGameplay?.(settings.gameplay);
    if (section === 'controls') hooks.onControls?.(settings.controls);
  }

  function showTab(id) {
    active = id;
    for (const [tabId, node] of tabButtons) node.setAttribute('aria-selected', String(tabId === id));
    clear(body);
    body.append(RENDERERS[id](settings, patch));
    body.scrollTop = 0;
  }

  showTab(active);
  openInstance = { close, showTab };
  return openInstance;
}

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------

const pct = (v) => `${Math.round(v * 100)}%`;

function soundTab(settings, patch) {
  const audio = settings.audio;

  const master = slider({
    value: audio.masterVolume, min: 0, max: 1, step: 0.01, format: pct, label: 'Master volume',
    onInput: (v) => patch('audio', { masterVolume: v }),
  });
  const sfx = slider({
    value: audio.sfxVolume, min: 0, max: 1, step: 0.01, format: pct, label: 'Effects volume',
    onInput: (v) => { patch('audio', { sfxVolume: v }); },
  });
  const music = slider({
    value: audio.musicVolume, min: 0, max: 1, step: 0.01, format: pct, label: 'Music volume',
    onInput: (v) => patch('audio', { musicVolume: v }),
  });
  const ambience = slider({
    value: audio.ambienceVolume, min: 0, max: 1, step: 0.01, format: pct, label: 'Ambience volume',
    onInput: (v) => patch('audio', { ambienceVolume: v }),
  });

  return el('div.settings__tab', {},
    field('Mute everything',
      toggle({
        value: audio.muted,
        label: audio.muted ? 'Silent running' : 'Sound is on',
        tip: 'Cuts all audio without losing your levels.',
        onChange: (v) => {
          patch('audio', { muted: v });
          const label = document.querySelector('.settings__tab .toggle__label');
          if (label) label.textContent = v ? 'Silent running' : 'Sound is on';
        },
      }),
    ),
    field('Master volume', master),
    field('Sound effects', sfx,
      'Every effect in the game is generated by the browser — no audio files.'),
    el('div.row', {},
      button('Test a sound', {
        class: 'btn--sm btn--ghost',
        onClick: () => play(SFX_NAMES[Math.floor(Math.random() * SFX_NAMES.length)]),
      }),
      button('Coin', { class: 'btn--sm btn--ghost', onClick: () => play('coin') }),
      button('Fanfare', { class: 'btn--sm btn--ghost', onClick: () => play('lord') }),
    ),
    el('div', { style: { height: '0.9rem' } }),
    field('Background music',
      toggle({
        value: audio.musicEnabled,
        label: 'Play the shanty',
        onChange: (v) => patch('audio', { musicEnabled: v }),
      }),
    ),
    field('Music volume', music),
    field('Sea & gulls',
      toggle({
        value: audio.ambienceEnabled,
        label: 'Surf, wind and seabirds',
        onChange: (v) => patch('audio', { ambienceEnabled: v }),
      }),
    ),
    field('Ambience volume', ambience),
  );
}

function graphicsTab(settings, patch) {
  const g = settings.graphics;

  return el('div.settings__tab', {},
    field('Frame rate cap',
      segmented({
        value: g.fpsCap,
        name: 'Frame rate cap',
        options: [
          { value: 30, label: '30', tip: 'Easiest on a laptop battery.' },
          { value: 60, label: '60', tip: 'The usual choice.' },
          { value: 120, label: '120', tip: 'For a high refresh screen.' },
          { value: 0, label: 'Uncapped', tip: 'As fast as the browser will go.' },
        ],
        onChange: (v) => patch('graphics', { fpsCap: v }),
      }),
      'Lower caps run cooler and quieter.',
    ),

    field('Antialiasing',
      toggle({
        value: g.antialias,
        label: 'Smooth the edges',
        tip: 'Rebuilds the renderer, so the view blinks for a moment.',
        onChange: (v) => patch('graphics', { antialias: v }),
      }),
    ),

    field('Shadows',
      segmented({
        value: g.shadows,
        name: 'Shadow quality',
        options: [
          { value: 'off', label: 'Off' },
          { value: 'low', label: 'Hard' },
          { value: 'high', label: 'Soft' },
        ],
        onChange: (v) => patch('graphics', { shadows: v }),
      }),
    ),

    field('Resolution',
      segmented({
        value: g.pixelRatioCap,
        name: 'Resolution scale',
        options: [
          { value: 1, label: '1×', tip: 'Fastest. Softer on a retina screen.' },
          { value: 1.5, label: '1.5×' },
          { value: 2, label: '2×', tip: 'Sharpest.' },
        ],
        onChange: (v) => patch('graphics', { pixelRatioCap: v }),
      }),
      'Caps how many pixels are drawn on a high-density display.',
    ),

    field('Ocean detail',
      segmented({
        value: g.oceanDetail,
        name: 'Ocean detail',
        options: [
          { value: 'low', label: 'Calm' },
          { value: 'medium', label: 'Choppy' },
          { value: 'high', label: 'Rolling' },
        ],
        onChange: (v) => patch('graphics', { oceanDetail: v }),
      }),
    ),

    field('Field of view',
      slider({
        value: g.fov, min: 35, max: 70, step: 1, format: (v) => `${v}°`, label: 'Field of view',
        onInput: (v) => patch('graphics', { fov: v }),
      }),
    ),

    field('Island life',
      toggle({
        value: g.wildlife,
        label: 'Crabs on the sand',
        onChange: (v) => patch('graphics', { wildlife: v }),
      }),
    ),

    field('Treasure sparkle',
      toggle({
        value: g.sparkles,
        label: 'Glints off the hoard',
        onChange: (v) => patch('graphics', { sparkles: v }),
      }),
    ),

    field('Performance readout',
      toggle({
        value: g.showFps,
        label: 'Show FPS and draw calls',
        onChange: (v) => patch('graphics', { showFps: v }),
      }),
    ),
  );
}

function gameplayTab(settings, patch) {
  const p = settings.gameplay;

  return el('div.settings__tab', {},
    field('Tooltips',
      toggle({
        value: p.tooltips,
        label: 'Explain things on hover',
        onChange: (v) => { patch('gameplay', { tooltips: v }); setTooltipsEnabled(v); },
      }),
      'Turn this off once the rules are second nature.',
    ),

    field('Confirm purchases',
      toggle({
        value: p.confirmPurchase,
        label: 'Ask before buying a card',
        onChange: (v) => patch('gameplay', { confirmPurchase: v }),
      }),
    ),

    field('Highlight what you can afford',
      toggle({
        value: p.highlightAffordable,
        label: 'Mark buyable cards',
        onChange: (v) => patch('gameplay', { highlightAffordable: v }),
      }),
    ),

    field('Dim illegal moves',
      toggle({
        value: p.showLegalOnly,
        label: 'Grey out what you cannot do',
        onChange: (v) => patch('gameplay', { showLegalOnly: v }),
      }),
    ),

    field('Animation speed',
      segmented({
        value: p.animationSpeed,
        name: 'Animation speed',
        options: [
          { value: 0.6, label: 'Slow' },
          { value: 1, label: 'Normal' },
          { value: 1.8, label: 'Brisk' },
          { value: 0, label: 'Instant', tip: 'Skip card and token flights entirely.' },
        ],
        onChange: (v) => patch('gameplay', { animationSpeed: v }),
      }),
    ),

    field('Colour-blind labels',
      toggle({
        value: p.colourblindLabels,
        label: 'Letter each gem colour',
        tip: 'Adds Prl / Sph / Eme / Rby / Onx to gem chips.',
        onChange: (v) => patch('gameplay', { colourblindLabels: v }),
      }),
    ),
  );
}

const SHORTCUTS = [
  ['Drag', 'Slide the view across the island'],
  ['Right-drag', 'Swing the camera around'],
  ['Shift-drag', 'Swing the camera around'],
  ['Wheel / pinch', 'Move closer or further out'],
  ['W A S D', 'Slide the view'],
  ['Arrow keys', 'Slide the view'],
  ['Q  /  E', 'Swing left or right'],
  ['+  /  −', 'Zoom in or out'],
  ['Space', 'Back to the table'],
  ['1 – 5', 'Take a gem of that colour'],
  ['Enter', 'Confirm the gems you have picked'],
  ['Esc', 'Cancel a pick, or close a panel'],
  ['S', 'Open these settings'],
  ['H', 'How to play'],
  ['L', 'Show or hide the log'],
];

function controlsTab(settings, patch) {
  const c = settings.controls;

  const table = el('div.shortcuts');
  for (const [key, what] of SHORTCUTS) {
    table.append(el('div.shortcuts__row', {},
      el('kbd.shortcuts__key', {}, key),
      el('span.shortcuts__what', {}, what),
    ));
  }

  return el('div.settings__tab', {},
    field('Drag sensitivity',
      slider({
        value: c.dragSensitivity, min: 0.4, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×`,
        label: 'Drag sensitivity',
        onInput: (v) => patch('controls', { dragSensitivity: v }),
      }),
    ),
    field('Zoom sensitivity',
      slider({
        value: c.zoomSensitivity, min: 0.4, max: 2, step: 0.05, format: (v) => `${v.toFixed(2)}×`,
        label: 'Zoom sensitivity',
        onInput: (v) => patch('controls', { zoomSensitivity: v }),
      }),
    ),
    field('Invert drag',
      toggle({
        value: c.invertDrag,
        label: 'Reverse the camera drag direction',
        onChange: (v) => patch('controls', { invertDrag: v }),
      }),
    ),
    el('h3.settings__heading', {}, 'Camera & keys'),
    table,
  );
}

const RENDERERS = {
  sound: soundTab,
  graphics: graphicsTab,
  gameplay: gameplayTab,
  controls: controlsTab,
};
