// The single ink engine, shared by the live drawing canvas, the replay
// viewer, and the server-side PNG renderer. Works against any 2D context
// (DOM CanvasRenderingContext2D or @napi-rs/canvas), so keep it free of
// browser- and node-only APIs.

export interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
  ink?: string; // per-point pen; falls back to the post's inkStyle
  tiltX?: number;
  tiltY?: number;
}

export type InkId =
  | "standard"
  | "runny"
  | "quill"
  | "calligraphy"
  | "copperplate"
  | "brush";

export const INK_STYLES: ReadonlyArray<{ id: InkId; name: string; desc: string }> = [
  { id: "standard", name: "Standard", desc: "round nib" },
  { id: "runny", name: "Runny", desc: "wet & splattery" },
  { id: "quill", name: "Quill", desc: "scratchy nib" },
  { id: "calligraphy", name: "Callig.", desc: "broad-edge nib, held at 45°" },
  { id: "copperplate", name: "Copperplate", desc: "pointed-nib, pressure-driven" },
  { id: "brush", name: "Brush", desc: "wide calligraphy brush" },
];

// Reference canvas width: stroke widths below are tuned for a 2400px page.
// Smaller canvases (postscripts, postcards) pass their width so lines keep
// the same visual weight relative to the page.
export const REFERENCE_WIDTH = 2400;

// A broad-edge nib held at the classic 45° italic angle. The stroke is the
// ribbon swept by the nib edge: full width moving across the nib, a hairline
// moving along it. This is what makes calligraphy calligraphy.
const NIB_ANGLE = -Math.PI / 4;
const NIB_COS = Math.cos(NIB_ANGLE);
const NIB_SIN = Math.sin(NIB_ANGLE);

let _seed = 42;
function ri(): number {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed & 0x7fffffff) / 0x7fffffff;
}
export function reseed(seed: number) {
  _seed = Math.max(1, Math.floor(seed)) % 2147483647;
}

function nibHalfWidth(pressure: number, scale: number): number {
  return Math.max(3, (11 + pressure * 14)) * scale * 0.5;
}

// Fill the parallelogram swept by the nib edge moving from (x1,y1) to (x2,y2)
function fillNibRibbon(
  ctx: any,
  x1: number, y1: number, x2: number, y2: number,
  h1: number, h2: number,
  color: string, alpha: number
) {
  ctx.beginPath();
  ctx.moveTo(x1 + NIB_COS * h1, y1 + NIB_SIN * h1);
  ctx.lineTo(x2 + NIB_COS * h2, y2 + NIB_SIN * h2);
  ctx.lineTo(x2 - NIB_COS * h2, y2 - NIB_SIN * h2);
  ctx.lineTo(x1 - NIB_COS * h1, y1 - NIB_SIN * h1);
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

export function renderSegment(
  ctx: any,
  ink: string,
  x1: number, y1: number, x2: number, y2: number,
  p1: number, p2: number,
  color: string,
  scale: number = 1
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const speed = dist;

  if (ink === "calligraphy") {
    const h1 = nibHalfWidth(p1, scale);
    const h2 = nibHalfWidth(p2, scale);
    fillNibRibbon(ctx, x1, y1, x2, y2, h1, h2, color, 0.82 + ri() * 0.12);

    // Wet ink pools where the nib lingers
    if (speed < 14 * scale && ri() > 0.55) {
      ctx.beginPath();
      ctx.ellipse(
        (x1 + x2) / 2, (y1 + y2) / 2,
        h2 * 0.9, h2 * 0.55, NIB_ANGLE, 0, Math.PI * 2
      );
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25 + ri() * 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    return;
  }

  let baseW: number;
  let alpha: number;
  if (ink === "runny") {
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
  } else {
    baseW = Math.max(2, ((p1 + p2) / 2) * 9) * scale;
    alpha = 1;
  }

  // Overlapping circles: much smoother than lineTo on fast strokes
  const stepSize = Math.max(1, baseW * 0.3);
  const steps = Math.max(1, Math.ceil(dist / stepSize));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.beginPath();
    ctx.arc(x1 + dx * t, y1 + dy * t, baseW * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

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
  scale: number = 1
) {
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
  } else if (ink === "calligraphy") {
    // The footprint of the resting nib: a thin bar at the nib angle
    const h = nibHalfWidth(pressure, scale);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(NIB_ANGLE);
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
  } else if (ink === "brush") {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.5, pressure * 14) * scale, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.7 + pressure * 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
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
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p.time - prev.time < STROKE_GAP_MS) {
        renderSegment(
          ctx, ink,
          prev.x * width, prev.y * height, px, py,
          prev.pressure, p.pressure, p.color, scale
        );
      } else {
        drawDot(ctx, ink, px, py, p.pressure, p.color, scale);
      }
    } else {
      drawDot(ctx, ink, px, py, p.pressure, p.color, scale);
    }
  }
}
