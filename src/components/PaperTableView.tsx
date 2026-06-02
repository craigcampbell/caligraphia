"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";

interface PaperPost {
  id: string;
  postType: string;
  finalImageUrl: string | null;
  uploadedPhotoUrl: string | null;
  stampCount: number;
  createdAt: string;
  user: { id: string; username: string; nomDePlume: string | null; };
  _count: { interactions: number; scratches: number; };
}

interface Props {
  posts: PaperPost[];
  onStamp?: (id: string) => void;
  isStamping?: Set<string>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
}

function seedFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return Math.abs(h) / 0x7fffffff;
}

function computeLayout(post: PaperPost, index: number, total: number) {
  const seed = seedFromId(post.id);
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const cellW = 320;
  const cellH = 380;
  return {
    x: col * cellW + seed * 80,
    y: row * cellH + ((seed * 137) % 1) * 100,
    rotation: (seed - 0.5) * 12,
    scale: 0.6 + seed * 0.35,
  };
}

const PAPER_W = 180;
const PAPER_H = 240;

export function PaperTableView({ posts, onStamp, isStamping, onLoadMore, hasMore, loading }: Props) {
  const [pickedUp, setPickedUp] = useState<string | null>(null);
  const [panX, setPanX] = useState(200);
  const [panY, setPanY] = useState(100);
  const [draggedPositions, setDraggedPositions] = useState<Record<string, { x: number; y: number }>>({});

  const tableRef = useRef<HTMLDivElement>(null);
  const panning = useRef(false);
  const dragging = useRef(false);
  const draggingPaper = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });

  const layouts = useMemo(() => posts.map((p, i) => computeLayout(p, i, posts.length)), [posts]);

  // Load more when panned far
  const maxY = useMemo(() => Math.max(...layouts.map(l => l.y)) + 500, [layouts]);
  useEffect(() => {
    if (!hasMore || loading) return;
    if (-panY + window.innerHeight > maxY - 600 && onLoadMore) onLoadMore();
  }, [panY, maxY, hasMore, loading, onLoadMore]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    const paperEl = target.closest('[data-paper-id]') as HTMLElement | null;

    startPos.current = { x: e.clientX, y: e.clientY };
    lastPos.current = { x: e.clientX, y: e.clientY };

    if (paperEl) {
      const pid = paperEl.dataset.paperId!;
      draggingPaper.current = pid;
      dragOffset.current = {
        x: e.clientX - (draggedPositions[pid]?.x ?? layouts.find((_, i) => posts[i]?.id === pid)?.x ?? 0) - panX,
        y: e.clientY - (draggedPositions[pid]?.y ?? layouts.find((_, i) => posts[i]?.id === pid)?.y ?? 0) - panY,
      };
      dragging.current = false;
      panning.current = false;
    } else {
      draggingPaper.current = null;
      panning.current = true;
      dragging.current = false;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [panX, panY, draggedPositions, layouts, posts]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    const totalDist = Math.abs(e.clientX - startPos.current.x) + Math.abs(e.clientY - startPos.current.y);
    lastPos.current = { x: e.clientX, y: e.clientY };

    if (draggingPaper.current) {
      if (totalDist > 10) dragging.current = true;
      if (dragging.current) {
        const pid = draggingPaper.current;
        const layout = layouts.find((_, i) => posts[i]?.id === pid);
        if (layout) {
          const baseX = draggedPositions[pid]?.x ?? layout.x;
          const baseY = draggedPositions[pid]?.y ?? layout.y;
          setDraggedPositions(prev => ({
            ...prev,
            [pid]: { x: baseX + dx, y: baseY + dy },
          }));
        }
      }
    } else if (panning.current) {
      setPanX(p => p + dx);
      setPanY(p => p + dy);
    }
  }, [layouts, posts, draggedPositions]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const totalDist = Math.abs(e.clientX - startPos.current.x) + Math.abs(e.clientY - startPos.current.y);
    if (draggingPaper.current && totalDist < 10) {
      // It was a tap — open the paper
      setPickedUp(draggingPaper.current);
    }
    draggingPaper.current = null;
    dragging.current = false;
    panning.current = false;
  }, []);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div
      ref={tableRef}
      className="paper-table"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{ touchAction: "none", cursor: dragging.current ? "grabbing" : panning.current ? "grabbing" : "grab" }}
    >
      {/* Picked-up overlay */}
      {pickedUp && (() => {
        const post = posts.find(p => p.id === pickedUp);
        if (!post) return null;
        const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;
        return (
          <div className="pt-picked-overlay" onClick={() => setPickedUp(null)}>
            <div className="pt-picked-card" onClick={(e) => e.stopPropagation()}>
              <button className="pt-picked-close" onClick={() => setPickedUp(null)}>&times;</button>
              <div className="pt-picked-header">
                <Link href={`/users/${post.user.id}`} className="pt-picked-author">
                  {post.user.nomDePlume ? <img src={post.user.nomDePlume} alt="" width={20} height={20} className="pt-picked-av" /> : <span className="pt-picked-av-ph">{post.user.username[0]}</span>}
                  <span>{post.user.username}</span>
                </Link>
                <span className="pt-picked-time">{timeAgo(post.createdAt)}</span>
              </div>
              {imageUrl && <img src={imageUrl} alt="" className="pt-picked-img" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              <div className="pt-picked-actions">
                {onStamp && (
                  <button className={`pt-stamp-btn ${isStamping?.has(post.id) ? "stamped" : ""}`} onClick={() => onStamp(post.id)}>
                    {isStamping?.has(post.id) ? "⭐" : "☆"} {post.stampCount || 0}
                  </button>
                )}
                <Link href={`/post/${post.id}`} className="pt-detail-link">Open &rarr;</Link>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Surface */}
      <div className="pt-surface" style={{ transform: `translate(${panX}px, ${panY}px)`, width: Math.max(1200, posts.length * 200), height: Math.max(1200, posts.length * 250) }}>
        <div className="pt-wood-bg" />
        {posts.map((post, i) => {
          const layout = layouts[i];
          const dragPos = draggedPositions[post.id];
          const x = dragPos?.x ?? layout.x;
          const y = dragPos?.y ?? layout.y;
          const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;
          const isDragging = dragging.current && draggingPaper.current === post.id;
          return (
            <div
              key={post.id}
              data-paper-id={post.id}
              className={`pt-paper ${isDragging ? "dragging" : ""}`}
              style={{
                left: x, top: y,
                transform: `rotate(${layout.rotation}deg) scale(${layout.scale})`,
                width: PAPER_W,
                zIndex: isDragging ? 100 : 1,
              }}
            >
              <div className="pt-paper-shadow" />
              <div className="pt-paper-body">
                {imageUrl ? (
                  <div className="pt-paper-img-wrap" style={{ height: PAPER_H - 46 }}>
                    <img src={imageUrl} alt="" className="pt-paper-img" loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="pt-paper-empty" style={{ height: PAPER_H - 46 }}>&#9998;</div>
                )}
                <div className="pt-paper-footer">
                  <span className="pt-paper-author">{post.user.username}</span>
                  <span className="pt-paper-stamp">&#9733; {post.stampCount || 0}</span>
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="pt-loading" style={{ left: 600, top: 600 }}>
            <div className="pt-spinner" />
            <span>Finding more letters...</span>
          </div>
        )}
      </div>

      <style>{`
        .paper-table { position: relative; width: 100%; height: calc(100vh - 60px); overflow: hidden; background: #6b4226; background-image: repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 41px), repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(0,0,0,0.02) 60px, rgba(0,0,0,0.02) 61px), linear-gradient(135deg, #5a3a1e 0%, #7a5030 30%, #6b4226 60%, #5a3a1e 100%); user-select: none; }
        .pt-surface { position: relative; pointer-events: none; }
        .pt-wood-bg { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.03) 3px, rgba(0,0,0,0.03) 4px); pointer-events: none; }
        .pt-paper { position: absolute; cursor: grab; pointer-events: auto; transition: box-shadow 0.15s; }
        .pt-paper.dragging { cursor: grabbing; transition: none; }
        .pt-paper:hover { z-index: 10; }
        .pt-paper-shadow { position: absolute; inset: -3px; border-radius: 3px; background: rgba(0,0,0,0.12); filter: blur(5px); transition: opacity 0.2s; }
        .pt-paper:hover .pt-paper-shadow { opacity: 0.35; }
        .pt-paper-body { position: relative; background: #fefdf9; border-radius: 3px; overflow: hidden; border: 1px solid #d8c8b0; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .pt-paper-img-wrap { overflow: hidden; display: flex; align-items: center; justify-content: center; background: #faf7f0; }
        .pt-paper-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pt-paper-empty { display: flex; align-items: center; justify-content: center; font-size: 28px; color: #d0c8b8; background: #faf7f0; }
        .pt-paper-footer { display: flex; align-items: center; justify-content: space-between; padding: 5px 8px; font-size: 10px; border-top: 1px solid #f0e8d8; }
        .pt-paper-author { font-weight: 600; color: #5c4a30; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
        .pt-paper-stamp { color: #8b6914; }
        .pt-picked-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(20,18,14,0.7); display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(4px); }
        .pt-picked-card { max-width: 480px; width: 100%; max-height: 90vh; background: #fefdf9; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.4); position: relative; animation: pt-lift 0.25s ease-out; }
        @keyframes pt-lift { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
        .pt-picked-close { position: absolute; top: 8px; right: 10px; background: rgba(0,0,0,0.1); border: none; color: #fff; font-size: 22px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; font-family: inherit; }
        .pt-picked-close:hover { background: rgba(0,0,0,0.2); }
        .pt-picked-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; }
        .pt-picked-author { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #2c2416; font-weight: 600; font-size: 14px; }
        .pt-picked-av { border-radius: 50%; }
        .pt-picked-av-ph { width: 20px; height: 20px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #888; }
        .pt-picked-time { font-size: 11px; color: #b0a090; }
        .pt-picked-img { width: 100%; max-height: 55vh; object-fit: contain; display: block; background: #faf7f0; }
        .pt-picked-actions { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-top: 1px solid #f0e8d8; }
        .pt-stamp-btn { display: flex; align-items: center; gap: 5px; padding: 6px 14px; border: 1.5px solid #d0c8b8; border-radius: 18px; background: #fefdf9; cursor: pointer; font-size: 13px; font-family: inherit; color: #6b5c40; transition: all 0.15s; }
        .pt-stamp-btn:hover { border-color: #c0392b; color: #c0392b; }
        .pt-stamp-btn.stamped { background: #fff5f0; border-color: #c0392b; color: #c0392b; }
        .pt-detail-link { padding: 6px 14px; border: 1px solid #e0d5c0; border-radius: 8px; background: #fefdf9; color: #6b5c40; font-size: 12px; text-decoration: none; margin-left: auto; }
        .pt-detail-link:hover { background: #f5f0e8; }
        .pt-loading { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 8px; color: rgba(255,255,255,0.5); font-size: 13px; font-style: italic; }
        .pt-spinner { width: 24px; height: 24px; border: 2px solid rgba(255,255,255,0.2); border-top-color: rgba(255,255,255,0.6); border-radius: 50%; animation: pt-spin 0.8s linear infinite; }
        @keyframes pt-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
