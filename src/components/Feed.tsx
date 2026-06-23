"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EnvelopeCard } from "./EnvelopeCard";
import { PaperTableView } from "./PaperTableView";
import Link from "next/link";
import { EnvelopeIcon, CameraIcon, ScratchIcon, PencilIcon } from "./Icons";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmModal } from "./ConfirmModal";
import { LetterLightbox } from "./LetterViewer";

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
  const [stampingPosts, setStampingPosts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>("envelope");
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [pendingTakeDown, setPendingTakeDown] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const keyIndexRef = useRef(0);
  const { user } = useAuth();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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

  // Load more when the tail of the feed scrolls into view
  useEffect(() => {
    const feedEl = feedRef.current;
    if (!feedEl || !hasMore || loading) return;
    const items = feedEl.querySelectorAll(".feed-item");
    const sentinel = items[items.length - 1];
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadPosts(); },
      { rootMargin: "600px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [posts.length, hasMore, loading, loadPosts]);

  // j/k to hop between letters; never intercept normal scrolling keys
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key !== "j" && e.key !== "k") return;
      const cards = feedRef.current?.querySelectorAll(".feed-item");
      if (!cards || cards.length === 0) return;
      const next = e.key === "j"
        ? Math.min(keyIndexRef.current + 1, cards.length - 1)
        : Math.max(keyIndexRef.current - 1, 0);
      keyIndexRef.current = next;
      cards[next].scrollIntoView({ behavior: "smooth", block: "center" });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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

  // Take down one of your own open letters straight from the line. Confirmation
  // is handled by the in-app ConfirmModal; this runs once confirmed.
  const handleTakeDown = async (postId: string) => {
    if (removing.has(postId)) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setRemoving((prev) => new Set(prev).add(postId));
    await new Promise((r) => setTimeout(r, reduce ? 150 : 520));
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        return;
      }
      const data = await res.json().catch(() => null);
      setToast(data?.error || "Could not take this letter down.");
    } catch {
      setToast("Could not take this letter down.");
    } finally {
      setRemoving((prev) => { const next = new Set(prev); next.delete(postId); return next; });
    }
  };

  if (posts.length === 0 && !loading) {
    // Self-contained styles: the .feed-empty-state CSS below lives inside the
    // populated branch's <style>, which isn't mounted when the feed is empty.
    return (
      <div
        style={{
          textAlign: "center",
          maxWidth: 600,
          margin: "0 auto",
          padding: "80px 20px",
          color: "#999",
          fontSize: 16,
          fontStyle: "italic",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      <ConfirmModal
        open={!!pendingTakeDown}
        title="Take this letter down?"
        message="It'll be crumpled up and removed from the line. You can restore it from the admin panel if needed."
        confirmLabel="Take it down"
        danger
        onCancel={() => setPendingTakeDown(null)}
        onConfirm={() => { const id = pendingTakeDown; setPendingTakeDown(null); if (id) handleTakeDown(id); }}
      />
      {toast && (
        <div className="feed-toast" role="status" onClick={() => setToast(null)}>{toast}</div>
      )}
      <div className="feed-view-toggle">
        <button className={`toggle-btn ${viewMode === "envelope" ? "active" : ""}`} onClick={() => setViewMode("envelope")}>
          <EnvelopeIcon size={14} /> Envelopes
        </button>
        <button className={`toggle-btn ${viewMode === "gallery" ? "active" : ""}`} onClick={() => setViewMode("gallery")}>
          <CameraIcon size={14} /> Gallery
        </button>
        <button className={`toggle-btn ${viewMode === "table" ? "active" : ""}`} onClick={() => setViewMode("table")}>
          <PencilIcon size={14} /> Table
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
        <div className={`feed-vertical feed-${viewMode}`} ref={feedRef}>
          {posts.map((post) => {
            const mine = !!user && post.user?.id === user.id;
            return (
              <div
                key={post.id}
                className={`feed-item${removing.has(post.id) ? " taking-down" : ""}`}
              >
                {mine && (
                  <button
                    className="take-down-btn"
                    title="Take this letter down"
                    aria-label="Take this letter down"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPendingTakeDown(post.id); }}
                    disabled={removing.has(post.id)}
                  >
                    &#128465;
                  </button>
                )}
                {viewMode === "envelope" ? (
                  <EnvelopeCard post={post} onStamp={handleStamp} isStamping={stampingPosts.has(post.id)} />
                ) : (
                  <GalleryCard post={post} onStamp={handleStamp} isStamping={stampingPosts.has(post.id)} />
                )}
              </div>
            );
          })}
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
            .toggle-btn { display: flex; align-items: center; gap: 5px; padding: 7px 18px; border: 1.5px solid #e0d5c0; border-radius: 8px; background: #fefdf9; cursor: pointer; font-size: 13px; font-family: inherit; color: #8c7a60; transition: all 0.15s; }
            .toggle-btn:hover { border-color: #c0a880; color: #5c4a30; }
            .toggle-btn.active { background: #2c2416; color: #fefdf9; border-color: #2c2416; }
            .toggle-icon { font-size: 14px; }
            .feed-vertical { max-width: 600px; margin: 0 auto; padding: 0 8px 12px; }
            .feed-toast {
              position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 60;
              background: #3a2e22; color: #faf7f0; padding: 11px 18px; border-radius: 10px;
              font-size: 14px; box-shadow: 0 6px 20px rgba(0,0,0,0.3); cursor: pointer; max-width: 90vw;
            }
            .feed-item { margin-bottom: 20px; position: relative; }
            .take-down-btn {
              position: absolute; top: 10px; right: 10px; z-index: 6;
              width: 34px; height: 34px; border-radius: 50%;
              border: 1px solid #d8c7ab; background: rgba(255,253,248,0.94);
              color: #8a5a3b; font-size: 15px; cursor: pointer; line-height: 1;
              display: flex; align-items: center; justify-content: center;
              box-shadow: 0 1px 4px rgba(0,0,0,0.15); opacity: 0.6;
              transition: opacity .15s, transform .15s, border-color .15s;
            }
            .feed-item:hover .take-down-btn { opacity: 1; }
            .take-down-btn:hover { transform: scale(1.08); border-color: #b8513f; color: #b8513f; }
            .take-down-btn:disabled { opacity: 0.4; cursor: default; }
            .feed-item.taking-down {
              animation: feedCrumple 0.52s cubic-bezier(.5,-0.1,.7,.5) forwards;
              transform-origin: center; pointer-events: none; will-change: transform, opacity, filter;
            }
            @keyframes feedCrumple {
              0% { transform: scale(1) rotate(0); opacity: 1; filter: none; }
              45% { transform: scale(0.5) rotate(-7deg); filter: contrast(1.4) brightness(0.9); border-radius: 40%; }
              100% { transform: translate(42vw, -44vh) scale(0.06) rotate(240deg); opacity: 0; filter: contrast(1.6) brightness(0.82); }
            }
            @media (prefers-reduced-motion: reduce) { .feed-item.taking-down { animation-duration: 0.15s; } }
            .feed-empty-state { text-align: center; padding: 80px 20px; color: #999; font-size: 16px; font-style: italic; }
            .feed-loading-more { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: #8c7a60; font-size: 13px; font-style: italic; }
            .spinner-mini { width: 20px; height: 20px; border: 2px solid #e0d5c0; border-top-color: #8b4513; border-radius: 50%; animation: mini-spin 0.7s linear infinite; }
            @keyframes mini-spin { to { transform: rotate(360deg); } }
            .feed-end { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 32px 16px 48px; }
            .feed-end-line { color: #d0c8b8; }
            .feed-end-text { font-size: 12px; color: #b0a090; font-style: italic; }
            .feed-gallery .feed-item { margin-bottom: 24px; }
          `}</style>
        </div>
      )}
    </div>
  );
}

// Gallery card
function GalleryCard({ post, onStamp, isStamping }: { post: any; onStamp?: (id: string) => void; isStamping?: boolean }) {
  const imageUrl = post.imageUrl || post.finalImageUrl || post.uploadedPhotoUrl;
  const [viewing, setViewing] = useState(false);
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
        <div
          className="gallery-image-wrap"
          onClick={() => setViewing(true)}
          role="button"
          title="View full size"
        >
          <img src={imageUrl} alt="" className="gallery-image" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      {viewing && (
        <LetterLightbox postId={post.id} initialImageUrl={imageUrl} onClose={() => setViewing(false)} />
      )}
      <div className="gallery-actions">
        {onStamp && (
          <button className={`gallery-stamp-btn ${isStamping ? "stamped" : ""}`} onClick={(e) => { e.stopPropagation(); onStamp(post.id); }} disabled={isStamping}>
            <span className="g-stamp-icon">{isStamping ? "⭐" : "☆"}</span>
            <span>{post.stampCount || 0}</span>
          </button>
        )}
        <Link href={`/post/${post.id}`} className="gallery-detail-link"><ScratchIcon size={12} /> View details</Link>
        {post._count?.scratches > 0 && <span className="gallery-scratches"><ScratchIcon size={12} /> {post._count.scratches}</span>}
      </div>
      {post.ocrHashtags?.length > 0 && (
        <div className="gallery-tags">
          {post.ocrHashtags.map((tag: string) => <span key={tag} className="gallery-tag">{tag}</span>)}
        </div>
      )}
      <style>{`
        .gallery-card { border: 1px solid #e0d5c0; border-radius: 8px; overflow: hidden; background: #fefdf9; }
        .gallery-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; }
        .gallery-author { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #2c2416; }
        .gallery-av { border-radius: 50%; object-fit: cover; }
        .gallery-av-ph { width: 24px; height: 24px; border-radius: 50%; background: #e0d5c0; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #6b5c40; }
        .gallery-name { font-weight: 600; font-size: 14px; }
        .gallery-name:hover { text-decoration: underline; }
        .gallery-time { font-size: 11px; color: #b0a090; }
        .gallery-image-wrap { background: #faf7f0; display: flex; align-items: center; justify-content: center; cursor: zoom-in; }
        .gallery-image { width: 100%; max-height: 75vh; object-fit: contain; display: block; }
        .gallery-actions { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid #f0e8d8; }
        .gallery-stamp-btn { display: flex; align-items: center; gap: 5px; padding: 6px 14px; border: 1.5px solid #d0c8b8; border-radius: 8px; background: #fefdf9; cursor: pointer; font-size: 14px; font-family: inherit; color: #6b5c40; transition: all 0.15s; }
        .gallery-stamp-btn:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .gallery-stamp-btn.stamped { background: #f5f4f1; border-color: #1a1a1a; color: #1a1a1a; }
        .gallery-stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .g-stamp-icon { font-size: 15px; }
        .gallery-detail-link { padding: 6px 14px; border: 1px solid #e0d5c0; border-radius: 8px; background: #fefdf9; color: #6b5c40; font-size: 12px; text-decoration: none; }
        .gallery-detail-link:hover { background: #f5f0e8; }
        .gallery-scratches { font-size: 12px; color: #b0a090; margin-left: auto; }
        .gallery-tags { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 14px 12px; border-top: 1px solid #f0e8d8; }
        .gallery-tag { font-size: 11px; color: #6b5c40; background: #f0e8d8; padding: 2px 10px; border-radius: 6px; }
      `}</style>
    </article>
  );
}
