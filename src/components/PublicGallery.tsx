"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface PublicLetter {
  id: string;
  author: { id: string; username: string; avatar: string | null };
  createdAt: string;
  stampCount: number;
  hashtags: string[];
  format: string;
  imageUrl: string | null;
}

export function PublicGallery() {
  const [letters, setLetters] = useState<PublicLetter[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const url = new URL("/api/public/letters", window.location.origin);
      url.searchParams.set("limit", "24");
      if (!reset && cursor) url.searchParams.set("cursor", cursor);
      const res = await fetch(url.toString());
      const data = await res.json();
      setLetters((prev) => (reset ? data.letters : [...prev, ...data.letters]));
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [cursor]);

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const obs = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && load(),
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, load]);

  return (
    <div className="pg">
      {letters.length === 0 && !loading && (
        <p className="pg-empty">No public letters yet — be the first to post one to the open feed.</p>
      )}
      <div className="pg-grid">
        {letters.map((l) => (
          <div key={l.id} className="pg-card">
            <Link href={`/l/${l.id}`} className="pg-imglink" aria-label={`Read the letter by ${l.author.username}`}>
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt={`Letter by ${l.author.username}`} loading="lazy" className="pg-img" />
              ) : (
                <div className="pg-img pg-noimg">&#9993;</div>
              )}
            </Link>
            <div className="pg-meta">
              <Link href={`/u/${l.author.username}`} className="pg-author">{l.author.username}</Link>
              {l.stampCount > 0 && <span className="pg-stamps">&#9733; {l.stampCount}</span>}
            </div>
          </div>
        ))}
      </div>
      <div ref={sentinelRef} />
      {loading && <div className="pg-loading">Loading…</div>}

      <style>{`
        .pg { max-width: 1100px; margin: 0 auto; padding: 0 16px 60px; }
        .pg-empty { text-align: center; color: #9b8a6e; padding: 50px; font-style: italic; }
        .pg-grid { columns: 4 240px; column-gap: 16px; }
        .pg-card { display: inline-block; width: 100%; margin: 0 0 16px; break-inside: avoid;
          background: #fffdf8; border: 1px solid #e6dcc6; border-radius: 12px; overflow: hidden;
          text-decoration: none; color: inherit; box-shadow: 0 2px 8px rgba(0,0,0,0.05); transition: transform .15s, box-shadow .15s; }
        .pg-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.12); }
        .pg-imglink { display: block; }
        .pg-img { width: 100%; height: auto; display: block; background: #fff; }
        .pg-noimg { display: flex; align-items: center; justify-content: center; height: 160px; font-size: 30px; color: #c2b393; }
        .pg-meta { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; }
        .pg-author { font-weight: 600; color: #3a2e22; font-size: 14px; text-decoration: none; }
        .pg-author:hover { color: #8a5a2b; text-decoration: underline; }
        .pg-stamps { color: #b08d2e; font-size: 13px; }
        .pg-loading { text-align: center; color: #a89a82; padding: 20px; }
        @media (max-width: 520px) { .pg-grid { columns: 2 150px; } }
      `}</style>
    </div>
  );
}
