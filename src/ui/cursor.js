// ============================================================
// The pointer.
//
// The ordinary arrow everyone already knows how to read, struck
// in gold. Same silhouette and same hotspot as the system
// cursor, so it aims exactly where you expect.
// ============================================================

// The classic arrow, tip at the top left.
const ARROW = 'M2 1.6 L2 22.9 L7.5 17.6 L11.1 26 L15.1 24.2 L11.5 16.1 L18.4 16.1 Z';
const TIP = { x: 2, y: 2 };

/**
 * `variant` is 'default' for the plain gold arrow or 'active' for the
 * brighter one used over anything clickable.
 */
function arrowSvg(variant = 'default') {
  const active = variant === 'active';
  const light = active ? '#fff6d2' : '#f6dc93';
  const mid = active ? '#f0c95c' : '#cfa236';
  const dark = active ? '#b98a1c' : '#8a6414';
  const edge = active ? '#3a2708' : '#241a10';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="30" viewBox="0 0 26 30">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.75" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="0.45" stop-color="${mid}"/>
      <stop offset="1" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <!-- A dark casing under the fill keeps it legible on pale ground. -->
  <path d="${ARROW}" fill="none" stroke="${edge}" stroke-width="3.4" stroke-linejoin="round"/>
  <path d="${ARROW}" fill="url(#g)"/>
  <!-- Bevel: a bright edge down the left, a shadow down the right. -->
  <path d="M3.4 4.2 L3.4 19.4" fill="none" stroke="#fffaea" stroke-opacity="0.85" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M12.6 17.4 L15.6 24" fill="none" stroke="${dark}" stroke-opacity="0.75" stroke-width="1.2" stroke-linecap="round"/>
</svg>`;
}

function toDataUri(svg) {
  // encodeURIComponent keeps '#' and quotes out of the CSS url().
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`;
}

let styleNode = null;

/** Install the gold pointer across the app. */
export function installCursor() {
  if (styleNode) return;
  const plain = `${toDataUri(arrowSvg('default'))} ${TIP.x} ${TIP.y}`;
  const active = `${toDataUri(arrowSvg('active'))} ${TIP.x} ${TIP.y}`;

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
