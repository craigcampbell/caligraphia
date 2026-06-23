"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

// A multi-page letter shown one sheet at a time. Paginate with big tap arrows
// (iPad-friendly), mouse-wheel / trackpad, swipe, or arrow keys. Single-page
// letters just render the one sheet with no chrome.
export function PaginatedPages({
  pages,
  variant = "inline",
}: {
  pages: string[];
  variant?: "inline" | "overlay";
}) {
  const [idx, setIdx] = useState(0);
  const wheelLock = useRef(false);
  const touchX = useRef<number | null>(null);
  const count = pages.length;

  const go = useCallback(
    (delta: number) => setIdx((i) => Math.max(0, Math.min(count - 1, i + delta))),
    [count]
  );

  // Keyboard + wheel paginate only in the fullscreen lightbox. Inline (on the
  // letter page) a sheet is taller than the viewport, so the wheel must scroll
  // to read and arrow keys shouldn't be hijacked — arrows + swipe handle it.
  useEffect(() => {
    if (count < 2 || variant !== "overlay") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); go(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go, variant]);

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div className={`pp pp-${variant}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={pages[0]} alt="Letter" className="pp-img" />
        <style>{ppStyles}</style>
      </div>
    );
  }

  const onWheel = (e: React.WheelEvent) => {
    // One page per gesture — trackpads emit a stream of small deltas.
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(d) < 8 || wheelLock.current) return;
    wheelLock.current = true;
    go(d > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLock.current = false; }, 400);
  };
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 45) go(dx < 0 ? 1 : -1);
    touchX.current = null;
  };

  return (
    <div
      className={`pp pp-${variant} pp-multi`}
      onWheel={variant === "overlay" ? onWheel : undefined}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button
        className="pp-arrow pp-prev"
        onClick={() => go(-1)}
        disabled={idx === 0}
        aria-label="Previous page"
      >
        &#8249;
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pages[idx]} alt={`Page ${idx + 1} of ${count}`} className="pp-img" />
      <button
        className="pp-arrow pp-next"
        onClick={() => go(1)}
        disabled={idx === count - 1}
        aria-label="Next page"
      >
        &#8250;
      </button>
      <div className="pp-indicator">
        {idx + 1} / {count}
      </div>
      <style>{ppStyles}</style>
    </div>
  );
}

// Fullscreen lightbox for reading a letter at full size from the line or board.
// Loads the letter's pages by id (the feed only carries page 0), starting from
// whatever thumbnail was already on screen.
export function LetterLightbox({
  postId,
  initialImageUrl,
  onClose,
}: {
  postId: string;
  initialImageUrl?: string | null;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<string[]>(initialImageUrl ? [initialImageUrl] : []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) return;
        const data = await res.json();
        const p = data?.post;
        if (cancelled || !p) return;
        const urls = [
          p.imageUrl || p.finalImageUrl || p.uploadedPhotoUrl,
          ...(Array.isArray(p.pages) ? p.pages.map((x: { imageUrl?: string | null }) => x.imageUrl) : []),
        ].filter(Boolean) as string[];
        if (urls.length) setPages(urls);
      } catch {
        /* keep the initial image */
      }
    })();
    return () => { cancelled = true; };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="lb-backdrop" onClick={onClose}>
      <div className="lb-inner" onClick={(e) => e.stopPropagation()}>
        <button className="lb-close" onClick={onClose} aria-label="Close">&times;</button>
        {pages.length > 0 ? (
          <PaginatedPages pages={pages} variant="overlay" />
        ) : (
          <div className="lb-loading">Loading…</div>
        )}
        <Link href={`/post/${postId}`} className="lb-open">Open letter &rarr;</Link>
      </div>
      <style>{`
        .lb-backdrop {
          position: fixed; inset: 0; z-index: 400; background: rgba(28,20,12,0.86);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .lb-inner { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; max-width: 100%; }
        .lb-close {
          position: absolute; top: -6px; right: -6px; z-index: 5;
          width: 42px; height: 42px; border-radius: 50%; border: none;
          background: #faf7f0; color: #3a2e22; font-size: 26px; line-height: 1; cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }
        .lb-loading { color: #f3ece0; font-size: 15px; padding: 60px; }
        .lb-open {
          color: #f3ece0; text-decoration: none; font-size: 15px;
          border: 1px solid rgba(243,236,224,0.5); border-radius: 8px; padding: 8px 18px;
          background: rgba(0,0,0,0.2);
        }
        .lb-open:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
}

const ppStyles = `
  .pp { position: relative; display: flex; align-items: center; justify-content: center; }
  .pp-inline { width: 100%; }
  .pp-inline .pp-img {
    width: 100%; height: auto; display: block; border-radius: 6px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  }
  .pp-overlay .pp-img {
    max-width: min(94vw, 1000px); max-height: 86vh; width: auto; height: auto;
    display: block; border-radius: 6px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); background: #fff;
  }
  .pp-arrow {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 3;
    width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; line-height: 1; color: #3a2e22;
    background: rgba(250,247,240,0.92); box-shadow: 0 2px 10px rgba(0,0,0,0.25);
    transition: transform .12s, background .12s, opacity .12s;
  }
  .pp-arrow:hover:not(:disabled) { transform: translateY(-50%) scale(1.07); background: #fff; }
  .pp-arrow:disabled { opacity: 0.32; cursor: default; }
  .pp-prev { left: 6px; }
  .pp-next { right: 6px; }
  .pp-overlay .pp-prev { left: -18px; }
  .pp-overlay .pp-next { right: -18px; }
  .pp-indicator {
    position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%); z-index: 3;
    font-size: 13px; color: #fff; background: rgba(0,0,0,0.55);
    padding: 3px 12px; border-radius: 999px; letter-spacing: 0.5px;
  }
  @media (max-width: 560px) {
    .pp-arrow { width: 48px; height: 48px; font-size: 28px; }
    .pp-prev { left: 2px; } .pp-next { right: 2px; }
    .pp-overlay .pp-prev { left: 2px; } .pp-overlay .pp-next { right: 2px; }
  }
`;
