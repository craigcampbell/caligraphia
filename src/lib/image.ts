import sharp from "sharp";

export interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 1600;

export async function renderCanvasToPng(
  strokes: StrokePoint[]
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const sorted = [...strokes].sort((a, b) => a.time - b.time);

  const STROKE_GAP_MS = 200;
  const strokeGroups: StrokePoint[][] = [];
  let currentGroup: StrokePoint[] = [];

  for (const point of sorted) {
    if (currentGroup.length === 0) {
      currentGroup.push(point);
    } else {
      const gap = point.time - currentGroup[currentGroup.length - 1].time;
      if (gap > STROKE_GAP_MS) {
        strokeGroups.push(currentGroup);
        currentGroup = [point];
      } else {
        currentGroup.push(point);
      }
    }
  }
  if (currentGroup.length > 0) strokeGroups.push(currentGroup);

  for (const group of strokeGroups) {
    if (group.length === 0) continue;
    const color = group[0].color || "#000000";

    if (group.length === 1) {
      const p = group[0];
      const px = p.x * CANVAS_WIDTH;
      const py = p.y * CANVAS_HEIGHT;
      const radius = Math.max(1, p.pressure * 8);
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const first = group[0];
    ctx.moveTo(first.x * CANVAS_WIDTH, first.y * CANVAS_HEIGHT);

    if (group.length === 2) {
      const last = group[group.length - 1];
      ctx.lineWidth = Math.max(1, (first.pressure + last.pressure) / 2 * 10);
      ctx.lineTo(last.x * CANVAS_WIDTH, last.y * CANVAS_HEIGHT);
    } else {
      for (let i = 1; i < group.length - 1; i++) {
        const p0 = group[i - 1];
        const p1 = group[i];
        const p2 = group[i + 1];
        const xc = (p1.x + p2.x) / 2 * CANVAS_WIDTH;
        const yc = (p1.y + p2.y) / 2 * CANVAS_HEIGHT;
        ctx.lineWidth = Math.max(1, (p0.pressure + p1.pressure) / 2 * 10);
        ctx.quadraticCurveTo(
          p1.x * CANVAS_WIDTH,
          p1.y * CANVAS_HEIGHT,
          xc,
          yc
        );
      }
      const last = group[group.length - 1];
      ctx.lineWidth = Math.max(1, last.pressure * 10);
      ctx.lineTo(last.x * CANVAS_WIDTH, last.y * CANVAS_HEIGHT);
    }

    ctx.stroke();
  }

  const buf = canvas.toBuffer("image/png");
  return buf;
}

export async function compositeScratchOverlay(
  baseImageUrl: string,
  scratchSvgData: string
): Promise<Buffer> {
  const response = await fetch(baseImageUrl);
  const baseBuffer = Buffer.from(await response.arrayBuffer());

  const svgBuffer = Buffer.from(
    `<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${scratchSvgData}</svg>`
  );

  const baseImage = await sharp(baseBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "fill" })
    .toFormat("png")
    .toBuffer();

  return sharp(baseImage)
    .composite([
      { input: svgBuffer, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

export function colorToHex(color: string): string {
  if (color.startsWith("#") && /^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const names: Record<string, string> = {
    black: "#000000",
    red: "#e53e3e",
    blue: "#3182ce",
    green: "#38a169",
    purple: "#805ad5",
    orange: "#dd6b20",
    pink: "#d53f8c",
  };
  return names[color.toLowerCase()] || color;
}
