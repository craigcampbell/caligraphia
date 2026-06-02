"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EnvelopeCard } from "./EnvelopeCard";
import { PaperTableView } from "./PaperTableView";
import Link from "next/link";

interface Props {
  endpoint?: string;
  emptyMessage?: string;
}

type ViewMode = "envelope" | "gallery" | "table";

export function Feed({
  endpoint = "/api/posts",
  emptyMessage = "The postbox is empty. Be the first to write a letter.",
}: Props) {
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stampingPosts, setStampingPosts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("envelope");
  const feedRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPosts = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const url = new URL(endpoint, window.location.origin);
      if (!reset && cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "10");
      const res = await fetch(url.toString());
      const data = await res.json();
      if (reset) setPosts(data.posts || []);
      else if (cursor) setPosts((prev) => [...prev, ...(data.posts || [])]);
      else setPosts(data.posts || []);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch (err) {
      console.error("Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, cursor]);

  useEffect(() => { loadPosts(); }, []);

  useEffect(() => {
    if (currentIndex >= posts.length - 3 && hasMore && !loading) loadPosts();
  }, [currentIndex, posts.length, hasMore, loading, loadPosts]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); setCurrentIndex((i) => Math.min(i + 1, posts.length - 1)); }
      if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); setCurrentIndex((i) => Math.max(i - 1, 0)); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [posts.length]);

  const handleStamp = async (postId: string) => {
    if (stampingPosts.has(postId)) return;
    setStampingPosts((prev) => new Set(prev).add(postId));
    try {
      const res = await fetch(`/api/posts/${postId}/stamp`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, stampCount: data.stampCount } : p));
      } else {
        const err = await res.json();
        alert(err.error || "Could not stamp this letter");
      }
    } catch { /* ignore */ }
    finally {
      setStampingPosts((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    }
  };

  const scrollToIndex = useCallback((idx: number) => {
    if (!feedRef.current) return;
    const cards = feedRef.current.children;
    if (cards[idx]) cards[idx].scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useEffect(() => {
    if (posts.length > 0) scrollToIndex(currentIndex);
  }, [currentIndex, posts.length, scrollToIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 60) {
      if (diff > 0) setCurrentIndex((i) => Math.min(i + 1, posts.length - 1));
      else setCurrentIndex((i) => Math.max(i - 1, 0));
    }
    touchStartRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (wheelTimeoutRef.current) return;
    wheelTimeoutRef.current = setTimeout(() => { wheelTimeoutRef.current = null; }, 500);
    if (e.deltaY > 0) setCurrentIndex((i) => Math.min(i + 1, posts.length - 1));
    else setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  if (posts.length === 0 && !loading) {
    return <div className="feed-empty-state">{emptyMessage}</div>;
  }

  return (
    <div>
      <div className="feed-view-toggle">
        <button className={`toggle-btn ${viewMode === "envelope" ? "active" : ""}`} onClick={() => setViewMode("envelope")}>
          <span className="toggle-icon">&#9993;</span> Envelopes
        </button>
        <button className={`toggle-btn ${viewMode === "gallery" ? "active" : ""}`} onClick={() => setViewMode("gallery")}>
          <span className="toggle-icon">&#128248;</span> Gallery
        </button>
        <button className={`toggle-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}>
          <span className="toggle-icon">&#128083;</span> Table
        </button>
      </div>

      {viewMode === "table" ? (
        <PaperTableView
          posts={posts}
          onStamp={handleStamp}
          isStamping={stampingPosts}
          onLoadMore={() => { if (hasMore && !loading) loadPosts(); }}
          hasMore={hasMore}
          loading={loading}
        />
      ) : (
        <div
          className={`feed-vertical feed-${viewMode}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          ref={feedRef}
        >
          {posts.map((post, idx) => (
            <div key={post.id} className={`feed-item ${idx === currentIndex ? "active" : ""}`} onClick={() => setCurrentIndex(idx)}>
              <div className="feed-counter">
                <span className="counter-current">{idx + 1}</span>
                <span className="counter-sep">/</span>
                <span className="counter-total">{posts.length}</span>
              </div>
              {viewMode === "envelope" ? (
                <EnvelopeCard post={post} onStamp={handleStamp} isStamping={stampingPosts.has(post.id)} />
              ) : (
                <GalleryCard post={post} onStamp={handleStamp} isStamping={stampingPosts.has(post.id)} />
              )}
            </div>
          ))}
          {loading && (
            <div className="feed-loading-more">
              <div className="spinner-mini" />
              <span>Loading more...</span>
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <div className="feed-end">
              <span className="feed-end-line">&#8212;</span>
              <span className="feed-end-text">No more letters</span>
              <span className="feed-end-line">&#8212;</span>
            </div>
          )}
          <style>{`
            .feed-view-toggle { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 0 16px; }
            .toggle-btn { display: flex; align-items: center; gap: 5px; padding: 7px 18px; border: 1.5px solid #e0d5c0; border-radius: 20px; background: #fefdf9; cursor: pointer; font-size: 13px; font-family: inherit; color: #8c7a60; transition: all 0.15s; }
            .toggle-btn:hover { border-color: #c0a880; color: #5c4a30; }
            .toggle-btn.active { background: #2c2416; color: #fefdf9; border-color: #2c2416; }
            .toggle-icon { font-size: 14px; }
            .feed-vertical { max-width: 600px; margin: 0 auto; padding: 0 8px 12px; scroll-behavior: smooth; }
            .feed-item { margin-bottom: 20px; transition: opacity 0.3s, transform 0.3s; }
            .feed-item.active { opacity: 1; transform: scale(1); }
            .feed-counter { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 8px; font-size: 12px; color: #b0a090; }
            .counter-current { font-weight: 700; color: #6b5c40; font-size: 14px; }
            .counter-sep { color: #d0c8b8; }
            .counter-total { color: #b0a090; }
            .feed-empty-state { text-align: center; padding: 80px 20px; color: #999; font-size: 16px; font-style: italic; }
            .feed-loading-more { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: #8c7a60; font-size: 13px; font-style: italic; }
            .spinner-mini { width: 20px; height: 20px; border: 2px solid #e0d5c0; border-top-color: #8b4513; border-radius: 50%; animation: mini-spin 0.7s linear infinite; }
            @keyframes mini-spin { to { transform: rotate(360deg); } }
            .feed-end { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 32px 16px 48px; }
            .feed-end-line { color: #d0c8b8; }
            .feed-end-text { font-size: 12px; color: #b0a090; font-style: italic; }
            .feed-gallery .feed-item { opacity: 1 !important; transform: none !important; margin-bottom: 24px; }
            .feed-gallery .feed-counter { margin-bottom: 6px; }
          `}</style>
        </div>
      )}
    </div>
  );
}

// Gallery card
function GalleryCard({ post, onStamp, isStamping }: { post: any; onStamp?: (id: string) => void; isStamping?: boolean }) {
  const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  return (
    <article className="gallery-card">
      <div className="gallery-header">
        <Link href={`/users/${post.user.id}`} className="gallery-author">
          {post.user.nomDePlume ? <img src={post.user.nomDePlume} alt="" className="gallery-av" width={24} height={24} /> : <span className="gallery-av-ph">{post.user.username[0].toUpperCase()}</span>}
          <span className="gallery-name">{post.user.username}</span>
        </Link>
        <span className="gallery-time">{timeAgo(post.createdAt)}</span>
      </div>
      {imageUrl && (
        <div className="gallery-image-wrap">
          <img src={imageUrl} alt="" className="gallery-image" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <div className="gallery-actions">
        {onStamp && (
          <button className={`gallery-stamp-btn ${isStamping ? "stamped" : ""}`} onClick={(e) => { e.stopPropagation(); onStamp(post.id); }} disabled={isStamping}>
            <span className="g-stamp-icon">{isStamping ? "⭐" : "☆"}</span>
            <span>{post.stampCount || 0}</span>
          </button>
        )}
        <Link href={`/post/${post.id}`} className="gallery-detail-link">&#9998; View details</Link>
        {post._count?.scratches > 0 && <span className="gallery-scratches">&#9998; {post._count.scratches}</span>}
      </div>
      {post.ocrHashtags?.length > 0 && (
        <div className="gallery-tags">
          {post.ocrHashtags.map((tag: string) => <span key={tag} className="gallery-tag">{tag}</span>)}
        </div>
      )}
      <style>{`
        .gallery-card { border: 1px solid #e0d5c0; border-radius: 14px; overflow: hidden; background: #fefdf9; }
        .gallery-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; }
        .gallery-author { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #2c2416; }
        .gallery-av { border-radius: 50%; object-fit: cover; }
        .gallery-av-ph { width: 24px; height: 24px; border-radius: 50%; background: #e0d5c0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #6b5c40; }
        .gallery-name { font-weight: 600; font-size: 14px; }
        .gallery-name:hover { text-decoration: underline; }
        .gallery-time { font-size: 11px; color: #b0a090; }
        .gallery-image-wrap { background: #faf7f0; display: flex; align-items: center; justify-content: center; }
        .gallery-image { width: 100%; max-height: 75vh; object-fit: contain; display: block; }
        .gallery-actions { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid #f0e8d8; }
        .gallery-stamp-btn { display: flex; align-items: center; gap: 5px; padding: 6px 14px; border: 1.5px solid #d0c8b8; border-radius: 18px; background: #fefdf9; cursor: pointer; font-size: 14px; font-family: inherit; color: #6b5c40; transition: all 0.15s; }
        .gallery-stamp-btn:hover { border-color: #c0392b; color: #c0392b; }
        .gallery-stamp-btn.stamped { background: #fff5f0; border-color: #c0392b; color: #c0392b; }
        .gallery-stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .g-stamp-icon { font-size: 15px; }
        .gallery-detail-link { padding: 6px 14px; border: 1px solid #e0d5c0; border-radius: 8px; background: #fefdf9; color: #6b5c40; font-size: 12px; text-decoration: none; }
        .gallery-detail-link:hover { background: #f5f0e8; }
        .gallery-scratches { font-size: 12px; color: #b0a090; margin-left: auto; }
        .gallery-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 14px 12px; border-top: 1px solid #f0e8d8; }
        .gallery-tag { font-size: 11px; color: #6b5c40; background: #f0e8d8; padding: 2px 10px; border-radius: 12px; }
      `}</style>
    </article>
  );
}
