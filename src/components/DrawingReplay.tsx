"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { renderSegment, drawDot } from "@/lib/ink-engine";

// Same canvas size and ink engine the letter was written with
const CANVAS_W = 2400;
const CANVAS_H = 3200;

const PAPER_BG: Record<string, string> = {
  blank: "#ffffff", ruled: "#fdfcf8", graph: "#fdfdfd",
  watercolor: "#faf6f0", vellum: "#f5f0e8", midnight: "#0d0d1a",
};

interface ReplayPoint {
  time: number; x: number; y: number; pressure: number; color: string; ink?: string;
}

interface Props {
  strokes: ReplayPoint[];
  paper?: string;
  inkStyle?: string;
  onClose: () => void;
}

export function DrawingReplay({ strokes, paper = "blank", inkStyle = "standard", onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [speed, setSpeed] = useState(3); // 3x default
  const [done, setDone] = useState(false);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const drawnIdxRef = useRef<number>(0);

  const sorted = [...strokes].sort((a, b) => a.time - b.time);
  const totalDuration = sorted.length > 0 ? sorted[sorted.length - 1].time - sorted[0].time : 5000;

  const drawBg = useCallback((ctx: CanvasRenderingContext2D) => {
    const bg = PAPER_BG[paper] || "#ffffff";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (paper === "midnight") {
      const sd = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      for (let i = 0; i < sd.data.length; i += 4) {
        if (Math.random() < 0.0005) { sd.data[i] = 255; sd.data[i+1] = 255; sd.data[i+2] = 255; sd.data[i+3] = 40 + Math.random() * 80; }
      }
      ctx.putImageData(sd, 0, 0);
    }
  }, [paper]);

  const replay = useCallback((timestamp: number) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;
    const elapsed = (timestamp - startTimeRef.current) * speed;
    const targetTime = sorted[0]?.time || 0;
    const maxTime = targetTime + elapsed;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let lastDrawn = drawnIdxRef.current;
    for (let i = lastDrawn; i < sorted.length; i++) {
      const p = sorted[i];
      if (p.time > maxTime) break;
      const px = p.x * CANVAS_W;
      const py = p.y * CANVAS_H;
      const ink = p.ink || inkStyle;
      if (i > 0 && p.time - sorted[i-1].time < 300) {
        renderSegment(ctx, ink, sorted[i-1].x * CANVAS_W, sorted[i-1].y * CANVAS_H, px, py, sorted[i-1].pressure, p.pressure, p.color);
      } else {
        drawDot(ctx, ink, px, py, p.pressure, p.color);
      }
      lastDrawn = i + 1;
    }
    drawnIdxRef.current = lastDrawn;

    const pct = Math.min(100, (elapsed / totalDuration) * 100);
    setProgress(pct);

    if (lastDrawn >= sorted.length) {
      setPlaying(false);
      setDone(true);
      return;
    }
    animRef.current = requestAnimationFrame(replay);
  }, [sorted, inkStyle, totalDuration, speed]);

  const startReplay = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset
    drawnIdxRef.current = 0;
    startTimeRef.current = 0;
    drawBg(ctx);
    setPlaying(true);
    setDone(false);
    setProgress(0);
    animRef.current = requestAnimationFrame(replay);
  };

  const pauseReplay = () => {
    setPlaying(false);
    if (animRef.current) cancelAnimationFrame(animRef.current);
  };

  useEffect(() => {
    // Set up canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const pw = parent.clientWidth;
    const scale = Math.min(pw / CANVAS_W, 500 / CANVAS_H);
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    canvas.style.width = `${CANVAS_W * scale}px`;
    canvas.style.height = `${CANVAS_H * scale}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) drawBg(ctx);

    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [drawBg]);

  return (
    <div className="replay-overlay">
      <div className="replay-header">
        <span className="replay-title">&#9654; Watching this letter being written</span>
        <div className="replay-controls">
          <div className="speed-control">
            {[1, 2, 3, 5, 10].map((s) => (
              <button
                key={s}
                className={`speed-btn ${speed === s ? "active" : ""}`}
                onClick={() => { if (!playing) { setSpeed(s); } else { pauseReplay(); setSpeed(s); } }}
              >{s}x</button>
            ))}
          </div>
          <button
            className="replay-play-btn"
            onClick={playing ? pauseReplay : startReplay}
          >
            {playing ? "❚❚" : done ? "↻ Replay" : "▶"}
          </button>
          <button onClick={onClose} className="replay-close-btn">Done</button>
        </div>
      </div>

      <div className="replay-canvas-wrap">
        <canvas ref={canvasRef} className="replay-canvas" />
        {!playing && !done && (
          <div className="replay-overlay-msg">
            <span className="replay-msg-icon">&#9654;</span>
            <span>Press play to watch this letter come to life</span>
          </div>
        )}
        {done && (
          <div className="replay-overlay-msg completed">
            <span>Letter complete &mdash; {Math.round(totalDuration / 1000)}s of writing</span>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="replay-progress">
        <div className="replay-progress-bar" style={{ width: `${progress}%` }} />
      </div>

      <div className="replay-footer">
        <span className="replay-stroke-count">{drawnIdxRef.current} / {sorted.length} strokes</span>
        <span className="replay-stats">
          {paper} &middot; {inkStyle} ink &middot; {Math.round(totalDuration / 1000)}s original
        </span>
      </div>

      <style>{`
        .replay-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(20,18,14,0.95);
          display: flex; flex-direction: column;
        }
        .replay-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; background: #1a1814;
          color: #e0d5c0; border-bottom: 1px solid #2a2418;
        }
        .replay-title { font-size: 14px; font-weight: 600; }
        .replay-controls { display: flex; align-items: center; gap: 10px; }
        .speed-control { display: flex; gap: 3px; }
        .speed-btn {
          padding: 4px 10px; border: 1px solid #3a3428; border-radius: 4px;
          background: transparent; color: #8c7a60; cursor: pointer;
          font-size: 11px; font-family: inherit; transition: all 0.1s;
        }
        .speed-btn.active { background: #8b4513; color: #fff; border-color: #8b4513; }
        .speed-btn:hover { border-color: #6b5c40; }
        .replay-play-btn {
          padding: 6px 16px; border: none; border-radius: 8px;
          background: #1a1a1a; color: #fff;
          cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 600;
        }
        .replay-close-btn {
          padding: 6px 14px; border: 1px solid #3a3428; border-radius: 6px;
          background: transparent; color: #8c7a60; cursor: pointer;
          font-size: 12px; font-family: inherit;
        }
        .replay-close-btn:hover { color: #e0d5c0; border-color: #6b5c40; }
        .replay-canvas-wrap {
          flex: 1; display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .replay-canvas {
          border-radius: 4px; box-shadow: 0 4px 40px rgba(0,0,0,0.4);
          max-width: 95%; max-height: 85vh;
        }
        .replay-overlay-msg {
          position: absolute; display: flex; align-items: center; gap: 10px;
          color: rgba(224,213,192,0.4); font-size: 15px; font-style: italic;
          pointer-events: none;
        }
        .replay-msg-icon { font-size: 28px; }
        .replay-overlay-msg.completed { color: rgba(39,174,96,0.6); }
        .replay-progress {
          height: 3px; background: #2a2418;
        }
        .replay-progress-bar {
          height: 100%; background: #1a1a1a;
          transition: width 0.1s linear;
        }
        .replay-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 16px; background: #1a1814;
          color: #5c4a30; font-size: 11px; border-top: 1px solid #2a2418;
        }
        .replay-stats { color: #4a3a20; }
      `}</style>
    </div>
  );
}
