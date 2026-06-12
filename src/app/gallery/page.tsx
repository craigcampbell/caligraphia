"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";

interface GalleryPost {
  id: string;
  finalImageUrl: string | null;
  uploadedPhotoUrl: string | null;
  ocrHashtags: string[];
  createdAt: string;
  user: { id: string; username: string };
}

interface Circle {
  id: string;
  name: string;
}

const SPACING = 290; // depth between letters, px
const FIRST_Z = 220; // distance to the first letter — close enough to read

// Deterministic per-index layout so the room doesn't reshuffle on re-render
function layoutFor(i: number) {
  const r1 = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const r2 = Math.abs(Math.sin(i * 78.233) * 12543.123) % 1;
  const r3 = Math.abs(Math.sin(i * 39.425) * 28461.77) % 1;
  const side = i % 2 === 0 ? -1 : 1;
  return {
    x: side * (115 + r1 * 185),
    hang: 40 + r2 * 130, // string length from ceiling
    rotY: (r3 - 0.5) * 18,
    sway: 2.4 + r1 * 2.2, // seconds
    z: -(FIRST_Z + i * SPACING),
  };
}

export default function GalleryPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<GalleryPost[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [circleId, setCircleId] = useState("");
  const [camZ, setCamZ] = useState(0);
  const targetZ = useRef(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const maxZ = FIRST_Z + Math.max(0, posts.length - 1) * SPACING + 300;

  // Load letters (up to two pages) and the circle list
  useEffect(() => {
    (async () => {
      try {
        const url = (cursor?: string) =>
          `/api/posts?limit=50${circleId ? `&groupId=${circleId}` : ""}${cursor ? `&cursor=${cursor}` : ""}`;
        const r1 = await fetch(url());
        if (!r1.ok) return;
        const d1 = await r1.json();
        let all: GalleryPost[] = d1.posts;
        if (d1.nextCursor) {
          const r2 = await fetch(url(d1.nextCursor));
          if (r2.ok) all = all.concat((await r2.json()).posts);
        }
        setPosts(all);
        targetZ.current = 0;
        setCamZ(0);
      } catch {
        // ignore
      }
    })();
  }, [circleId]);

  useEffect(() => {
    fetch("/api/groups")
      .then((r) => r.json())
      .then((d) => setCircles(d.groups || []))
      .catch(() => {});
  }, []);

  // Camera glide: input writes targetZ, rAF eases camZ toward it
  useEffect(() => {
    let raf = 0;
    let live = true;
    const tick = () => {
      if (!live) return;
      setCamZ((z) => {
        const d = targetZ.current - z;
        return Math.abs(d) < 0.5 ? targetZ.current : z + d * 0.12;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Input: wheel, keys, touch drag
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const clamp = (v: number) => Math.max(0, Math.min(maxZ, v));
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetZ.current = clamp(targetZ.current + e.deltaY * 1.4);
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "w", "W"].includes(e.key)) targetZ.current = clamp(targetZ.current + 180);
      if (["ArrowDown", "s", "S"].includes(e.key)) targetZ.current = clamp(targetZ.current - 180);
    };
    let lastY: number | null = null;
    const onTouchStart = (e: TouchEvent) => { lastY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      if (lastY === null) return;
      e.preventDefault();
      targetZ.current = clamp(targetZ.current + (lastY - e.touches[0].clientY) * 3);
      lastY = e.touches[0].clientY;
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    vp.addEventListener("touchstart", onTouchStart, { passive: true });
    vp.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      vp.removeEventListener("wheel", onWheel);
      vp.removeEventListener("touchstart", onTouchStart);
      vp.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [maxZ]);

  const layouts = useMemo(() => posts.map((_, i) => layoutFor(i)), [posts]);
  const atEnd = posts.length > 0 && camZ >= maxZ - 320;
  const seen = Math.min(posts.length, Math.max(0, Math.floor((camZ + 200) / SPACING) + 1));

  return (
    <AuthGuard>
      <NavBar />
      <div className="line-viewport" ref={viewportRef}>
        <div className="line-room" />
        <div className="line-floor" />

        <div className="line-hud">
          <div>
            <h1 className="line-title">The Line</h1>
            <p className="line-sub">every letter, hung out to read — scroll or use &uarr;&darr; to walk</p>
          </div>
          <select
            className="line-circle-pick"
            value={circleId}
            onChange={(e) => setCircleId(e.target.value)}
          >
            <option value="">All letters</option>
            {circles.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="line-world" style={{ transform: `translateZ(${camZ}px)` }}>
          {posts.map((post, i) => {
            const L = layouts[i];
            const rel = L.z + camZ; // position in camera space; negative = ahead
            if (rel > -40 || rel < -3600) return null;
            const nearFade = Math.max(0, Math.min(1, (-rel - 40) / 200));
            const farFade = Math.max(0, Math.min(1, (3600 + rel) / 900));
            const opacity = nearFade * farFade;
            const img = post.finalImageUrl || post.uploadedPhotoUrl;
            return (
              <div
                key={post.id}
                className="line-hanger"
                style={{
                  transform: `translate3d(${L.x}px, 0px, ${L.z}px) rotateY(${L.rotY}deg)`,
                  opacity,
                  pointerEvents: opacity > 0.35 ? "auto" : "none",
                }}
              >
                <div className="line-string" style={{ height: L.hang }} />
                <div className="line-pin" />
                <div
                  className="line-paper"
                  style={{ animationDuration: `${L.sway}s` }}
                  onClick={() => router.push(`/post/${post.id}`)}
                  title={`A letter from ${post.user.username}`}
                >
                  {img ? (
                    <img src={img} alt="" className="line-img" loading="lazy" draggable={false} />
                  ) : (
                    <div className="line-img line-img-empty" />
                  )}
                  <div className="line-caption">
                    <span className="line-author">{post.user.username}</span>
                    {post.ocrHashtags[0] && <span className="line-tag">{post.ocrHashtags[0]}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {posts.length === 0 && (
          <div className="line-end">
            <p>Nothing is hanging on the line yet.</p>
            <a href="/post/new" className="line-end-cta">&#9998; Hang the first letter</a>
          </div>
        )}

        {atEnd && (
          <div className="line-end">
            <p>You&apos;ve reached the end of the line.</p>
            <a href="/post/new" className="line-end-cta">&#9998; Hang one of your own</a>
          </div>
        )}

        <div className="line-progress">
          <div className="line-progress-fill" style={{ width: `${posts.length ? (seen / posts.length) * 100 : 0}%` }} />
        </div>
      </div>

      <style>{`
        .line-viewport {
          position: relative;
          height: calc(100vh - 61px);
          overflow: hidden;
          perspective: 900px;
          perspective-origin: 50% 44%;
          background: linear-gradient(180deg, #3b2f22 0%, #55432e 55%, #6a543a 100%);
          touch-action: none;
        }
        .line-room {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 75% 55% at 50% 32%, rgba(255,220,160,0.22), transparent 70%),
            radial-gradient(ellipse 100% 60% at 50% 112%, rgba(20,12,5,0.45), transparent 60%);
        }
        .line-floor {
          position: absolute; left: -50%; right: -50%; bottom: -12%; height: 45%;
          background:
            repeating-linear-gradient(90deg, rgba(0,0,0,0.1) 0 90px, rgba(255,235,200,0.04) 90px 92px),
            linear-gradient(180deg, #6b563c, #463624);
          transform: perspective(900px) rotateX(62deg);
          transform-origin: 50% 100%;
          pointer-events: none;
          opacity: 0.85;
        }
        .line-hud {
          position: absolute; top: 0; left: 0; right: 0; z-index: 50;
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 18px 22px; pointer-events: none;
        }
        .line-title {
          font-size: 26px; font-weight: 700; color: #f2e8d5;
          letter-spacing: -0.5px; margin-bottom: 2px;
          text-shadow: 0 2px 12px rgba(0,0,0,0.5);
        }
        .line-sub { font-size: 12px; color: rgba(242,232,213,0.55); font-style: italic; }
        .line-circle-pick {
          pointer-events: auto;
          padding: 8px 12px; border-radius: 8px;
          background: rgba(20,15,10,0.7); color: #f2e8d5;
          border: 1px solid rgba(242,232,213,0.25);
          font-family: inherit; font-size: 13px; cursor: pointer;
          backdrop-filter: blur(4px);
        }
        .line-world {
          position: absolute; inset: 0;
          transform-style: preserve-3d;
        }
        .line-hanger {
          position: absolute; left: 50%; top: 0;
          margin-left: -150px; width: 300px;
          transform-style: preserve-3d;
          display: flex; flex-direction: column; align-items: center;
          will-change: transform, opacity;
        }
        .line-string {
          width: 2px;
          background: linear-gradient(180deg, rgba(242,232,213,0.0), rgba(220,200,170,0.55));
        }
        .line-pin {
          width: 10px; height: 16px; margin: -2px 0 -6px;
          background: linear-gradient(180deg, #b08850, #7a5a32);
          border-radius: 3px 3px 4px 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.5);
          z-index: 2;
        }
        .line-paper {
          width: 280px;
          background: #fbf8f1;
          border-radius: 2px;
          padding: 8px 8px 0;
          cursor: pointer;
          box-shadow: 0 18px 50px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3);
          transform-origin: top center;
          animation: line-sway ease-in-out infinite alternate;
          transition: box-shadow 0.2s;
        }
        .line-paper:hover {
          box-shadow: 0 22px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,220,160,0.25);
          animation-play-state: paused;
        }
        @keyframes line-sway {
          from { transform: rotate(-1.4deg); }
          to { transform: rotate(1.4deg); }
        }
        .line-img {
          width: 100%; aspect-ratio: 3 / 4; object-fit: cover;
          display: block; background: #f4efe4;
        }
        .line-img-empty { background: #efe9da; }
        .line-caption {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 4px 7px;
        }
        .line-author { font-size: 12px; font-weight: 600; color: #5c4a30; }
        .line-tag { font-size: 10px; color: #a09080; }
        .line-end {
          position: absolute; left: 0; right: 0; bottom: 14%;
          text-align: center; z-index: 60;
          color: rgba(242,232,213,0.85); font-style: italic; font-size: 15px;
        }
        .line-end-cta {
          display: inline-block; margin-top: 12px;
          padding: 11px 26px; border-radius: 8px;
          background: #f2e8d5; color: #2b2118;
          font-weight: 700; font-style: normal; font-size: 14px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.4);
        }
        .line-progress {
          position: absolute; left: 0; right: 0; bottom: 0; height: 3px;
          background: rgba(255,255,255,0.08); z-index: 60;
        }
        .line-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #b08850, #e8cf9f);
          transition: width 0.25s;
        }
      `}</style>
    </AuthGuard>
  );
}
