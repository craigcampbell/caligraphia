// Writing-practice paper: grade-school guide rules + a faint, traceable "ghost"
// phrase. Pure client-canvas drawing (CanvasRenderingContext2D) — practice
// sheets are ephemeral and never rendered server-side, so we don't need the
// @napi-rs/canvas font path here; the browser's own fonts are used.

// A mix of pangrams (every letter), copybook proverbs (pleasant to write), an
// alphabet line, and a couple of stroke drills. Cycled by the practice page.
export const PRACTICE_PHRASES: string[] = [
  "The quick brown fox jumps over the lazy dog.",
  "Pack my box with five dozen liquor jugs.",
  "How vexingly quick daft zebras jump!",
  "Sphinx of black quartz, judge my vow.",
  "a b c d e f g h i j k l m n o p q r s t u v w x y z",
  "Practice makes perfect.",
  "Well begun is half done.",
  "Make haste slowly.",
  "A stitch in time saves nine.",
  "Fair words butter no parsnips.",
  "minimum nine unununu — even loops and ovals",
  "ll ee oo  aa dd gg  hh kk bb",
];

const GUIDE = "rgba(70,110,170,";   // cool blue, like school paper
const GHOST = "rgba(40,40,60,";     // faint grey for the model phrase

// Draw repeating four-line guide rows (cap / dashed mid / baseline / descender)
// down the sheet, with the phrase rendered faintly on each writing row so the
// writer can trace it or copy beneath it.
export function drawPracticeGuide(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  guideText?: string
) {
  // Warm paper.
  ctx.fillStyle = "#fdfcf8";
  ctx.fillRect(0, 0, w, h);

  const marginX = Math.round(w * 0.065);
  const topPad = Math.round(h * 0.06);
  const rowH = Math.round(h * 0.095);
  const usable = h - topPad * 2;
  const rows = Math.max(1, Math.floor(usable / rowH));
  const innerW = Math.max(120, w - marginX * 2);

  // Faint left margin rule, like a real practice sheet.
  ctx.strokeStyle = "rgba(200,90,90,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(marginX, topPad * 0.5);
  ctx.lineTo(marginX, topPad + rows * rowH);
  ctx.stroke();

  // Pre-fit the ghost phrase to the row width once (same size on every row).
  let fontSize = Math.round(rowH * 0.42);
  if (guideText) {
    ctx.font = `${fontSize}px Georgia, 'Times New Roman', serif`;
    let measured = ctx.measureText(guideText).width;
    // Shrink to fit the writing width; never grow past the row's x-height band.
    while (measured > innerW && fontSize > 8) {
      fontSize -= 3;
      ctx.font = `${fontSize}px Georgia, 'Times New Roman', serif`;
      measured = ctx.measureText(guideText).width;
    }
  }

  for (let r = 0; r < rows; r++) {
    const rowTop = topPad + r * rowH;
    const capY = rowTop + rowH * 0.15;
    const midY = rowTop + rowH * 0.42;
    const baseY = rowTop + rowH * 0.72;
    const descY = rowTop + rowH * 0.92;

    const line = (y: number, alpha: number, width: number, dashed = false) => {
      ctx.strokeStyle = GUIDE + alpha + ")";
      ctx.lineWidth = width;
      ctx.setLineDash(dashed ? [10, 14] : []);
      ctx.beginPath();
      ctx.moveTo(marginX, y);
      ctx.lineTo(w - marginX, y);
      ctx.stroke();
    };

    line(capY, 0.18, 1.5);        // ascender / cap line
    line(midY, 0.22, 1.5, true);  // dashed x-height line
    line(baseY, 0.38, 2);         // baseline (the firm one)
    line(descY, 0.12, 1);         // descender line
    ctx.setLineDash([]);

    // The faint model phrase, sitting on the baseline.
    if (guideText) {
      ctx.font = `${fontSize}px Georgia, 'Times New Roman', serif`;
      ctx.fillStyle = GHOST + "0.16)";
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      ctx.fillText(guideText, marginX + 8, baseY - 2);
    }
  }
}
