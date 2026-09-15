// ============================================================
// The pointer: a scimitar.
//
// Drawn as SVG and installed as a CSS cursor. The blade lies
// along the same diagonal as the stock Windows arrow, with its
// point at the top-left and the hotspot on that point, so it
// aims exactly where the system cursor would.
// ============================================================

const TIP = { x: 3, y: 2.5 };

/**
 * `variant` is 'default' for the plain steel blade or 'active' for the
 * gilded one used over anything clickable.
 */
function scimitarSvg(variant = 'default') {
  const active = variant === 'active';
  const bladeLight = active ? '#fff3cf' : '#f3f7fa';
  const bladeMid = active ? '#e8c463' : '#c9d6df';
  const bladeDark = active ? '#a87c22' : '#8a9aa6';
  const edge = '#17140f';
  const hilt = active ? '#f0cd72' : '#c8a03f';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
  <defs>
    <linearGradient id="b" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bladeLight}"/>
      <stop offset="0.55" stop-color="${bladeMid}"/>
      <stop offset="1" stop-color="${bladeDark}"/>
    </linearGradient>
  </defs>
  <g stroke="${edge}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    <!-- blade: a crescent tapering to the point at the top left -->
    <path d="M${TIP.x} ${TIP.y}
             C 11 3.6, 18.4 8.4, 22.4 16.6
             C 17.6 14.2, 11.4 9.4, ${TIP.x} ${TIP.y} Z"
          fill="url(#b)"/>
    <!-- crossguard, square to the blade -->
    <path d="M18.6 20.6 L25.6 13.6" stroke="${edge}" stroke-width="4.4"/>
    <path d="M18.6 20.6 L25.6 13.6" stroke="${hilt}" stroke-width="2.4"/>
    <!-- grip and pommel -->
    <path d="M21.6 18.4 L27.8 24.6" stroke="${edge}" stroke-width="5"/>
    <path d="M21.6 18.4 L27.8 24.6" stroke="#5a3d24" stroke-width="2.8"/>
    <circle cx="29.2" cy="26" r="2.5" fill="${hilt}"/>
  </g>
  <!-- a glint on the flat of the blade -->
  <path d="M7.4 5.2 C 12 6.6, 16.2 10, 19 14.4" fill="none"
        stroke="#ffffff" stroke-opacity="${active ? 0.75 : 0.55}" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;
}

function toDataUri(svg) {
  // encodeURIComponent keeps '#' and quotes out of the CSS url().
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`;
}

let styleNode = null;

/** Install the scimitar cursor across the app. */
export function installCursor() {
  if (styleNode) return;
  const plain = `${toDataUri(scimitarSvg('default'))} ${TIP.x} ${TIP.y}`;
  const active = `${toDataUri(scimitarSvg('active'))} ${TIP.x} ${TIP.y}`;

  styleNode = document.createElement('style');
  styleNode.textContent = `
    html, body, .game-canvas, .scene-layer, .ui-layer, .overlay, .panel, .hud {
      cursor: ${plain}, default;
    }
    a, button, .btn, .tab, .segmented__option, .toggle, .prompt-token,
    .lord-option, .hold__card, .seat__kick, [role="button"], summary {
      cursor: ${active}, pointer;
    }
    input[type="text"], textarea { cursor: text; }
    input[type="range"] { cursor: ${active}, grab; }
    input[type="range"]:active { cursor: ${active}, grabbing; }
    .btn:disabled, .prompt-token:disabled, button:disabled {
      cursor: ${plain}, not-allowed;
    }
  `;
  document.head.append(styleNode);
}

export function removeCursor() {
  styleNode?.remove();
  styleNode = null;
}
