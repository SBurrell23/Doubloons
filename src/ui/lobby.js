// ============================================================
// Title screen and lobby.
// ============================================================

import { el, button, clear, segmented, toggle, field, slider, append } from './dom.js';
import { play } from '../audio/sfx.js';
import { AI_LEVELS } from '../game/ai.js';
import { MAX_SEATS, MIN_SEATS, seatDecor } from '../game/session.js';
import { normaliseCode } from '../net/net.js';
import { icon, seatEmblem } from './icons.js';

// ------------------------------------------------------------
// Title
// ------------------------------------------------------------

export function renderTitle(mount, {
  name, onNameChange, onSolo, onHost, onJoin, onHowTo, onSettings, joinCodeFromUrl,
}) {
  clear(mount);

  const nameInput = el('input.input.title__name', {
    type: 'text',
    value: name || '',
    maxlength: '18',
    placeholder: 'Your captain name',
    'aria-label': 'Your captain name',
    onInput: (e) => onNameChange(e.target.value),
  });

  const codeInput = el('input.input.title__code', {
    type: 'text',
    value: joinCodeFromUrl || '',
    maxlength: '6',
    placeholder: 'CODE',
    'aria-label': 'Room code',
    autocapitalize: 'characters',
    spellcheck: 'false',
    onInput: (e) => { e.target.value = normaliseCode(e.target.value); },
    onKeyDown: (e) => { if (e.key === 'Enter') joinNow(); },
  });

  const status = el('p.title__status', { role: 'status' });

  function joinNow() {
    const code = normaliseCode(codeInput.value);
    if (code.length < 4) {
      status.textContent = 'A room code is four characters.';
      status.classList.add('is-bad');
      play('deny');
      return;
    }
    status.classList.remove('is-bad');
    status.textContent = 'Rowing over…';
    onJoin(code, status);
  }

  const screen = el('div.screen.screen--title', {},
    el('div.title__plate', {},
      el('div.title__crest', {}, icon('skull', { size: '2.6rem' })),
      el('h1.title__logo', {}, 'Doubloons'),
      el('div.title__hairline'),
      el('p.title__tag', {}, 'Gems, galleons and a reputation worth hanging for.'),

      el('div.title__name-row', {},
        el('label.title__name-label', { for: nameInput.id = 'captain-name' }, 'Captain'),
        nameInput,
      ),

      el('div.title__actions', {},
        button([icon('cutlasses'), 'Play the Crew'], {
          class: 'btn--gold btn--lg btn--block',
          tip: 'A quick game against computer captains. No connection needed.',
          onClick: () => onSolo(),
        }),
        el('div.title__split', {},
          button([icon('flag'), 'Host a Table'], {
            class: 'btn--block',
            tip: 'Start a room and share the code with your friends.',
            onClick: () => onHost(status),
          }),
          el('div.title__join', {},
            codeInput,
            button('Join', { class: 'btn--go', onClick: joinNow }),
          ),
        ),
      ),

      status,

      el('div.title__minor', {},
        button([icon('book'), 'How to Play'], { class: 'btn--ghost btn--sm', onClick: onHowTo }),
        button([icon('gear'), 'Settings'], { class: 'btn--ghost btn--sm', onClick: onSettings }),
      ),
    ),

    el('p.title__credit', {},
      '2–4 captains · peer to peer, no server · ',
      el('span.title__credit-dim', {}, 'a pirate take on a modern classic'),
    ),
  );

  mount.append(screen);
  if (!name) nameInput.focus();
  else if (joinCodeFromUrl) codeInput.focus();
  return { status };
}

// ------------------------------------------------------------
// Lobby
// ------------------------------------------------------------

const TIMER_OPTIONS = [
  { value: 0, label: 'Off', tip: 'Take as long as you like.' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 120, label: '2 min' },
];

const TARGET_OPTIONS = [
  { value: 10, label: '10', tip: 'A short raid — about fifteen minutes.' },
  { value: 15, label: '15', tip: 'The standard game.' },
  { value: 20, label: '20', tip: 'A long voyage.' },
  { value: 25, label: '25', tip: 'Epic. Bring provisions.' },
];

export function renderLobby(mount, session, {
  onStart, onLeave, onSettings, onHowTo, onCopyLink,
}) {
  clear(mount);

  const seatList = el('div.lobby__seats');
  const optionsPane = el('div.lobby__options');
  const startRow = el('div.lobby__start');
  const chatLog = el('div.lobby__chat-log.scroll', { 'aria-live': 'polite' });

  const chatInput = el('input.input', {
    type: 'text',
    maxlength: '160',
    placeholder: 'Say something to the crew…',
    'aria-label': 'Chat message',
    onKeyDown: (event) => {
      if (event.key !== 'Enter') return;
      const text = chatInput.value.trim();
      if (!text) return;
      session.sendChat(text);
      chatInput.value = '';
    },
  });

  const codeText = el('span.lobby__code-value', {}, session.code || '— — — —');

  const screen = el('div.screen.screen--lobby', {},
    el('div.panel.lobby', {},
      el('div.lobby__head', {},
        el('div.grow', {},
          el('h2.panel__title', {}, 'The Table'),
          el('p.panel__sub', {}, session.isHost
            ? 'Gather your crew, then weigh anchor.'
            : 'Waiting on the host to weigh anchor.'),
        ),
        el('div.row', {},
          button(icon('book', { size: '1.05rem' }), { class: 'btn--ghost btn-icon', tip: 'How to play', 'aria-label': 'How to play', onClick: onHowTo }),
          button(icon('gear', { size: '1.05rem' }), { class: 'btn--ghost btn-icon', tip: 'Settings', 'aria-label': 'Settings', onClick: onSettings }),
        ),
      ),

      session.code ? el('div.lobby__code', {},
        el('div', {},
          el('span.lobby__code-label', {}, 'Room code'),
          codeText,
        ),
        button([icon('link'), 'Copy invite link'], {
          class: 'btn--sm',
          onClick: (e) => onCopyLink(e.currentTarget),
        }),
      ) : el('div.lobby__code.lobby__code--solo', {},
        icon('anchor'),
        el('span', {}, 'Solo voyage — no room, no connection.'),
      ),

      el('div.lobby__grid', {},
        el('section.lobby__col', {},
          el('h3.lobby__heading', {}, icon('crew', { size: '0.9rem' }), 'Captains'),
          seatList,
        ),
        el('section.lobby__col', {},
          el('h3.lobby__heading', {}, icon('scroll', { size: '0.9rem' }), 'House Rules'),
          optionsPane,
        ),
      ),

      session.code ? el('section.lobby__chatbox', {},
        el('h3.lobby__heading', {}, icon('book', { size: '0.9rem' }), 'Crew talk'),
        chatLog,
        chatInput,
      ) : null,

      startRow,
    ),
  );

  mount.append(screen);

  // ---- renderers ----

  function renderSeats(lobby) {
    clear(seatList);
    lobby.seats.forEach((seat, i) => {
      const decor = seatDecor(i);
      const isMe = seat.id === session.myId;
      const canRemove = session.isHost && !seat.isHost;

      const row = el('div.seat', { class: isMe ? 'seat--me' : '' },
        el('span.seat__emblem', { style: { background: decor.color } }, seatEmblem(i, { size: '1.15rem' })),
        el('div.seat__body', {},
          el('div.seat__name', {},
            seat.name,
            seat.isHost ? el('span.seat__tag', {}, 'HOST') : null,
            isMe ? el('span.seat__tag.seat__tag--you', {}, 'YOU') : null,
          ),
          seat.isAI
            ? el('div.seat__meta', {}, AI_LEVELS[seat.aiLevel]?.blurb || '')
            : el('div.seat__meta', {}, seat.connected ? 'Ready at the rail' : 'Adrift…'),
        ),
        seat.isAI && session.isHost
          ? segmented({
            value: seat.aiLevel,
            name: `${seat.name} difficulty`,
            options: Object.entries(AI_LEVELS).map(([value, meta]) => ({
              value, label: meta.label, tip: meta.blurb,
            })),
            onChange: (level) => session.setAiLevel(seat.id, level),
          })
          : null,
        canRemove
          ? button(icon('close', { size: '0.85rem' }), {
            class: 'btn--ghost btn--sm seat__kick',
            'aria-label': `Remove ${seat.name}`,
            tip: seat.isAI ? 'Send this one back to the bilge.' : 'Remove from the table.',
            onClick: () => session.removeSeat(seat.id),
          })
          : null,
      );
      seatList.append(row);
    });

    const free = MAX_SEATS - lobby.seats.length;
    for (let i = 0; i < free; i++) {
      seatList.append(el('div.seat.seat--empty', {},
        el('span.seat__emblem.seat__emblem--empty', {}, icon('plus', { size: '1rem' })),
        el('div.seat__body', {}, el('div.seat__meta', {}, 'Empty berth')),
        session.isHost && i === 0
          ? button('Add a computer captain', {
            class: 'btn--sm',
            onClick: () => session.addAI('sly'),
          })
          : null,
      ));
    }
  }

  function renderOptions(lobby) {
    clear(optionsPane);
    const opts = lobby.options;

    if (!session.isHost) {
      const readonly = el('dl.lobby__readonly', {},
        el('dt', {}, 'Infamy to win'), el('dd', {}, String(opts.targetPoints)),
        el('dt', {}, 'Turn timer'), el('dd', {}, opts.turnTimer ? `${opts.turnTimer}s` : 'Off'),
        el('dt', {}, 'Crew speed'), el('dd', {}, opts.aiSpeed),
        el('dt', {}, 'Open holds'), el('dd', {}, opts.revealReserved ? 'Yes' : 'No'),
        el('dt', {}, 'Extra doubloons'), el('dd', {}, String(opts.extraGold)),
      );
      optionsPane.append(
        el('p.lobby__note', {}, 'The host sets the rules for this table.'),
        readonly,
      );
      return;
    }

    optionsPane.append(
      field('Infamy to win',
        segmented({
          value: opts.targetPoints,
          name: 'Infamy to win',
          options: TARGET_OPTIONS,
          onChange: (v) => session.setOptions({ targetPoints: v }),
        }),
        'Fifteen is the classic length.',
      ),

      field('Turn timer',
        segmented({
          value: opts.turnTimer,
          name: 'Turn timer',
          options: TIMER_OPTIONS,
          onChange: (v) => session.setOptions({ turnTimer: v }),
        }),
        'When it runs out, a sensible move is played for you.',
      ),

      field('Computer captains move',
        segmented({
          value: opts.aiSpeed,
          name: 'AI speed',
          options: [
            { value: 'slow', label: 'Thoughtful' },
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Snappy' },
          ],
          onChange: (v) => session.setOptions({ aiSpeed: v }),
        }),
      ),

      field('Open holds',
        toggle({
          value: opts.revealReserved,
          label: 'Everyone sees stowed cards',
          tip: 'Off by default: a blind stow stays your secret.',
          onChange: (v) => session.setOptions({ revealReserved: v }),
        }),
      ),

      field('Extra doubloons',
        slider({
          value: opts.extraGold, min: 0, max: 5, step: 1,
          format: (v) => (v === 0 ? 'Standard (5)' : `+${v} (${5 + v})`),
          label: 'Extra doubloons',
          onInput: (v) => session.setOptions({ extraGold: v }),
        }),
        'A house rule. More gold means more stowing and fewer standoffs.',
      ),
    );
  }

  function renderStart(lobby) {
    clear(startRow);
    const count = lobby.seats.length;

    if (session.isHost) {
      const ready = count >= MIN_SEATS && count <= MAX_SEATS;
      startRow.append(
        button([icon('leave'), 'Leave'], { class: 'btn--ghost', onClick: onLeave }),
        el('span.grow'),
        el('span.lobby__count', {},
          ready ? `${count} captains aboard` : `Need at least ${MIN_SEATS} captains`),
        button('Weigh Anchor!', {
          class: 'btn--gold btn--lg',
          disabled: !ready || null,
          onClick: onStart,
        }),
      );
    } else {
      startRow.append(
        button([icon('leave'), 'Leave'], { class: 'btn--ghost', onClick: onLeave }),
        el('span.grow'),
        el('span.lobby__count', {}, 'Waiting for the host…'),
      );
    }
  }

  function renderChat(lobby) {
    clear(chatLog);
    for (const entry of lobby.chat || []) {
      chatLog.append(el('div.lobby__chat-line', {},
        el('b', {}, entry.from), ' ', entry.text,
      ));
    }
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function update(lobby) {
    codeText.textContent = lobby.code || '— — — —';
    renderSeats(lobby);
    renderOptions(lobby);
    renderStart(lobby);
    if (session.code) renderChat(lobby);
  }

  update(session.lobby);

  return {
    update,
    appendChat(entry) {
      chatLog.append(el('div.lobby__chat-line', {}, el('b', {}, entry.from), ' ', entry.text));
      chatLog.scrollTop = chatLog.scrollHeight;
    },
  };
}
