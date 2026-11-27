// Classic Staunton-style inline SVG chess pieces (45x45 viewBox) with 2x offscreen image caching
// and headless-safe canvas vector fallback.

const PIECE_SVGS: Readonly<Record<string, string>> = {
  wk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#ffffff" stroke-linecap="butt" stroke-linejoin="miter"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#ffffff"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0M11.5 33.5c5.5-3 15.5-3 21 0M11.5 37c5.5-3 15.5-3 21 0"/>
    </g>
  </svg>`,
  wq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="#ffffff" fill-rule="evenodd" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="12" r="2.6"/><circle cx="14" cy="9" r="2.6"/><circle cx="22.5" cy="8" r="2.6"/><circle cx="31" cy="9" r="2.6"/><circle cx="39" cy="12" r="2.6"/>
      <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" stroke-linecap="butt"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
      <path d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0" fill="none"/>
    </g>
  </svg>`,
  wr: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="#ffffff" fill-rule="evenodd" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 39h27v-3H9v3zM12 36v-4h21v4H12zM11 14V9h4v2h5V9h5v2h5V9h4v5" stroke-linecap="butt"/>
      <path d="M34 14l-3 3H14l-3-3"/>
      <path d="M31 17v12.5H14V17" stroke-linecap="butt" stroke-linejoin="miter"/>
      <path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/>
      <path d="M11 14h23" fill="none" stroke-linejoin="miter"/>
    </g>
  </svg>`,
  wb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#ffffff" stroke-linecap="butt">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
        <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
        <circle cx="22.5" cy="8" r="2.5"/>
      </g>
      <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke-linejoin="miter"/>
    </g>
  </svg>`,
  wn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#ffffff"/>
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#ffffff"/>
      <circle cx="9.5" cy="25.5" r=".7" fill="#1c1a18"/>
      <circle cx="15" cy="15.5" r="1.1" fill="#1c1a18"/>
    </g>
  </svg>`,
  wp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#ffffff" stroke="#1c1a18" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
  bk: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#11100e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22.5 11.63V6M20 8h5" stroke-linejoin="miter"/>
      <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" fill="#2b2926" stroke-linecap="butt" stroke-linejoin="miter"/>
      <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" fill="#2b2926"/>
      <path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0" stroke="#e5e2dc" stroke-width="1.2"/>
    </g>
  </svg>`,
  bq: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="#2b2926" fill-rule="evenodd" stroke="#11100e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="6" cy="12" r="2.6"/><circle cx="14" cy="9" r="2.6"/><circle cx="22.5" cy="8" r="2.6"/><circle cx="31" cy="9" r="2.6"/><circle cx="39" cy="12" r="2.6"/>
      <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" stroke-linecap="butt"/>
      <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" stroke-linecap="butt"/>
      <path d="M11 38.5a35 35 1 0 0 23 0M11 29a35 35 1 0 1 23 0M12.5 31.5h20M11.5 34.5a35 35 1 0 0 22 0" fill="none" stroke="#e5e2dc" stroke-width="1.2"/>
    </g>
  </svg>`,
  br: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="#2b2926" fill-rule="evenodd" stroke="#11100e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 39h27v-3H9v3zM12.5 32l1.5-2.5h17l1.5 2.5h-20zM12 36v-4h21v4H12z" stroke-linecap="butt"/>
      <path d="M14 29.5v-13h17v13H14z" stroke-linecap="butt" stroke-linejoin="miter"/>
      <path d="M14 16.5L11 14h23l-3 2.5H14zM11 14V9h4v2h5V9h5v2h5V9h4v5H11z" stroke-linecap="butt"/>
      <path d="M12 35.5h21M13 31.5h19M14 29.5h17M14 16.5h17M11 14h23" fill="none" stroke="#e5e2dc" stroke-width="1.15" stroke-linejoin="miter"/>
    </g>
  </svg>`,
  bb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#11100e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <g fill="#2b2926" stroke-linecap="butt">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2z"/>
        <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z"/>
        <circle cx="22.5" cy="8" r="2.5"/>
      </g>
      <path d="M17.5 26h10M15 30h15m-7.5-14.5v5M20 18h5" stroke="#e5e2dc" stroke-width="1.3" stroke-linejoin="miter"/>
    </g>
  </svg>`,
  bn: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <g fill="none" fill-rule="evenodd" stroke="#11100e" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#2b2926"/>
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3" fill="#2b2926"/>
      <circle cx="9.5" cy="25.5" r=".7" fill="#e5e2dc" stroke="#e5e2dc"/>
      <circle cx="15" cy="15.5" r="1.1" fill="#e5e2dc" stroke="#e5e2dc"/>
      <path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z" fill="#e5e2dc" stroke="none" opacity="0.5"/>
    </g>
  </svg>`,
  bp: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="148" height="148">
    <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#2b2926" stroke="#11100e" stroke-width="1.6" stroke-linecap="round"/>
  </svg>`,
};

const spriteCache = new Map<string, HTMLImageElement>();

export function getPieceSprite(key: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = spriteCache.get(key);
  if (!img) {
    const svg = PIECE_SVGS[key];
    if (!svg) return null;
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    spriteCache.set(key, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function preloadPieceSprites(): void {
  if (typeof Image === "undefined") return;
  for (const key of Object.keys(PIECE_SVGS)) {
    getPieceSprite(key);
  }
}

/**
 * Draws a Staunton chess piece centered inside (x, y, size, size).
 * Uses preloaded SVG sprites in browsers and a crisp vector fallback in headless tests.
 */
export function drawChessPiece(
  ctx: CanvasRenderingContext2D,
  color: "w" | "b",
  type: string,
  x: number,
  y: number,
  size: number,
  scale = 1,
  elevated = false,
): void {
  const drawSize = size * scale;
  const dx = x + (size - drawSize) / 2;
  const dy = y + (size - drawSize) / 2;
  const key = `${color}${type}`;
  const sprite = getPieceSprite(key);

  ctx.save();
  if (elevated) {
    // Soft shadow under dragged piece (using translucent ellipse-like arc, safe for headless mocks)
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.72, drawSize * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sprite) {
    ctx.drawImage(sprite, dx, dy, drawSize, drawSize);
    ctx.restore();
    return;
  }

  // Headless / pre-decode vector fallback
  const cx = x + size / 2;
  const cy = y + size / 2;
  const isWhite = color === "w";
  ctx.fillStyle = isWhite ? "#ffffff" : "#2b2926";
  ctx.beginPath();
  ctx.arc(cx, cy, drawSize * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isWhite ? "#1c1a18" : "#e5e2dc";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = isWhite ? "#1c1a18" : "#f8fafc";
  ctx.font = `bold ${Math.round(drawSize * 0.38)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type.toUpperCase(), cx, cy + 1);
  ctx.restore();
}
