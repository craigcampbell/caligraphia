"use client";

import { useRef, useState } from "react";
import { gsap } from "gsap";

// A photo postcard you can turn over — tap to flip, or grab and drag to rotate
// it in 3D, like a real card. GSAP drives the rotation; CSS backface-visibility
// decides which side faces you. Front = the photo, back = the handwritten note.
export function PostcardFlip({
  frontUrl,
  backUrl,
}: {
  frontUrl: string;
  backUrl: string;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const rot = useRef(0); // live rotateY in degrees
  const drag = useRef<{ x: number; startRot: number; moved: boolean } | null>(null);
  const [showHint, setShowHint] = useState(true);

  const setLive = (deg: number) => {
    rot.current = deg;
    gsap.set(innerRef.current, { rotateY: deg });
  };
  const animateTo = (deg: number, duration = 0.7) => {
    rot.current = deg;
    gsap.to(innerRef.current, { rotateY: deg, duration, ease: "power2.inOut" });
  };

  const flip = () => {
    animateTo(rot.current + 180);
    setShowHint(false);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, startRot: rot.current, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    setLive(drag.current.startRot + dx * 0.6);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const moved = drag.current.moved;
    drag.current = null;
    if (moved) {
      // Snap to whichever face is nearest.
      animateTo(Math.round(rot.current / 180) * 180, 0.5);
      setShowHint(false);
    } else {
      flip();
    }
  };

  return (
    <div className="pf-stage">
      <div
        className="pf-card"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="button"
        aria-label="Turn the postcard over"
      >
        <div className="pf-inner" ref={innerRef}>
          <div className="pf-face pf-front">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frontUrl} alt="Postcard front" draggable={false} />
          </div>
          <div className="pf-face pf-back">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={backUrl} alt="Postcard back (handwritten note)" draggable={false} />
          </div>
        </div>
      </div>
      <button className="pf-flip-btn" onClick={flip}>
        &#8635; Turn it over
      </button>
      {showHint && <div className="pf-hint">Tap the card, or grab and drag to turn it over</div>}

      <style>{`
        .pf-stage {
          perspective: 1800px; display: flex; flex-direction: column; align-items: center;
          gap: 12px; user-select: none; -webkit-user-select: none;
        }
        .pf-card {
          width: 100%; max-width: 560px; aspect-ratio: 1600 / 1100;
          cursor: grab; touch-action: pan-y;
        }
        .pf-card:active { cursor: grabbing; }
        .pf-inner {
          position: relative; width: 100%; height: 100%;
          transform-style: preserve-3d; will-change: transform; border-radius: 8px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.28);
        }
        .pf-face {
          position: absolute; inset: 0; border-radius: 8px; overflow: hidden; background: #fff;
          backface-visibility: hidden; -webkit-backface-visibility: hidden;
        }
        .pf-face img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .pf-back { transform: rotateY(180deg); }
        .pf-flip-btn {
          font: inherit; font-size: 14px; padding: 8px 16px; border-radius: 8px;
          border: 1px solid #c9b8a0; background: #fff; color: #7a5c43; cursor: pointer;
        }
        .pf-flip-btn:hover { background: #f7efe4; }
        .pf-hint { font-size: 13px; color: #8a7656; }
      `}</style>
    </div>
  );
}
