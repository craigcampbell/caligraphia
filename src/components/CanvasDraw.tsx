"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const CANVAS_IDEAL_WIDTH = 1200;
const CANVAS_IDEAL_HEIGHT = 1600;

const COLORS = [
  "#000000",
  "#e53e3e",
  "#3182ce",
  "#38a169",
  "#805ad5",
  "#dd6b20",
  "#d53f8c",
  "#6b46c1",
];

interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
}

interface Props {
  onComplete: (strokes: StrokePoint[]) => void;
  onCancel: () => void;
  minDrawTimeMs?: number;
}

export function CanvasDraw({
  onComplete,
  onCancel,
  minDrawTimeMs = 15000,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

  const strokesRef = useRef<StrokePoint[]>([]);
  const drawStartRef = useRef<number | null>(null);
  const lastPointTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = Math.max(parent.clientHeight * 0.85, 400);
      const scale = Math.min(w / CANVAS_IDEAL_WIDTH, h / CANVAS_IDEAL_HEIGHT);
      canvas.width = CANVAS_IDEAL_WIDTH;
      canvas.height = CANVAS_IDEAL_HEIGHT;
      canvas.style.width = `${CANVAS_IDEAL_WIDTH * scale}px`;
      canvas.style.height = `${CANVAS_IDEAL_HEIGHT * scale}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const getCanvasCoords = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    },
    []
  );

  const drawPoint = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { x, y } = getCanvasCoords(e);
      const pressure = e.pressure || 0.5;
      const now = Date.now();

      if (!drawStartRef.current) {
        drawStartRef.current = now;
      }

      lastPointTimeRef.current = now;
      strokesRef.current.push({
        time: now,
        x,
        y,
        pressure,
        color: selectedColor,
      });

      const px = x * canvas.width;
      const py = y * canvas.height;
      const radius = Math.max(1, pressure * 8);

      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = selectedColor;
      ctx.fill();
    },
    [getCanvasCoords, selectedColor]
  );

  useEffect(() => {
    if (!drawing) return;

    const interval = setInterval(() => {
      if (!drawStartRef.current) return;
      const totalElapsed = Date.now() - drawStartRef.current;
      setElapsed(totalElapsed);
      if (totalElapsed >= minDrawTimeMs) {
        setCanSubmit(true);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [drawing, minDrawTimeMs]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setDrawing(true);
    drawPoint(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.preventDefault();
    drawPoint(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setDrawing(false);
    drawStartRef.current = null;
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const strokes = strokesRef.current;
    if (strokes.length < 2) return;

    const minTime = Math.min(...strokes.map((s) => s.time));
    const maxTime = Math.max(...strokes.map((s) => s.time));
    const duration = maxTime - minTime;

    if (duration < minDrawTimeMs) return;

    onComplete(strokes);
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${s}s`;
  };

  return (
    <div className="canvas-container">
      <div className="canvas-toolbar">
        <div className="color-picker">
          {COLORS.map((color) => (
            <button
              key={color}
              className={`color-swatch ${selectedColor === color ? "active" : ""}`}
              onClick={() => setSelectedColor(color)}
              style={{ backgroundColor: color }}
              aria-label={`Color ${color}`}
            />
          ))}
        </div>

        <div className="canvas-info">
          <span className={`timer ${canSubmit ? "ready" : ""}`}>
            {canSubmit ? "Ready" : `Wait ${formatTime(minDrawTimeMs - elapsed)}`}
          </span>
          <span className="stroke-label">
            {strokesRef.current.length} points
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="draw-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{ touchAction: "none" }}
      />

      <div className="canvas-actions">
        <button onClick={onCancel} className="btn-cancel">
          Discard
        </button>
        <button
          onClick={handleSubmit}
          className={`btn-submit ${canSubmit ? "ready" : "disabled"}`}
          disabled={!canSubmit}
        >
          {canSubmit ? "Submit Drawing" : `Wait ${formatTime(Math.max(0, minDrawTimeMs - elapsed))}`}
        </button>
      </div>

      <style>{`
        .canvas-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
        }
        .canvas-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 600px;
          padding: 0 8px;
        }
        .color-picker {
          display: flex;
          gap: 6px;
        }
        .color-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          padding: 0;
          transition: transform 0.15s;
        }
        .color-swatch.active {
          border-color: #111;
          transform: scale(1.2);
        }
        .color-swatch:hover {
          transform: scale(1.15);
        }
        .canvas-info {
          display: flex;
          gap: 12px;
          align-items: center;
          font-size: 14px;
          color: #888;
        }
        .timer.ready {
          color: #38a169;
          font-weight: 600;
        }
        .stroke-label {
          color: #aaa;
        }
        .draw-canvas {
          border: 2px solid #ddd;
          border-radius: 8px;
          cursor: crosshair;
          background: #fff;
        }
        .canvas-actions {
          display: flex;
          gap: 16px;
          padding: 8px;
        }
        .btn-cancel {
          padding: 12px 28px;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 16px;
          font-weight: 500;
          font-family: inherit;
        }
        .btn-cancel:hover {
          background: #f5f5f5;
        }
        .btn-submit {
          padding: 12px 28px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          font-family: inherit;
          transition: background 0.2s, color 0.2s;
        }
        .btn-submit.disabled {
          background: #e0e0e0;
          color: #999;
          cursor: not-allowed;
        }
        .btn-submit.ready {
          background: #111;
          color: #fff;
        }
        .btn-submit.ready:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}
