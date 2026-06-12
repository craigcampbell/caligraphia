"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useNoKeyboard } from "@/hooks/useNoKeyboard";
import { usePenSounds } from "@/hooks/usePenSounds";

const CANVAS_W = 2400;
const CANVAS_H = 3200;

const PAPER_PRESETS = [
  { id: "blank", name: "Blank", bg: "#ffffff" },
  { id: "ruled", name: "Ruled", bg: "#fdfcf8" },
  { id: "graph", name: "Graph", bg: "#fdfdfd" },
  { id: "watercolor", name: "Watercolor", bg: "#faf6f0" },
  { id: "vellum", name: "Vellum", bg: "#f5f0e8" },
  { id: "midnight", name: "Midnight", bg: "#0d0d1a" },
] as const;

type PaperId = (typeof PAPER_PRESETS)[number]["id"];

const INK_STYLES = [
  { id: "standard", name: "Standard", desc: "round nib" },
  { id: "runny", name: "Runny", desc: "wet & splattery" },
  { id: "quill", name: "Quill", desc: "scratchy nib" },
  { id: "calligraphy", name: "Callig.", desc: "flat angle nib" },
  { id: "copperplate", name: "Copperplate", desc: "pointed-nib, pressure-driven" },
  { id: "brush", name: "Brush", desc: "wide calligraphy brush" },
] as const;

type InkId = (typeof INK_STYLES)[number]["id"];

const INK_COLORS = [
  "#1a1a2e", "#c0392b", "#2471a3", "#27ae60", "#8e44ad",
  "#d35400", "#e84393", "#2c3e50", "#6f4e37", "#16a085",
  "#e8e8f0",
];

interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
  tiltX?: number;
  tiltY?: number;
}

interface Props {
  onComplete: (strokes: StrokePoint[], drawingDurationMs: number, paper: PaperId, inkStyle: InkId) => void;
  onCancel: () => void;
  minDrawTimeMs?: number;
}

let inkSeed = Date.now();
function ri(): number {
  inkSeed = (inkSeed * 16807 + 0) % 2147483647;
  return (inkSeed & 0x7fffffff) / 0x7fffffff;
}

function drawPaper(ctx: CanvasRenderingContext2D, paper: PaperId) {
  const w = CANVAS_W;
  const h = CANVAS_H;
  const preset = PAPER_PRESETS.find((p) => p.id === paper) || PAPER_PRESETS[0];
  ctx.fillStyle = preset.bg;
  ctx.fillRect(0, 0, w, h);

  if (paper === "ruled") {
    ctx.strokeStyle = "rgba(135,180,220,0.45)"; ctx.lineWidth = 1;
    for (let y = 120; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(220,80,80,0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(80, 0); ctx.lineTo(80, h); ctx.stroke();
  }
  if (paper === "graph") {
    ctx.strokeStyle = "rgba(160,200,240,0.3)"; ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(140,180,220,0.5)"; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 200) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 200) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  if (paper === "watercolor") {
    const imageData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
      imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
      imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n - 2));
    }
    ctx.putImageData(imageData, 0, 0);
  }
  if (paper === "vellum") {
    const imageData = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 8;
      imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + n));
      imageData.data[i + 1] = Math.min(255, Math.max(0, imageData.data[i + 1] + n));
      imageData.data[i + 2] = Math.min(255, Math.max(0, imageData.data[i + 2] + n + 2));
    }
    ctx.putImageData(imageData, 0, 0);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w; const y = Math.random() * h; const r = Math.random() * 3 + 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160,130,100,${Math.random() * 0.06})`; ctx.fill();
    }
  }
  if (paper === "midnight") {
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, w, h);
    const sd = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < sd.data.length; i += 4) {
      if (Math.random() < 0.0005) {
        sd.data[i] = 255; sd.data[i+1] = 255;
        sd.data[i+2] = 255; sd.data[i+3] = 40 + Math.random() * 80;
      }
    }
    ctx.putImageData(sd, 0, 0);
  }
}

function renderSegment(ctx: CanvasRenderingContext2D, ink: InkId, x1: number, y1: number, x2: number, y2: number, p1: number, p2: number, color: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  // Compute base width for this segment
  let baseW: number;
  let alpha: number;
  if (ink === "runny") {
    baseW = Math.max(2, (p1 + p2) / 2 * 10);
    alpha = 0.7 + ri() * 0.3;
  } else if (ink === "quill") {
    baseW = Math.max(1.2, (p1 + p2) / 2 * 5);
    alpha = 0.75 + ri() * 0.25;
  } else if (ink === "calligraphy") {
    const speed = Math.sqrt(dx * dx + dy * dy);
    const speedFactor = Math.max(0.35, Math.min(1.5, 300 / (speed + 10)));
    const nibOffset = Math.PI / 4 * (0.6 + 0.4 * (p1 + p2) / 2);
    const nibAngle = angle - nibOffset;
    const perpAngle = angle - nibAngle;
    const widthFactor = Math.abs(Math.cos(perpAngle));
    const w = Math.max(1.2, (p1 + p2) / 2 * 14 * speedFactor);
    baseW = w * Math.max(0.2, widthFactor);
    alpha = 0.85;
  } else if (ink === "copperplate") {
    // Pointed-nib: ultra-thin hairlines, swells purely from pressure
    baseW = Math.max(0.4, (p1 + p2) / 2 * 18);
    alpha = 0.9 + ri() * 0.1;
  } else if (ink === "brush") {
    // Wide calligraphy brush — speed thins the stroke, pressure widens it
    const speed = Math.sqrt(dx * dx + dy * dy);
    const speedFactor = Math.max(0.4, Math.min(1.2, 200 / (speed + 8)));
    baseW = Math.max(1.5, (p1 + p2) / 2 * 22 * speedFactor);
    alpha = 0.65 + (p1 + p2) / 2 * 0.3;
  } else {
    baseW = Math.max(2, (p1 + p2) / 2 * 9);
    alpha = 1;
  }

  // Overlapping circles technique: draw circles at intervals along the segment
  // This creates a much smoother line than lineTo, especially on fast strokes
  const stepSize = Math.max(1, baseW * 0.3);
  const steps = Math.max(1, Math.ceil(dist / stepSize));

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    const p = p1 + (p2 - p1) * t;
    const r = baseW * (ink === "calligraphy" ? 0.5 : 0.5);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Calligraphy extras: ink pooling and splatter
  if (ink === "calligraphy") {
    const speed = Math.sqrt(dx * dx + dy * dy);
    // Ink pooling at slow speed
    if (speed < 30 && ri() > 0.4) {
      const poolR = Math.max(2, (p1 + p2) / 2 * 6 * (1 - speed / 30));
      ctx.beginPath();
      ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, poolR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5 + ri() * 0.3;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (speed > 50 && ri() > 0.85) {
      for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        ctx.arc(x2 + (ri() - 0.5) * 20, y2 + (ri() - 0.5) * 20, ri() * 3 + 1, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = ri() * 0.4;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Runny ink splatter
  if (ink === "runny") {
    for (let i = 0; i < 3; i++) {
      if (ri() > 0.55) {
        ctx.beginPath();
        ctx.arc(x1 + dx * ri() + (ri() - 0.5) * 30, y1 + dy * ri() + (ri() - 0.5) * 30, ri() * 4 + 1, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = ri() * 0.5;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Quill wobble
  if (ink === "quill" && ri() > 0.82) {
    const wobble = (ri() - 0.5) * 3;
    ctx.beginPath();
    ctx.arc(x2 + wobble + 1, y2 + wobble + 1, baseW * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawDot(ctx: CanvasRenderingContext2D, ink: InkId, px: number, py: number, pressure: number, color: string) {
  if (ink === "runny") {
    const r = Math.max(1, pressure * 8);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.75; ctx.fill(); ctx.globalAlpha = 1;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(px + (ri() - 0.5) * 16, py + (ri() - 0.5) * 16, ri() * 3 + 1, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.globalAlpha = ri() * 0.4; ctx.fill(); ctx.globalAlpha = 1;
    }
  } else if (ink === "quill") {
    const r = Math.max(0.8, pressure * 4);
    ctx.beginPath(); ctx.arc(px + (ri() - 0.5) * 2, py + (ri() - 0.5) * 2, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.8; ctx.fill(); ctx.globalAlpha = 1;
  } else if (ink === "calligraphy") {
    const w = Math.max(1, pressure * 10);
    const h = Math.max(0.5, pressure * 3);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  } else if (ink === "copperplate") {
    const r = Math.max(0.4, pressure * 9);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
  } else if (ink === "brush") {
    const r = Math.max(1.5, pressure * 14);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.globalAlpha = 0.7 + pressure * 0.25; ctx.fill(); ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.2, pressure * 7), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function CanvasDraw({ onComplete, onCancel, minDrawTimeMs = 4000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [selectedColor, setSelectedColor] = useState(
    (() => { const h = new Date().getHours(); return (h >= 2 && h < 4) ? "#e8e8f0" : INK_COLORS[0]; })()
  );
  const [paper, setPaper] = useState<PaperId>(
    (() => { const h = new Date().getHours(); return (h >= 2 && h < 4) ? "midnight" : "ruled"; })()
  );
  const [inkStyle, setInkStyle] = useState<InkId>("standard");
  const [hint, setHint] = useState("");

  // Pen scratch sounds
  const [soundOn, setSoundOn] = useState(false);
  const { startScratch, updateScratch, stopScratch, enable, disable } = usePenSounds(paper, inkStyle);

  const strokesRef = useRef<StrokePoint[]>([]);
  const firstStrokeTimeRef = useRef<number | null>(null);
  const lastPtRef = useRef<{ px: number; py: number; pressure: number; color: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stroke boundaries (indexes into strokesRef) so the last stroke can be undone
  const strokeStartsRef = useRef<number[]>([]);
  const [strokeCount, setStrokeCount] = useState(0);

  // Palm rejection: once a stylus is seen, finger touches are ignored, and
  // only one pointer may draw at a time (a resting palm is a second pointer).
  const penSeenRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);

  // Input smoothing state (exponential filter, speed-adaptive)
  const smoothedRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const pw = parent.clientWidth;
      const ph = Math.max(window.innerHeight * 0.78, 500);
      const scale = Math.min(pw / CANVAS_W, ph / CANVAS_H);
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      canvas.style.width = `${CANVAS_W * scale}px`;
      canvas.style.height = `${CANVAS_H * scale}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) { ctxRef.current = ctx; redraw(ctx); }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); if (timerRef.current) clearInterval(timerRef.current); };
  }, [paper, inkStyle]);

  const redraw = (ctx: CanvasRenderingContext2D) => {
    drawPaper(ctx, paper);
    const pts = strokesRef.current;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const px = p.x * CANVAS_W;
      const py = p.y * CANVAS_H;
      if (i > 0) {
        const prev = pts[i - 1];
        if (p.time - prev.time < 300) {
          renderSegment(ctx, inkStyle, prev.x * CANVAS_W, prev.y * CANVAS_H, px, py, prev.pressure, p.pressure, p.color);
        } else {
          drawDot(ctx, inkStyle, px, py, p.pressure, p.color);
        }
      } else {
        drawDot(ctx, inkStyle, px, py, p.pressure, p.color);
      }
    }
  };

  const startTimer = () => {
    if (timerRef.current) return;
    setHint("Let the ink flow...");
    timerRef.current = setInterval(() => {
      if (!firstStrokeTimeRef.current) return;
      const t = Date.now() - firstStrokeTimeRef.current;
      setElapsed(t);
      if (t >= minDrawTimeMs) {
        setCanSubmit(true);
        setHint("Your letter is ready");
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (t >= minDrawTimeMs * 0.66) {
        setHint("Almost there, keep writing...");
      } else if (t >= minDrawTimeMs * 0.33) {
        setHint("Good, let the ink dry a little more...");
      }
    }, 500);
  };

  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }, []);

  // One-euro-style filter: heavy smoothing for slow, shaky finger writing,
  // light smoothing when moving fast so the line doesn't lag behind the pen.
  const smoothCoords = useCallback((raw: { x: number; y: number }, pointerType: string) => {
    const now = performance.now();
    const prev = smoothedRef.current;
    if (!prev) {
      smoothedRef.current = { x: raw.x, y: raw.y, t: now };
      return raw;
    }
    const dt = Math.max(1, now - prev.t);
    const speed = Math.hypot(raw.x - prev.x, raw.y - prev.y) / dt; // normalized units/ms
    const minAlpha = pointerType === "pen" ? 0.45 : 0.25;
    const alpha = Math.min(0.95, minAlpha + speed * 600);
    const x = prev.x + alpha * (raw.x - prev.x);
    const y = prev.y + alpha * (raw.y - prev.y);
    smoothedRef.current = { x, y, t: now };
    return { x, y };
  }, []);

  const drawPt = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = smoothCoords(getCoords(e), e.pointerType);
    const pressure = e.pressure || 0.5;
    const tiltX = (e as any).tiltX !== undefined ? (e as any).tiltX : undefined;
    const tiltY = (e as any).tiltY !== undefined ? (e as any).tiltY : undefined;
    const now = Date.now();
    if (!firstStrokeTimeRef.current) { firstStrokeTimeRef.current = now; startTimer(); }
    strokesRef.current.push({ time: now, x, y, pressure, color: selectedColor, tiltX, tiltY });
    const px = x * CANVAS_W;
    const py = y * CANVAS_H;
    const prev = lastPtRef.current;
    if (prev) {
      const lastStroke = strokesRef.current[strokesRef.current.length - 2];
      if (lastStroke && now - lastStroke.time < 300) {
        renderSegment(ctx, inkStyle, prev.px, prev.py, px, py, prev.pressure, pressure, selectedColor);
      } else {
        drawDot(ctx, inkStyle, px, py, pressure, selectedColor);
      }
    } else {
      drawDot(ctx, inkStyle, px, py, pressure, selectedColor);
    }
    lastPtRef.current = { px, py, pressure, color: selectedColor };

    // Update scratch sound with stroke speed
    if (soundOn) {
      const speed = Math.sqrt((px - (prev?.px || px)) ** 2 + (py - (prev?.py || py)) ** 2);
      updateScratch(speed);
    }
  }, [getCoords, smoothCoords, selectedColor, inkStyle, soundOn, updateScratch]);

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.pointerType === "pen") penSeenRef.current = true;
    // Palm rejection: ignore fingers once a stylus is in play, and ignore
    // any second pointer while one is already drawing.
    if (e.pointerType === "touch" && penSeenRef.current) return;
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPtRef.current = null;
    smoothedRef.current = null;
    strokeStartsRef.current.push(strokesRef.current.length);
    setStrokeCount(strokeStartsRef.current.length);
    if (soundOn) startScratch();
    drawPt(e);
  };
  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || e.pointerId !== activePointerRef.current) return;
    e.preventDefault();
    drawPt(e);
  };
  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== null && e.pointerId !== activePointerRef.current) return;
    e.preventDefault();
    activePointerRef.current = null;
    setDrawing(false);
    lastPtRef.current = null;
    smoothedRef.current = null;
    if (soundOn) stopScratch();
  };

  // Undo the most recent stroke. Pen plotters get no undo; humans on phones do.
  const handleUndo = () => {
    const starts = strokeStartsRef.current;
    if (starts.length === 0) return;
    const start = starts.pop()!;
    strokesRef.current = strokesRef.current.slice(0, start);
    setStrokeCount(starts.length);
    const ctx = ctxRef.current;
    if (ctx) redraw(ctx);
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (strokesRef.current.length < 1) return;
    const dur = firstStrokeTimeRef.current ? Date.now() - firstStrokeTimeRef.current : 0;
    onComplete(strokesRef.current, dur, paper, inkStyle);
  };

  // Drop a random ink splatter on the canvas
  const dropInkSplatter = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const cw = CANVAS_W, ch = CANVAS_H;
    const cx = cw * (0.15 + Math.random() * 0.7);
    const cy = ch * (0.15 + Math.random() * 0.7);
    const mainR = 8 + Math.random() * 30;
    const droplets = 8 + Math.floor(Math.random() * 20);

    // Main irregular blot
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.08) {
      const wobble = 1 + (Math.random() - 0.5) * 0.5;
      const px = cx + Math.cos(a) * mainR * wobble;
      const py = cy + Math.sin(a) * mainR * wobble;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = selectedColor;
    ctx.globalAlpha = 0.5 + Math.random() * 0.4;
    ctx.fill();

    // Droplets
    for (let i = 0; i < droplets; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = mainR * (0.6 + Math.random() * 3.5);
      const dx = Math.cos(angle) * dist;
      const dyRaw = Math.sin(angle) * dist;
      const dy = dyRaw + (dyRaw > 0 ? dyRaw * 0.15 : 0);
      const dr = 1 + Math.random() * 8;
      ctx.beginPath();
      ctx.ellipse(cx + dx, cy + dy, dr, dr * (0.5 + Math.random() * 0.6), angle * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = selectedColor;
      ctx.globalAlpha = 0.2 + Math.random() * 0.5;
      ctx.fill();
      // Satellites
      if (Math.random() > 0.5) for (let s = 0; s < 2; s++) {
        ctx.beginPath();
        ctx.arc(cx + dx + (Math.random() - 0.5) * 12, cy + dy + (Math.random() - 0.5) * 12, Math.random() * 3 + 0.5, 0, Math.PI * 2);
        ctx.fillStyle = selectedColor; ctx.globalAlpha = Math.random() * 0.3; ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }, [selectedColor]);

  return (
    <div className="canvas-shell">
      <div className="canvas-topbar">
        <div className="paper-chooser">
          {PAPER_PRESETS.map((p) => (
            <button key={p.id} className={`paper-chip ${paper === p.id ? "active" : ""}`} onClick={() => setPaper(p.id)} style={{ background: p.bg }}>
              {p.name}
            </button>
          ))}
        </div>

        <div className="ink-style-chooser">
          {INK_STYLES.map((s) => (
            <button key={s.id} className={`ink-chip ${inkStyle === s.id ? "active" : ""}`} onClick={() => setInkStyle(s.id)} title={s.desc}>
              {s.name}
            </button>
          ))}
        </div>

        <div className="ink-palette">
          {INK_COLORS.map((c) => (
            <button key={c} className={`ink-swatch ${selectedColor === c ? "active" : ""}`} onClick={() => setSelectedColor(c)} style={{ background: c }} aria-label={c} />
          ))}
        </div>

        <div className="canvas-status">
          {/* Sound toggle */}
          <button
            className={`sound-toggle ${soundOn ? "on" : ""}`}
            onClick={() => {
              if (soundOn) { setSoundOn(false); disable(); }
              else { setSoundOn(true); enable(); startScratch(); setTimeout(() => stopScratch(), 50); }
            }}
            title={soundOn ? "Pen sounds on" : "Pen sounds off"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {soundOn ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="22" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="22" y2="15" />
                </>
              )}
            </svg>
          </button>
          {/* Drop ink splatter */}
          <button
            className="ink-splatter-btn"
            onClick={dropInkSplatter}
            title="Drop an ink splatter"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2.5c-3 4-7 7.5-7 11.5a7 7 0 0 0 14 0c0-4-4-7.5-7-11.5z"/>
              <circle cx="12" cy="14" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          {/* Ink level — visual only, no numbers */}
          <div className="ink-level-wrap" title={canSubmit ? "Ready to send" : "Ink still flowing..."}>
            <div className="ink-bottle">
              <svg width="18" height="24" viewBox="0 0 18 24" className="ink-icon">
                <rect x="3" y="2" width="12" height="20" rx="2" fill="none" stroke="#8c7a60" strokeWidth="1.2" opacity="0.5"/>
                <rect x="6" y="0" width="6" height="3" rx="1" fill="none" stroke="#8c7a60" strokeWidth="1" opacity="0.4"/>
                <rect x="4" y={4 + (1 - Math.min(elapsed / minDrawTimeMs, 1)) * 16} width="10" height={Math.min(elapsed / minDrawTimeMs, 1) * 16}
                  rx="1" fill={canSubmit ? "#27ae60" : selectedColor} opacity={canSubmit ? 0.8 : 0.6}/>
              </svg>
            </div>
            <span className={`ink-hint ${canSubmit ? "ready" : ""}`}>{hint || "Start writing..."}</span>
          </div>
        </div>
      </div>

      <canvas ref={canvasRef} className="draw-canvas"
        onPointerDown={handleDown} onPointerMove={handleMove}
        onPointerUp={handleUp} onPointerLeave={handleUp}
        style={{ touchAction: "none" }}
      />

      <div className="canvas-actions">
        <button onClick={onCancel} className="btn-cancel">Discard</button>
        <button onClick={handleUndo} className="btn-undo" disabled={strokeCount === 0} title="Undo last stroke">
          &#8630; Undo stroke
        </button>
        <button onClick={handleSubmit} className={`btn-submit ${canSubmit ? "ready" : "disabled"}`} disabled={!canSubmit}>
          {canSubmit ? "Send Your Letter" : "Ink still drying..."}
        </button>
      </div>

      <style>{`
        .canvas-shell { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
        .canvas-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }
        .paper-chooser, .ink-style-chooser { display: flex; gap: 4px; flex-wrap: wrap; }
        .paper-chip, .ink-chip {
          padding: 5px 12px; border: 1.5px solid #d0c8b8; border-radius: 8px;
          cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 500;
          color: #5c5040; transition: all 0.15s; background: #fefdf9;
        }
        .ink-chip { background: #f5f0e8; }
        .paper-chip.active, .ink-chip.active {
          border-color: #8b4513;
          box-shadow: 0 0 0 2px rgba(139,69,19,0.15);
        }
        .ink-chip.active { background: #ede0cc; font-weight: 700; }
        .paper-chip:hover, .ink-chip:hover { border-color: #b0a090; }
        .ink-palette { display: flex; gap: 4px; flex-wrap: wrap; }
        .ink-swatch { width: 24px; height: 24px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; transition: transform 0.12s; }
        .ink-swatch.active { border-color: #333; transform: scale(1.25); box-shadow: 0 0 6px rgba(0,0,0,0.2); }
        .ink-swatch:hover { transform: scale(1.15); }
        .canvas-status { display: flex; gap: 10px; align-items: center; font-size: 13px; margin-left: auto; }
        .ink-level-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ink-bottle {
          display: flex;
          align-items: center;
        }
        .ink-icon { display: block; }
        .ink-hint {
          font-size: 12px;
          color: #b0a090;
          font-style: italic;
          transition: color 0.3s;
        }
        .ink-hint.ready {
          color: #27ae60;
          font-weight: 600;
          font-style: normal;
        }
        .sound-toggle {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1.5px solid #d0c8b8;
          border-radius: 50%; background: #fefdf9; cursor: pointer;
          color: #b0a090; transition: all 0.15s; padding: 0;
        }
        .sound-toggle:hover { border-color: #8b4513; color: #8b4513; }
        .sound-toggle.on {
          background: #f0e8d8; border-color: #8b4513; color: #8b4513;
        }
        .ink-splatter-btn {
          display: flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border: 1.5px solid #d0c8b8;
          border-radius: 50%; background: #fefdf9; cursor: pointer;
          color: #b0a090; transition: all 0.15s; padding: 0;
        }
        .ink-splatter-btn:hover { border-color: #8b4513; color: #8b4513; background: #fff5f0; }
        .draw-canvas { border: 1px solid #d8d0c0; border-radius: 4px; cursor: crosshair; box-shadow: 0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04); }
        .canvas-actions { display: flex; gap: 14px; padding: 6px 0 20px; }
        .btn-cancel { padding: 12px 32px; border: 1px solid #ccc; border-radius: 8px; background: #fff; cursor: pointer; font-size: 15px; font-weight: 500; font-family: inherit; }
        .btn-cancel:hover { background: #f8f5f0; }
        .btn-undo { padding: 12px 24px; border: 1px solid #d0c8b8; border-radius: 8px; background: #fefdf9; color: #5c4a30; cursor: pointer; font-size: 15px; font-weight: 500; font-family: inherit; }
        .btn-undo:hover:not(:disabled) { border-color: #8b4513; color: #8b4513; }
        .btn-undo:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-submit { padding: 12px 32px; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 700; font-family: inherit; transition: all 0.2s; }
        .btn-submit.disabled { background: #e0ddd5; color: #999; cursor: not-allowed; }
        .btn-submit.ready { background: #1a1a1a; color: #fff; box-shadow: 0 4px 16px rgba(0,0,0,0.18); }
        .btn-submit.ready:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
      `}</style>
    </div>
  );
}
