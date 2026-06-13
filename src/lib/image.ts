import sharp from "sharp";
import { renderStrokes, type StrokePoint } from "./ink-engine";
import { getObjectBuffer } from "./storage";

export type { StrokePoint };

const CANVAS_WIDTH = 2400;
const CANVAS_HEIGHT = 3200;

type PaperId = "blank" | "ruled" | "graph" | "watercolor" | "vellum" | "midnight";

function drawPaper(ctx: any, paper: PaperId, w = CANVAS_WIDTH, h = CANVAS_HEIGHT) {
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
    case "midnight":
      ctx.fillStyle = "#0d0d1a"; ctx.fillRect(0, 0, w, h);
      {
        const sd = ctx.getImageData(0, 0, w, h);
        for (let i = 0; i < sd.data.length; i += 4) {
          if (Math.random() < 0.0005) {
            sd.data[i] = 255; sd.data[i+1] = 255;
            sd.data[i+2] = 255; sd.data[i+3] = 40 + Math.random() * 80;
          }
        }
        ctx.putImageData(sd, 0, 0);
      }
      break;
    default:
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
      break;
  }
}

export async function renderCanvasToPng(
  strokes: StrokePoint[],
  paper: string = "blank",
  inkStyle: string = "standard",
  width: number = CANVAS_WIDTH,
  height: number = CANVAS_HEIGHT
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  drawPaper(ctx, paper as PaperId, width, height);
  renderStrokes(ctx, strokes, inkStyle, width, height);

  return canvas.toBuffer("image/png");
}

// Postscript (comment) cards are short and wide — a strip of paper, not a page.
export const COMMENT_WIDTH = 1200;
export const COMMENT_HEIGHT = 420;

export function renderCommentToPng(
  strokes: StrokePoint[],
  inkStyle: string = "standard"
): Promise<Buffer> {
  return renderCanvasToPng(strokes, "blank", inkStyle, COMMENT_WIDTH, COMMENT_HEIGHT);
}

// Postcards: landscape, smaller than a letter, postmarked on arrival.
export const POSTCARD_WIDTH = 1600;
export const POSTCARD_HEIGHT = 1100;

export async function renderPostcardToPng(
  strokes: StrokePoint[],
  paper: string = "blank",
  inkStyle: string = "standard"
): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const canvas = createCanvas(POSTCARD_WIDTH, POSTCARD_HEIGHT);
  const ctx = canvas.getContext("2d");

  drawPaper(ctx, paper as PaperId, POSTCARD_WIDTH, POSTCARD_HEIGHT);
  renderStrokes(ctx, strokes, inkStyle, POSTCARD_WIDTH, POSTCARD_HEIGHT);
  drawPostmark(ctx, POSTCARD_WIDTH, POSTCARD_HEIGHT);

  return canvas.toBuffer("image/png");
}

// A cancellation mark in the top-right corner: double ring, date, wavy bars.
function drawPostmark(ctx: any, w: number, h: number) {
  const cx = w - 190;
  const cy = 170;
  const r = 105;
  const inkColor = "rgba(60,50,70,0.55)";

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);

  ctx.strokeStyle = inkColor;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, r - 14, 0, Math.PI * 2); ctx.stroke();

  ctx.fillStyle = inkColor;
  ctx.textAlign = "center";
  try {
    const date = new Date();
    const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
    ctx.font = "bold 30px serif";
    ctx.fillText("CALIGRAPHIA", 0, -28);
    ctx.font = "bold 34px serif";
    ctx.fillText(`${date.getDate()} ${months[date.getMonth()]}`, 0, 12);
    ctx.font = "bold 30px serif";
    ctx.fillText(`${date.getFullYear()}`, 0, 48);
  } catch {
    // No fonts available (bare container): the rings alone still read as a postmark
  }

  // Wavy cancellation bars trailing left from the ring
  ctx.lineWidth = 4;
  for (let bar = 0; bar < 4; bar++) {
    const by = -36 + bar * 24;
    ctx.beginPath();
    for (let x = -r - 320; x < -r + 6; x += 8) {
      const y = by + Math.sin(x / 22) * 6;
      x === -r - 320 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

// Round robins: each section is a wide band; finished robins stack 3 bands.
export const ROBIN_SECTION_WIDTH = 2400;
export const ROBIN_SECTION_HEIGHT = 1100;
export const ROBIN_SIZE = 3;

export function renderRobinSectionToPng(
  strokes: StrokePoint[],
  inkStyle: string = "standard"
): Promise<Buffer> {
  return renderCanvasToPng(strokes, "blank", inkStyle, ROBIN_SECTION_WIDTH, ROBIN_SECTION_HEIGHT);
}

// The sliver of a section the next writer is allowed to see (bottom ~18%)
export async function cropRobinPeek(sectionPng: Buffer): Promise<Buffer> {
  const peekH = Math.round(ROBIN_SECTION_HEIGHT * 0.18);
  return sharp(sectionPng)
    .extract({ left: 0, top: ROBIN_SECTION_HEIGHT - peekH, width: ROBIN_SECTION_WIDTH, height: peekH })
    .png()
    .toBuffer();
}

// Stack the finished sections into one tall letter
export async function compositeRobin(sectionPngs: Buffer[]): Promise<Buffer> {
  const total = ROBIN_SECTION_HEIGHT * sectionPngs.length;
  return sharp({
    create: {
      width: ROBIN_SECTION_WIDTH,
      height: total,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(sectionPngs.map((input, i) => ({ input, top: i * ROBIN_SECTION_HEIGHT, left: 0 })))
    .png()
    .toBuffer();
}

export async function compositeScratchOverlay(
  baseImageUrl: string,
  scratchSvgData: string
): Promise<Buffer> {
  const { buffer: baseBuffer } = await getObjectBuffer(baseImageUrl);
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
