import sharp from "sharp";

export interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
}

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 3200;

type PaperId = "blank" | "ruled" | "graph" | "watercolor" | "vellum";
type InkId = "standard" | "runny" | "quill" | "calligraphy";

function drawPaper(ctx: any, paper: PaperId) {
  const w = CANVAS_WIDTH;
  const h = CANVAS_HEIGHT;

  switch (paper) {
    case "ruled":
      ctx.fillStyle = "#fdfcf8"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(135,180,220,0.45)"; ctx.lineWidth = 1;
      for (let y = 120; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(220,80,80,0.35)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(80, h); ctx.stroke();
      break;
    case "graph":
      ctx.fillStyle = "#fdfdfd"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(160,200,240,0.3)"; ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(140,180,220,0.5)"; ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 200) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      break;
    case "watercolor":
      ctx.fillStyle = "#faf6f0"; ctx.fillRect(0, 0, w, h);
      {
        const imageData = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const n = (Math.random() - 0.5) * 14;
          imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
          imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
          imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n - 2));
        }
        ctx.putImageData(imageData, 0, 0);
      }
      break;
    case "vellum":
      ctx.fillStyle = "#f5f0e8"; ctx.fillRect(0, 0, w, h);
      {
        const imageData = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < imageData.data.length; i += 4) {
          const n = (Math.random() - 0.5) * 8;
          imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
          imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
          imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n + 2));
        }
        ctx.putImageData(imageData, 0, 0);
      }
      for (let i = 0; i < 60; i++) {
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,130,100,${Math.random() * 0.06})`; ctx.fill();
      }
      break;
    default:
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      break;
  }
}

let _seed = 42;
function ri(): number { _seed = (_seed * 16807 + 0) % 2147483647; return (_seed & 0x7fffffff) / 0x7fffffff; }

function renderSegment(ctx: any, ink: InkId, x1: number, y1: number, x2: number, y2: number, p1: number, p2: number, color: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  if (ink === "runny") {
    const baseW = Math.max(2, (p1 + p2) / 2 * 10);
    ctx.beginPath();
    ctx.moveTo(x1 + ri() * 8 - 4, y1 + ri() * 8 - 4);
    ctx.lineTo(x2 + ri() * 8 - 4, y2 + ri() * 8 - 4);
    ctx.strokeStyle = color; ctx.lineWidth = baseW; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = 0.7 + ri() * 0.3; ctx.stroke(); ctx.globalAlpha = 1;

    for (let i = 0; i < 3; i++) {
      if (ri() > 0.55) {
        ctx.beginPath();
        ctx.arc(x1 + dx * ri() + (ri() - 0.5) * 30, y1 + dy * ri() + (ri() - 0.5) * 30, ri() * 4 + 1, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.globalAlpha = ri() * 0.5; ctx.fill(); ctx.globalAlpha = 1;
      }
    }
  } else if (ink === "quill") {
    const wobble = (ri() - 0.5) * 3;
    const baseW = Math.max(1.2, (p1 + p2) / 2 * 5);
    ctx.beginPath();
    ctx.moveTo(x1 + wobble, y1 + wobble);
    ctx.lineTo(x2 + wobble, y2 + wobble);
    ctx.strokeStyle = color; ctx.lineWidth = baseW; ctx.lineCap = "round";
    ctx.globalAlpha = 0.75 + ri() * 0.25; ctx.stroke();

    if (ri() > 0.82) {
      ctx.beginPath();
      ctx.moveTo(x1 + wobble + 1, y1 + wobble + 1);
      ctx.lineTo(x2 + wobble + 2, y2 + wobble + 2);
      ctx.lineWidth = baseW * 0.35;
      ctx.globalAlpha = 0.4; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (ink === "calligraphy") {
    const nibAngle = Math.PI / 4;
    const perpAngle = angle - nibAngle;
    const widthFactor = Math.abs(Math.cos(perpAngle));
    const baseW = Math.max(1.5, (p1 + p2) / 2 * 12);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x1 + Math.cos(angle + Math.PI / 2) * baseW * widthFactor * 0.5, y1 + Math.sin(angle + Math.PI / 2) * baseW * widthFactor * 0.5);
    ctx.lineTo(x2 + Math.cos(angle + Math.PI / 2) * baseW * widthFactor * 0.5, y2 + Math.sin(angle + Math.PI / 2) * baseW * widthFactor * 0.5);
    ctx.strokeStyle = color; ctx.lineWidth = baseW * Math.max(0.3, widthFactor); ctx.lineCap = "round"; ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, (p1 + p2) / 2 * 9);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
  }
}

function drawDot(ctx: any, ink: InkId, px: number, py: number, pressure: number, color: string) {
  if (ink === "runny") {
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, pressure * 8), 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(px + (ri() - 0.5) * 16, py + (ri() - 0.5) * 16, ri() * 3 + 1, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.globalAlpha = ri() * 0.4; ctx.fill(); ctx.globalAlpha = 1;
    }
  } else if (ink === "quill") {
    ctx.beginPath(); ctx.arc(px + (ri() - 0.5) * 2, py + (ri() - 0.5) * 2, Math.max(0.8, pressure * 4), 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
  } else if (ink === "calligraphy") {
    const w = Math.max(1, pressure * 10);
    const ht = Math.max(0.5, pressure * 3);
    ctx.save(); ctx.translate(px, py); ctx.rotate(Math.PI / 4);
    ctx.beginPath(); ctx.ellipse(0, 0, w, ht, 0, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill(); ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(px, py, Math.max(1.2, pressure * 7), 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
  }
}

export async function renderCanvasToPng(
  strokes: StrokePoint[],
  paper: string = "blank",
  inkStyle: string = "standard"
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawPaper(ctx, paper as PaperId);

  const sorted = [...strokes].sort((a, b) => a.time - b.time);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const px = p.x * CANVAS_WIDTH;
    const py = p.y * CANVAS_HEIGHT;
    if (i > 0) {
      const prev = sorted[i - 1];
      if (p.time - prev.time < 200) {
        renderSegment(ctx, inkStyle as InkId, prev.x * CANVAS_WIDTH, prev.y * CANVAS_HEIGHT, px, py, prev.pressure, p.pressure, p.color);
      } else {
        drawDot(ctx, inkStyle as InkId, px, py, p.pressure, p.color);
      }
    } else {
      drawDot(ctx, inkStyle as InkId, px, py, p.pressure, p.color);
    }
  }

  return canvas.toBuffer("image/png");
}

export async function compositeScratchOverlay(
  baseImageUrl: string,
  scratchSvgData: string
): Promise<Buffer> {
  const response = await fetch(baseImageUrl);
  const baseBuffer = Buffer.from(await response.arrayBuffer());
  const baseImage = await sharp(baseBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: "fill" })
    .toFormat("png")
    .toBuffer();
  return sharp(baseImage)
    .composite([
      { input: Buffer.from(`<svg width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" xmlns="http://www.w3.org/2000/svg">${scratchSvgData}</svg>`), top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}
