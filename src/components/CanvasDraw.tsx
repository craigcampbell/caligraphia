"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const CANVAS_W = 2400;
const CANVAS_H = 3200;

const PAPER_PRESETS = [
  { id: "blank", name: "Blank", bg: "#ffffff" },
  { id: "ruled", name: "Ruled", bg: "#fdfcf8" },
  { id: "graph", name: "Graph", bg: "#fdfdfd" },
  { id: "watercolor", name: "Watercolor", bg: "#faf6f0" },
  { id: "vellum", name: "Vellum", bg: "#f5f0e8" },
] as const;

type PaperId = (typeof PAPER_PRESETS)[number]["id"];

const INK_STYLES = [
  { id: "standard", name: "Standard", desc: "round nib" },
  { id: "runny", name: "Runny", desc: "wet & splattery" },
  { id: "quill", name: "Quill", desc: "scratchy nib" },
  { id: "calligraphy", name: "Callig.", desc: "flat angle nib" },
] as const;

type InkId = (typeof INK_STYLES)[number]["id"];

const INK_COLORS = [
  "#1a1a2e", "#c0392b", "#2471a3", "#27ae60", "#8e44ad",
  "#d35400", "#e84393", "#2c3e50", "#6f4e37", "#16a085",
];

interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
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
}

function renderSegment(ctx: CanvasRenderingContext2D, ink: InkId, x1: number, y1: number, x2: number, y2: number, p1: number, p2: number, color: string) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const angle = Math.atan2(dy, dx);

  if (ink === "runny") {
    const baseW = Math.max(2, (p1 + p2) / 2 * 10);
    ctx.beginPath();
    ctx.moveTo(x1 + ri() * 8 - 4, y1 + ri() * 8 - 4);
    ctx.lineTo(x2 + ri() * 8 - 4, y2 + ri() * 8 - 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = baseW;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.7 + ri() * 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;

    for (let i = 0; i < 3; i++) {
      if (ri() > 0.55) {
        const sx = x1 + dx * ri() + (ri() - 0.5) * 30;
        const sy = y1 + dy * ri() + (ri() - 0.5) * 30;
        ctx.beginPath();
        ctx.arc(sx, sy, ri() * 4 + 1, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = ri() * 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  } else if (ink === "quill") {
    const wobble = (ri() - 0.5) * 3;
    const baseW = Math.max(1.2, (p1 + p2) / 2 * 5);
    ctx.beginPath();
    ctx.moveTo(x1 + wobble, y1 + wobble);
    ctx.lineTo(x2 + wobble, y2 + wobble);
    ctx.strokeStyle = color;
    ctx.lineWidth = baseW;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.75 + ri() * 0.25;
    ctx.stroke();

    if (ri() > 0.82) {
      ctx.beginPath();
      ctx.moveTo(x1 + wobble + 1, y1 + wobble + 1);
      ctx.lineTo(x2 + wobble + 2, y2 + wobble + 2);
      ctx.lineWidth = baseW * 0.35;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (ink === "calligraphy") {
    const nibAngle = Math.PI / 4;
    const perpAngle = angle - nibAngle;
    const widthFactor = Math.abs(Math.cos(perpAngle));
    const baseW = Math.max(1.5, (p1 + p2) / 2 * 12);

    const cx1 = x1 + Math.cos(angle + Math.PI / 2) * baseW * widthFactor * 0.5;
    const cy1 = y1 + Math.sin(angle + Math.PI / 2) * baseW * widthFactor * 0.5;
    const cx2 = x2 + Math.cos(angle + Math.PI / 2) * baseW * widthFactor * 0.5;
    const cy2 = y2 + Math.sin(angle + Math.PI / 2) * baseW * widthFactor * 0.5;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(cx1, cy1);
    ctx.lineTo(cx2, cy2);
    ctx.strokeStyle = color;
    ctx.lineWidth = baseW * Math.max(0.3, widthFactor);
    ctx.lineCap = "round";
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, (p1 + p2) / 2 * 9);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
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
  } else {
    ctx.beginPath();
    ctx.arc(px, py, Math.max(1.2, pressure * 7), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

export function CanvasDraw({ onComplete, onCancel, minDrawTimeMs = 15000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [selectedColor, setSelectedColor] = useState(INK_COLORS[0]);
  const [paper, setPaper] = useState<PaperId>("ruled");
  const [inkStyle, setInkStyle] = useState<InkId>("standard");

  const strokesRef = useRef<StrokePoint[]>([]);
  const firstStrokeTimeRef = useRef<number | null>(null);
  const lastPtRef = useRef<{ px: number; py: number; pressure: number; color: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    timerRef.current = setInterval(() => {
      if (!firstStrokeTimeRef.current) return;
      const t = Date.now() - firstStrokeTimeRef.current;
      setElapsed(t);
      if (t >= minDrawTimeMs) setCanSubmit(true);
    }, 200);
  };

  const getCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }, []);

  const drawPt = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getCoords(e);
    const pressure = e.pressure || 0.5;
    const now = Date.now();
    if (!firstStrokeTimeRef.current) { firstStrokeTimeRef.current = now; startTimer(); }
    strokesRef.current.push({ time: now, x, y, pressure, color: selectedColor });
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
  }, [getCoords, selectedColor, inkStyle]);

  const handleDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    lastPtRef.current = null;
    drawPt(e);
  };
  const handleMove = (e: React.PointerEvent<HTMLCanvasElement>) => { if (!drawing) return; e.preventDefault(); drawPt(e); };
  const handleUp = (e: React.PointerEvent<HTMLCanvasElement>) => { e.preventDefault(); setDrawing(false); lastPtRef.current = null; };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (strokesRef.current.length < 1) return;
    const dur = firstStrokeTimeRef.current ? Date.now() - firstStrokeTimeRef.current : 0;
    onComplete(strokesRef.current, dur, paper, inkStyle);
  };

  const fmt = (ms: number) => `${Math.floor(ms / 1000)}s`;

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
          <span className={`timer ${canSubmit ? "ready" : ""}`}>{canSubmit ? "Ready" : `Wait ${fmt(minDrawTimeMs - elapsed)}`}</span>
          <span className="point-count">{strokesRef.current.length} pts</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="draw-canvas"
        onPointerDown={handleDown} onPointerMove={handleMove}
        onPointerUp={handleUp} onPointerLeave={handleUp}
        style={{ touchAction: "none" }}
      />

      <div className="canvas-actions">
        <button onClick={onCancel} className="btn-cancel">Discard</button>
        <button onClick={handleSubmit} className={`btn-submit ${canSubmit ? "ready" : "disabled"}`} disabled={!canSubmit}>
          {canSubmit ? "Submit Drawing" : `Wait ${fmt(Math.max(0, minDrawTimeMs - elapsed))}`}
        </button>
      </div>

      <style>{`
        .canvas-shell { display: flex; flex-direction: column; align-items: center; gap: 10px; width: 100%; }
        .canvas-topbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; width: 100%; }
        .paper-chooser, .ink-style-chooser { display: flex; gap: 4px; flex-wrap: wrap; }
        .paper-chip, .ink-chip {
          padding: 5px 12px; border: 1.5px solid #d0c8b8; border-radius: 18px;
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
        .canvas-status { display: flex; gap: 10px; align-items: center; font-size: 13px; color: #888; margin-left: auto; }
        .timer.ready { color: #27ae60; font-weight: 700; }
        .point-count { color: #aaa; }
        .draw-canvas { border: 1px solid #d8d0c0; border-radius: 4px; cursor: crosshair; box-shadow: 0 2px 20px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04); }
        .canvas-actions { display: flex; gap: 14px; padding: 6px 0 20px; }
        .btn-cancel { padding: 12px 32px; border: 1px solid #ccc; border-radius: 24px; background: #fff; cursor: pointer; font-size: 15px; font-weight: 500; font-family: inherit; }
        .btn-cancel:hover { background: #f8f5f0; }
        .btn-submit { padding: 12px 32px; border: none; border-radius: 24px; cursor: pointer; font-size: 15px; font-weight: 700; font-family: inherit; transition: all 0.2s; }
        .btn-submit.disabled { background: #e0ddd5; color: #999; cursor: not-allowed; }
        .btn-submit.ready { background: linear-gradient(135deg, #2c3e50, #8e44ad, #c0392b); color: #fff; box-shadow: 0 4px 16px rgba(192,57,43,0.25); }
        .btn-submit.ready:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(192,57,43,0.35); }
      `}</style>
    </div>
  );
}
