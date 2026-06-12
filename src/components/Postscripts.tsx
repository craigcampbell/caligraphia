"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";

// Matches COMMENT_WIDTH x COMMENT_HEIGHT on the server
const ASPECT = 420 / 1200;
const INK = "#2c2436";

interface StrokePoint {
  time: number;
  x: number;
  y: number;
  pressure: number;
  color: string;
}

export interface PostscriptComment {
  id: string;
  imageUrl: string;
  createdAt: string;
  user: { id: string; username: string; nomDePlume: string | null };
}

interface Props {
  // REST endpoint speaking the { comments } / { comment } shape
  endpoint: string;
  initialComments?: PostscriptComment[];
  title?: string;
  addLabel?: string;
  emptyText?: string;
  composerLabel?: string;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Postscripts({
  endpoint,
  initialComments,
  title = "Postscripts",
  addLabel = "Add a P.S.",
  emptyText = "No postscripts yet — scribble the first one.",
  composerLabel = "P.S. — in your own hand",
}: Props) {
  const [comments, setComments] = useState<PostscriptComment[]>(initialComments || []);
  const [composing, setComposing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // No server-provided list: fetch our own
  const needsFetch = initialComments === undefined;
  useEffect(() => {
    if (!needsFetch) return;
    fetch(endpoint)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setComments(d.comments || []))
      .catch(() => {});
  }, [needsFetch, endpoint]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<StrokePoint[][]>([]);
  const currentStroke = useRef<StrokePoint[]>([]);
  const drawing = useRef(false);
  const startedAt = useRef(0);
  const [strokeCount, setStrokeCount] = useState(0);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = drawing.current
      ? [...strokesRef.current, currentStroke.current]
      : strokesRef.current;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    for (const stroke of all) {
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1];
        const b = stroke[i];
        ctx.lineWidth = Math.max(1.2, ((a.pressure + b.pressure) / 2) * 4.5);
        ctx.beginPath();
        ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
        ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
        ctx.stroke();
      }
      if (stroke.length === 1) {
        const p = stroke[0];
        ctx.beginPath();
        ctx.arc(p.x * canvas.width, p.y * canvas.height, Math.max(1, p.pressure * 3), 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
      }
    }
  }, []);

  const pointFromEvent = (e: React.PointerEvent<HTMLCanvasElement>): StrokePoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    if (!startedAt.current) startedAt.current = Date.now();
    return {
      time: Math.max(1, Date.now() - startedAt.current + 1),
      x,
      y,
      pressure: e.pressure && e.pressure > 0 ? Math.min(1, e.pressure) : 0.5,
      color: INK,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (!p) return;
    drawing.current = true;
    currentStroke.current = [p];
    redraw();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const p = pointFromEvent(e);
    if (!p) return;
    currentStroke.current.push(p);
    redraw();
  };

  const handlePointerUp = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (currentStroke.current.length > 0) {
      strokesRef.current.push(currentStroke.current);
      setStrokeCount(strokesRef.current.length);
    }
    currentStroke.current = [];
    redraw();
  };

  const undoStroke = () => {
    strokesRef.current.pop();
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const clearStrokes = () => {
    strokesRef.current = [];
    currentStroke.current = [];
    setStrokeCount(0);
    startedAt.current = 0;
    redraw();
  };

  const submit = async () => {
    const flat = strokesRef.current.flat();
    if (flat.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_stroke_data: flat,
          drawing_duration_ms: startedAt.current ? Date.now() - startedAt.current : 0,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [...prev, data.comment]);
        clearStrokes();
        setComposing(false);
      } else {
        setError(data.error || "Failed to add your postscript");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="ps-section">
      <div className="ps-head">
        <h3 className="ps-title">
          {title} {comments.length > 0 && <span className="ps-count">({comments.length})</span>}
        </h3>
        {!composing && addLabel && (
          <button className="ps-add-btn" onClick={() => setComposing(true)}>
            &#9998; {addLabel}
          </button>
        )}
      </div>

      {comments.length === 0 && !composing && (
        <p className="ps-empty">{emptyText}</p>
      )}

      <div className="ps-list">
        {comments.map((c) => (
          <div key={c.id} className="ps-card">
            <img src={c.imageUrl} alt={`Postscript by ${c.user.username}`} className="ps-img" loading="lazy" />
            <div className="ps-meta">
              <Link href={`/users/${c.user.id}`} className="ps-author">
                {c.user.nomDePlume ? (
                  <img src={c.user.nomDePlume} alt="" width={18} height={18} className="ps-av" />
                ) : (
                  <span className="ps-av-ph">{c.user.username[0].toUpperCase()}</span>
                )}
                {c.user.username}
              </Link>
              <span className="ps-time">{timeAgo(c.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {composing && (
        <div className="ps-composer">
          <div className="ps-composer-label">{composerLabel}</div>
          <canvas
            ref={canvasRef}
            width={840}
            height={840 * ASPECT}
            className="ps-canvas"
            style={{ touchAction: "none", aspectRatio: `1200 / 420` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {error && <div className="ps-error">{error}</div>}
          <div className="ps-composer-actions">
            <button className="ps-tool-btn" onClick={undoStroke} disabled={strokeCount === 0}>Undo</button>
            <button className="ps-tool-btn" onClick={clearStrokes} disabled={strokeCount === 0}>Clear</button>
            <span className="ps-spacer" />
            <button className="ps-tool-btn" onClick={() => { clearStrokes(); setComposing(false); setError(""); }}>Cancel</button>
            <button className="ps-submit-btn" onClick={submit} disabled={submitting || strokeCount === 0}>
              {submitting ? "Posting..." : "Pin it"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .ps-section { margin-top: 28px; padding-top: 22px; border-top: 1px solid #eee; }
        .ps-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .ps-title { font-size: 16px; font-weight: 600; color: #2c2416; }
        .ps-count { font-weight: 400; color: #a09080; }
        .ps-add-btn {
          padding: 7px 16px; border: 1.5px solid #d0c8b8; border-radius: 8px;
          background: #fefdf9; color: #5c4a30; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 600;
        }
        .ps-add-btn:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .ps-empty { font-size: 13px; font-style: italic; color: #a09080; margin-bottom: 8px; }
        .ps-list { display: flex; flex-direction: column; gap: 14px; }
        .ps-card {
          background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 4px;
          overflow: hidden; box-shadow: 0 1px 4px rgba(60,40,20,0.05);
        }
        .ps-img { width: 100%; display: block; background: #fff; }
        .ps-meta {
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 10px; border-top: 1px solid #f0e8d8;
        }
        .ps-author {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: #5c4a30; text-decoration: none;
        }
        .ps-av { border-radius: 50%; object-fit: cover; }
        .ps-av-ph {
          width: 18px; height: 18px; border-radius: 50%; background: #e0d5c0;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 9px; font-weight: 700; color: #5c4a30;
        }
        .ps-time { font-size: 11px; color: #b0a090; }
        .ps-composer {
          margin-top: 14px; border: 1.5px dashed #d0c8b8; border-radius: 6px;
          padding: 12px; background: #fefdf9;
        }
        .ps-composer-label { font-size: 12px; font-style: italic; color: #8c7a60; margin-bottom: 8px; }
        .ps-canvas {
          width: 100%; display: block; background: #fff;
          border: 1px solid #e8dcc8; border-radius: 3px; cursor: crosshair;
          background-image: repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(135,180,220,0.25) 27px, rgba(135,180,220,0.25) 28px);
        }
        .ps-error { margin-top: 8px; font-size: 12px; color: #c0392b; }
        .ps-composer-actions { display: flex; gap: 8px; margin-top: 10px; align-items: center; }
        .ps-spacer { flex: 1; }
        .ps-tool-btn {
          padding: 6px 14px; border: 1px solid #d0c8b8; border-radius: 6px;
          background: #fff; color: #6b5c40; cursor: pointer; font-family: inherit; font-size: 12px;
        }
        .ps-tool-btn:disabled { opacity: 0.4; cursor: default; }
        .ps-tool-btn:hover:not(:disabled) { border-color: #8b6948; color: #2c2416; }
        .ps-submit-btn {
          padding: 6px 18px; border: none; border-radius: 6px;
          background: #1a1a1a; color: #fff; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 600;
        }
        .ps-submit-btn:disabled { opacity: 0.5; cursor: default; }
      `}</style>
    </section>
  );
}
