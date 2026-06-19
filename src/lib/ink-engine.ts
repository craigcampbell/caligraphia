// The single ink engine, shared by the live drawing canvas and the
// server-side PNG renderer. Works against any 2D context
// (DOM CanvasRenderingContext2D or @napi-rs/canvas), so keep it free of
// browser- and node-only APIs.

export interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
  ink?: string; // per-point pen; falls back to the post's inkStyle
  size?: number; // brush-size multiplier; falls back to 1 for older posts
  tiltX?: number;
  tiltY?: number;
}

export type InkId =
  | "standard"
  | "fountain"
  | "runny"
  | "quill"
  | "calligraphy"
  | "italic"
  | "blackletter"
  | "copperplate"
  | "brush"
  | "watercolor"
  | "goldLeaf"
  | "illumination";

export const INK_STYLES: ReadonlyArray<{ id: InkId; name: string; desc: string }> = [
  { id: "fountain", name: "Fountain", desc: "inkwell pen — thin to thick with pressure & speed" },
  { id: "standard", name: "Standard", desc: "round nib" },
  { id: "runny", name: "Runny", desc: "wet & splattery" },
  { id: "quill", name: "Quill", desc: "scratchy nib" },
  { id: "calligraphy", name: "Callig.", desc: "broad-edge nib, held at 45°" },
  { id: "italic", name: "Italic", desc: "crisp chisel nib" },
  { id: "blackletter", name: "Blackletter", desc: "heavy gothic broad-edge nib" },
  { id: "copperplate", name: "Copperplate", desc: "pointed-nib, pressure-driven" },
  { id: "brush", name: "Brush", desc: "wide calligraphy brush" },
  { id: "watercolor", name: "Watercolor", desc: "soft translucent wash" },
  { id: "goldLeaf", name: "Gold Leaf", desc: "metallic gilding strokes" },
  { id: "illumination", name: "Illumine", desc: "ornamental color with a gilded edge" },
];

// Reference canvas width: stroke widths below are tuned for a 2400px page.
// Smaller canvases (postscripts, postcards) pass their width so lines keep
// the same visual weight relative to the page.
export const REFERENCE_WIDTH = 2400;

// A broad-edge nib held at the classic 45° italic angle. The stroke is the
// ribbon swept by the nib edge: full width moving across the nib, a hairline
// moving along it. This is what makes calligraphy calligraphy.
const CALLIGRAPHY_ANGLE = -Math.PI / 4;
const ITALIC_ANGLE = -Math.PI / 7;
const BLACKLETTER_ANGLE = -Math.PI / 2.7;

export const DEFAULT_INK_SEED = 42;

let _seed = DEFAULT_INK_SEED;
function ri(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 0x7fffffff;
}
export function reseed(seed: number) {
  _seed = Math.max(1, Math.floor(seed)) % 2147483647;
}

function nibHalfWidth(pressure: number, scale: number, ink: string): number {
  const base = ink === "blackletter" ? 18 : ink === "italic" ? 14 : 11;
  const swell = ink === "blackletter" ? 20 : ink === "italic" ? 12 : 14;
  return Math.max(3, (base + pressure * swell)) * scale * 0.5;
}

function nibAngle(ink: string): number {
  if (ink === "italic") return ITALIC_ANGLE;
  if (ink === "blackletter") return BLACKLETTER_ANGLE;
  return CALLIGRAPHY_ANGLE;
}

// Fill the parallelogram swept by the nib edge moving from (x1,y1) to (x2,y2)
function fillNibRibbon(
  ctx: any,
  x1: number, y1: number, x2: number, y2: number,
  h1: number, h2: number,
  color: string, alpha: number,
  angle: number
) {
  const nibCos = Math.cos(angle);
  const nibSin = Math.sin(angle);

  ctx.beginPath();
  ctx.moveTo(x1 + nibCos * h1, y1 + nibSin * h1);
  ctx.lineTo(x2 + nibCos * h2, y2 + nibSin * h2);
  ctx.lineTo(x2 - nibCos * h2, y2 - nibSin * h2);
  ctx.lineTo(x1 - nibCos * h1, y1 - nibSin * h1);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
  // Hairline floor: when the stroke runs along the nib the ribbon collapses,
  // so trace its spine to keep the thin strokes alive.
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.8, h1 * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function renderGoldLeafSegment(
  ctx: any,
  x1: number, y1: number, x2: number, y2: number,
  p1: number, p2: number,
  color: string,
  scale: number
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const w = Math.max(4, ((p1 + p2) / 2) * 22) * scale;

  ctx.save?.();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "#6d4b10";
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = w * 1.18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = color || "#d4af37";
  ctx.globalAlpha = 0.88;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = "#fff4ad";
  ctx.globalAlpha = 0.48;
  ctx.lineWidth = Math.max(1, w * 0.24);
  ctx.beginPath();
  ctx.moveTo(x1 - dy * 0.018, y1 + dx * 0.018);
  ctx.lineTo(x2 - dy * 0.018, y2 + dx * 0.018);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    if (ri() > 0.35) {
      const t = ri();
      ctx.beginPath();
      ctx.arc(
        x1 + dx * t + (ri() - 0.5) * w,
        y1 + dy * t + (ri() - 0.5) * w,
        Math.max(0.7, w * (0.05 + ri() * 0.13)),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = ri() > 0.45 ? "#fff7c8" : "#9b6f17";
      ctx.globalAlpha = 0.3 + ri() * 0.35;
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  ctx.restore?.();
}

export function renderSegment(
  ctx: any,
  ink: string,
  x1: number, y1: number, x2: number, y2: number,
  p1: number, p2: number,
  color: string,
  scale: number = 1,
  sizeMul: number = 1
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = dist;

  if (ink === "calligraphy" || ink === "italic" || ink === "blackletter") {
    const h1 = nibHalfWidth(p1, scale, ink) * sizeMul;
    const h2 = nibHalfWidth(p2, scale, ink) * sizeMul;
    const angle = nibAngle(ink);
    const opacity = ink === "blackletter" ? 0.9 + ri() * 0.08 : 0.82 + ri() * 0.12;
    fillNibRibbon(ctx, x1, y1, x2, y2, h1, h2, color, opacity, angle);

    // Wet ink pools where the nib lingers
    if (ink !== "italic" && speed < 14 * scale && ri() > 0.55) {
      ctx.beginPath();
      ctx.ellipse(
        (x1 + x2) / 2, (y1 + y2) / 2,
        h2 * 0.9, h2 * 0.55, angle, 0, Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25 + ri() * 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return;
  }

  if (ink === "goldLeaf") {
    renderGoldLeafSegment(ctx, x1, y1, x2, y2, p1, p2, color, scale * sizeMul);
    return;
  }

  let baseW: number;
  let alpha: number;
  if (ink === "fountain") {
    // Inkwell / fountain pen: a flexible pointed nib. The line swells with
    // pressure and lingers (slow strokes lay down more ink), and tapers to a
    // hairline when the hand moves fast or light — the thin-to-thick feel of
    // a real dip pen. Speed carries the variation for mouse/trackpad users
    // who have no pressure at all.
    const pAvg = (p1 + p2) / 2;
    const speedFactor = Math.max(0.4, Math.min(1.5, (130 * scale) / (speed + 14 * scale)));
    baseW = Math.max(1.1, (2.5 + pAvg * 13) * speedFactor) * scale;
    alpha = 0.9 + ri() * 0.08;
  } else if (ink === "runny") {
    baseW = Math.max(2, ((p1 + p2) / 2) * 10) * scale;
    alpha = 0.7 + ri() * 0.3;
  } else if (ink === "quill") {
    baseW = Math.max(1.2, ((p1 + p2) / 2) * 5) * scale;
    alpha = 0.75 + ri() * 0.25;
  } else if (ink === "copperplate") {
    // Pointed-nib: ultra-thin hairlines, swells purely from pressure
    baseW = Math.max(0.4, ((p1 + p2) / 2) * 18) * scale;
    alpha = 0.9 + ri() * 0.1;
  } else if (ink === "brush") {
    // Wide brush — speed thins the stroke, pressure widens it
    const speedFactor = Math.max(0.4, Math.min(1.2, (200 * scale) / (speed + 8 * scale)));
    baseW = Math.max(1.5, ((p1 + p2) / 2) * 22 * speedFactor) * scale;
    alpha = 0.65 + ((p1 + p2) / 2) * 0.3;
  } else if (ink === "watercolor") {
    baseW = Math.max(8, ((p1 + p2) / 2) * 34) * scale;
    alpha = 0.12 + ((p1 + p2) / 2) * 0.16;
  } else if (ink === "illumination") {
    baseW = Math.max(9, ((p1 + p2) / 2) * 28) * scale;
    alpha = 0.72;
  } else {
    baseW = Math.max(2, ((p1 + p2) / 2) * 9) * scale;
    alpha = 1;
  }

  // Brush-size multiplier applies to every width-based ink at once.
  baseW *= sizeMul;

  // Overlapping circles: much smoother than lineTo on fast strokes
  const stepSize = Math.max(1, baseW * 0.3);
  const steps = Math.max(1, Math.ceil(dist / stepSize));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.beginPath();
    const jitter = ink === "watercolor" ? baseW * 0.18 : 0;
    const radius = ink === "watercolor" ? baseW * (0.38 + ri() * 0.2) : baseW * 0.5;
    ctx.arc(
      x1 + dx * t + (ri() - 0.5) * jitter,
      y1 + dy * t + (ri() - 0.5) * jitter,
      radius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (ink === "illumination") {
    renderGoldLeafSegment(ctx, x1, y1, x2, y2, p1 * 0.42, p2 * 0.42, "#d4af37", scale);
  }

  if (ink === "watercolor") {
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, baseW * 0.16);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Runny ink splatter
  if (ink === "runny") {
    for (let i = 0; i < 3; i++) {
      if (ri() > 0.55) {
        ctx.beginPath();
        ctx.arc(
          x1 + dx * ri() + (ri() - 0.5) * 30 * scale,
          y1 + dy * ri() + (ri() - 0.5) * 30 * scale,
          (ri() * 4 + 1) * scale, 0, Math.PI * 2
        );
        ctx.fillStyle = color;
        ctx.globalAlpha = ri() * 0.5;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Quill wobble
  if (ink === "quill" && ri() > 0.82) {
    const wobble = (ri() - 0.5) * 3 * scale;
    ctx.beginPath();
    ctx.arc(x2 + wobble + 1, y2 + wobble + 1, baseW * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

export function drawDot(
  ctx: any,
  ink: string,
  px: number, py: number,
  pressure: number,
  color: string,
  scale: number = 1,
  sizeMul: number = 1
) {
  // A dot has no speed, so the brush size folds cleanly into the scale.
  scale *= sizeMul;
  if (ink === "runny") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, pressure * 8) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(
        px + (ri() - 0.5) * 16 * scale,
        py + (ri() - 0.5) * 16 * scale,
        (ri() * 3 + 1) * scale, 0, Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = ri() * 0.4;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  } else if (ink === "quill") {
    ctx.beginPath();
    ctx.arc(
      px + (ri() - 0.5) * 2 * scale,
      py + (ri() - 0.5) * 2 * scale,
      Math.max(0.8, pressure * 4) * scale, 0, Math.PI * 2
    );
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (ink === "calligraphy" || ink === "italic" || ink === "blackletter") {
    // The footprint of the resting nib: a thin bar at the nib angle
    const h = nibHalfWidth(pressure, scale, ink);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(nibAngle(ink));
    ctx.beginPath();
    ctx.ellipse(0, 0, h, Math.max(1, h * 0.18), 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  } else if (ink === "copperplate") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(0.4, pressure * 9) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (ink === "fountain") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1, pressure * 9) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (ink === "brush") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, pressure * 14) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + pressure * 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (ink === "watercolor") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(5, pressure * 22) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (ink === "goldLeaf") {
    renderGoldLeafSegment(ctx, px - 0.01, py, px + 0.01, py, pressure, pressure, color, scale);
  } else if (ink === "illumination") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(4, pressure * 16) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;
    renderGoldLeafSegment(ctx, px - 0.01, py, px + 0.01, py, pressure * 0.4, pressure * 0.4, "#d4af37", scale);
  } else {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.2, pressure * 7) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// Points further apart than this are separate strokes, not a join
export const STROKE_GAP_MS = 300;

// Render a full normalized stroke list onto a canvas of the given size,
// honoring each point's own pen (falling back to defaultInk for old posts).
export function renderStrokes(
  ctx: any,
  strokes: StrokePoint[],
  defaultInk: string,
  width: number,
  height: number
) {
  const scale = width / REFERENCE_WIDTH;
  const sorted = [...strokes].sort((a, b) => a.time - b.time);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const ink = p.ink || defaultInk;
    const px = p.x * width;
    const py = p.y * height;
    const sizeMul = p.size ?? 1;
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p.time - prev.time < STROKE_GAP_MS) {
        renderSegment(
          ctx, ink,
          prev.x * width, prev.y * height, px, py,
          prev.pressure, p.pressure, p.color, scale, sizeMul
        );
      } else {
        drawDot(ctx, ink, px, py, p.pressure, p.color, scale, sizeMul);
      }
    } else {
      drawDot(ctx, ink, px, py, p.pressure, p.color, scale, sizeMul);
    }
  }
}
