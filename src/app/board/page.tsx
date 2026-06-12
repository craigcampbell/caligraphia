"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { DailyPromptCard } from "@/components/DailyPromptCard";

interface BoardPost {
  id: string;
  postType: string;
  finalImageUrl: string | null;
  uploadedPhotoUrl: string | null;
  stampCount: number;
  createdAt: string;
  user: { id: string; username: string; nomDePlume: string | null };
  _count?: { scratches: number; comments: number };
}

// The board grows rightward, column by column, like a wall that never runs out.
const ROWS = 3;
const CELL_W = 290;
const CELL_H = 300;
const BOARD_PAD = 60;
const PIN_COLORS = ["#c0392b", "#2471a3", "#1e8449", "#b7950b", "#884ea0", "#34495e"];

function seedFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return Math.abs(h) / 0x7fffffff;
}

function layoutFor(post: BoardPost, index: number) {
  const seed = seedFromId(post.id);
  // Slot 0 belongs to the daily prompt card
  const slot = index + 1;
  const col = Math.floor(slot / ROWS);
  const row = slot % ROWS;
  return {
    x: BOARD_PAD + col * CELL_W + seed * 50,
    y: BOARD_PAD + row * CELL_H + ((seed * 7919) % 1) * 60,
    rotation: (seed - 0.5) * 7,
    pin: PIN_COLORS[Math.floor(seed * 7919) % PIN_COLORS.length],
  };
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function BoardPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<BoardPost | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const viewportRef = useRef<HTMLDivElement>(null);
  const panning = useRef(false);
  const moved = useRef(0);
  const lastPos = useRef({ x: 0, y: 0 });
  const loadingRef = useRef(false);

  const loadMore = useCallback(async (cur: string | null) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?limit=50${cur ? `&cursor=${cur}` : ""}`);
      if (!res.ok) return;
      const data = await res.json();
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...data.posts.filter((p: BoardPost) => !seen.has(p.id))];
      });
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {
      // ignore
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMore(null);
  }, [loadMore]);

  const layouts = useMemo(() => posts.map((p, i) => layoutFor(p, i)), [posts]);
  const boardWidth = BOARD_PAD * 2 + Math.ceil((Math.max(posts.length, 1) + 1) / ROWS) * CELL_W + 240;
  const boardHeight = BOARD_PAD * 2 + ROWS * CELL_H + 80;

  const clampPan = useCallback((x: number, y: number) => {
    const vp = viewportRef.current;
    const vw = vp?.clientWidth ?? 1200;
    const vh = vp?.clientHeight ?? 800;
    return {
      // allow a little overscroll past the last column so the edge feels physical
      x: Math.min(0, Math.max(-(boardWidth - vw + 200), x)),
      y: Math.min(0, Math.max(Math.min(0, -(boardHeight - vh)), y)),
    };
  }, [boardWidth, boardHeight]);

  // Fetch the next page when the pan approaches the board's right edge
  useEffect(() => {
    if (!hasMore || loading) return;
    const vw = viewportRef.current?.clientWidth ?? 1200;
    if (-pan.x + vw > boardWidth - CELL_W * 2) {
      loadMore(cursor);
    }
  }, [pan, boardWidth, hasMore, loading, cursor, loadMore]);

  const onPointerDown = (e: React.PointerEvent) => {
    panning.current = true;
    moved.current = 0;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panning.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    moved.current += Math.abs(dx) + Math.abs(dy);
    lastPos.current = { x: e.clientX, y: e.clientY };
    setPan((p) => clampPan(p.x + dx, p.y + dy));
  };

  const onPointerUp = () => {
    panning.current = false;
  };

  const onWheel = (e: React.WheelEvent) => {
    // scroll walks you along the wall
    setPan((p) => clampPan(p.x - (e.deltaY + e.deltaX) * 1.2, p.y));
  };

  const handlePaperClick = (post: BoardPost) => {
    if (moved.current > 8) return; // it was a drag, not a click
    setPicked(post);
  };

  return (
    <AuthGuard>
      <NavBar />
      <div
        ref={viewportRef}
        className="cork-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <div className="cork-hud">
          <h1 className="cork-title">The Notice Board</h1>
          <p className="cork-sub">everyone&apos;s letters &amp; doodles, pinned along one long wall — drag or scroll to wander</p>
        </div>

        <div
          className="cork-surface"
          style={{
            width: boardWidth,
            height: boardHeight,
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          <div style={{ position: "absolute", left: BOARD_PAD + 10, top: BOARD_PAD + 30 }}>
            <DailyPromptCard pinned />
          </div>
          {posts.map((post, i) => {
            const L = layouts[i];
            const img = post.finalImageUrl || post.uploadedPhotoUrl;
            return (
              <div
                key={post.id}
                className="cork-paper"
                style={{ left: L.x, top: L.y, transform: `rotate(${L.rotation}deg)` }}
                onClick={() => handlePaperClick(post)}
              >
                <span className="cork-pin" style={{ background: L.pin }} />
                {img ? (
                  <img src={img} alt="" className="cork-paper-img" loading="lazy" draggable={false}
                    onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
                ) : (
                  <div className="cork-paper-img cork-paper-empty">&#9998;</div>
                )}
                <div className="cork-paper-foot">
                  <span className="cork-paper-author">{post.user.username}</span>
                  <span className="cork-paper-time">{timeAgo(post.createdAt)}</span>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="cork-loading" style={{ left: boardWidth - 200, top: boardHeight / 2 }}>
              pinning more&hellip;
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div className="cork-endnote" style={{ left: boardWidth - 220, top: boardHeight / 2 - 40 }}>
              <p>The board ends here&hellip; for now.</p>
              <Link href="/post/new" className="cork-end-cta" onPointerDown={(e) => e.stopPropagation()}>&#9998; Pin something</Link>
            </div>
          )}
        </div>

        {posts.length === 0 && !loading && (
          <div className="cork-empty-state">
            <p>Nothing is pinned up yet.</p>
            <Link href="/post/new" className="cork-end-cta">&#9998; Be the first</Link>
          </div>
        )}

        {picked && (() => {
          const img = picked.finalImageUrl || picked.uploadedPhotoUrl;
          return (
            <div className="cork-modal-bg" onClick={() => setPicked(null)} onPointerDown={(e) => e.stopPropagation()}>
              <div className="cork-modal" onClick={(e) => e.stopPropagation()}>
                <button className="cork-modal-close" onClick={() => setPicked(null)}>&times;</button>
                <div className="cork-modal-head">
                  <Link href={`/users/${picked.user.id}`} className="cork-modal-author">
                    {picked.user.username}
                  </Link>
                  <span className="cork-modal-time">{timeAgo(picked.createdAt)} ago</span>
                </div>
                {img && <img src={img} alt="" className="cork-modal-img" />}
                <div className="cork-modal-foot">
                  <span className="cork-modal-stamps">&#9733; {picked.stampCount || 0}</span>
                  {picked._count && <span className="cork-modal-ps">P.S. &times; {picked._count.comments ?? 0}</span>}
                  <Link href={`/post/${picked.id}`} className="cork-modal-open">Open &rarr;</Link>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <style>{`
        .cork-viewport {
          position: relative; height: calc(100vh - 61px); overflow: hidden;
          cursor: grab; user-select: none; touch-action: none;
          background:
            radial-gradient(circle at 20% 30%, rgba(120,80,40,0.25), transparent 50%),
            radial-gradient(circle at 75% 65%, rgba(90,60,30,0.2), transparent 55%),
            #b08d57;
        }
        .cork-viewport:active { cursor: grabbing; }
        .cork-hud {
          position: absolute; top: 14px; left: 22px; z-index: 40; pointer-events: none;
        }
        .cork-title {
          font-size: 24px; font-weight: 700; color: #3b2a16;
          text-shadow: 0 1px 0 rgba(255,245,225,0.4);
        }
        .cork-sub { font-size: 12px; font-style: italic; color: rgba(59,42,22,0.75); }
        .cork-surface {
          position: relative; will-change: transform;
          background-image:
            radial-gradient(rgba(70,45,20,0.13) 1.2px, transparent 1.3px),
            radial-gradient(rgba(255,235,200,0.09) 1px, transparent 1.1px),
            linear-gradient(105deg, rgba(0,0,0,0.05) 0%, transparent 12%, rgba(0,0,0,0.04) 47%, transparent 60%, rgba(0,0,0,0.06) 100%);
          background-size: 17px 17px, 23px 23px, 100% 100%;
          border-right: 14px solid #6e4b26;
          box-shadow: inset 0 0 80px rgba(60,35,10,0.25);
        }
        .cork-paper {
          position: absolute; width: 200px; background: #fefdf9;
          border-radius: 2px; padding: 7px 7px 0;
          box-shadow: 0 6px 14px rgba(40,22,5,0.35), 0 1px 3px rgba(40,22,5,0.3);
          cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .cork-paper:hover {
          transform: rotate(0deg) scale(1.04) !important;
          box-shadow: 0 14px 30px rgba(40,22,5,0.45);
          z-index: 20;
        }
        .cork-pin {
          position: absolute; top: -7px; left: 50%; margin-left: -7px;
          width: 14px; height: 14px; border-radius: 50%;
          box-shadow: inset -2px -2px 3px rgba(0,0,0,0.35), inset 2px 2px 3px rgba(255,255,255,0.35), 0 3px 4px rgba(30,15,0,0.45);
          z-index: 2;
        }
        .cork-paper-img {
          width: 100%; aspect-ratio: 4 / 5; object-fit: cover; display: block; background: #f7f3ea;
        }
        .cork-paper-empty {
          display: flex; align-items: center; justify-content: center;
          font-size: 26px; color: #d0c8b8;
        }
        .cork-paper-foot {
          display: flex; justify-content: space-between; align-items: center;
          padding: 5px 2px 6px; font-size: 10px;
        }
        .cork-paper-author { font-weight: 700; color: #5c4a30; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cork-paper-time { color: #b0a090; }
        .cork-loading, .cork-endnote {
          position: absolute; color: rgba(59,42,22,0.7); font-style: italic; font-size: 13px;
        }
        .cork-endnote { text-align: center; width: 180px; }
        .cork-end-cta {
          display: inline-block; margin-top: 10px; padding: 9px 18px; border-radius: 8px;
          background: #fefdf9; color: #3b2a16; font-weight: 700; font-style: normal;
          font-size: 13px; box-shadow: 0 4px 12px rgba(40,22,5,0.3); text-decoration: none;
        }
        .cork-empty-state {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 4px;
          color: rgba(59,42,22,0.8); font-style: italic; font-size: 15px;
        }
        .cork-modal-bg {
          position: fixed; inset: 0; z-index: 500; background: rgba(25,16,6,0.7);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          backdrop-filter: blur(3px); cursor: default;
        }
        .cork-modal {
          max-width: 480px; width: 100%; max-height: 90vh; overflow: hidden;
          background: #fefdf9; border-radius: 6px; position: relative;
          box-shadow: 0 24px 70px rgba(0,0,0,0.5);
          animation: cork-unpin 0.22s ease-out;
        }
        @keyframes cork-unpin {
          from { transform: scale(0.92) rotate(-1.5deg); opacity: 0; }
          to { transform: scale(1) rotate(0); opacity: 1; }
        }
        .cork-modal-close {
          position: absolute; top: 8px; right: 10px; z-index: 5;
          width: 30px; height: 30px; border-radius: 50%; border: none;
          background: rgba(0,0,0,0.12); color: #fff; font-size: 20px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-family: inherit;
        }
        .cork-modal-head {
          display: flex; justify-content: space-between; align-items: center; padding: 12px 16px;
        }
        .cork-modal-author { font-weight: 700; font-size: 14px; color: #2c2416; text-decoration: none; }
        .cork-modal-time { font-size: 11px; color: #b0a090; }
        .cork-modal-img { width: 100%; max-height: 60vh; object-fit: contain; background: #f7f3ea; display: block; }
        .cork-modal-foot {
          display: flex; align-items: center; gap: 14px; padding: 12px 16px;
          border-top: 1px solid #f0e8d8; font-size: 13px; color: #8b6914;
        }
        .cork-modal-ps { color: #8c7a60; font-size: 12px; }
        .cork-modal-open {
          margin-left: auto; padding: 6px 14px; border: 1px solid #e0d5c0; border-radius: 8px;
          color: #6b5c40; font-size: 12px; text-decoration: none;
        }
        .cork-modal-open:hover { background: #f5f0e8; }
      `}</style>
    </AuthGuard>
  );
}
