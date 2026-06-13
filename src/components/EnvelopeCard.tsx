"use client";

import { useState } from "react";
import Link from "next/link";
import { ScratchIcon, StarIcon } from "./Icons";

interface EnvelopeCardProps {
  post: {
    id: string;
    postType: string;
    imageUrl?: string | null;
    finalImageUrl: string | null;
    uploadedPhotoUrl: string | null;
    envelopeData: any;
    stampCount: number;
    ocrHashtags: string[];
    createdAt: string;
    user: {
      id: string;
      username: string;
      nomDePlume: string | null;
    };
    _count: {
      scratches: number;
    };
    userInteraction?: string | null;
  };
  onStamp?: (postId: string) => void;
  isStamping?: boolean;
}

export function EnvelopeCard({ post, onStamp, isStamping }: EnvelopeCardProps) {
  const [opened, setOpened] = useState(false);
  const imageUrl = post.imageUrl || post.finalImageUrl || post.uploadedPhotoUrl;
  const waxColor = post.envelopeData?.waxSealColor || "#b22222";
  const initial = post.user.username[0]?.toUpperCase() || "?";

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Letter aging effect based on post age
  const postAge = Date.now() - new Date(post.createdAt).getTime();
  const ageDays = postAge / 86400000;
  const sepiaAmount = Math.min(0.35, ageDays * 0.008); // ~1% per day, max 35%
  const brightness = Math.max(0.92, 1 - ageDays * 0.002); // 0.2% per day
  const vignetteOpacity = Math.min(0.15, ageDays * 0.003); // 0.3% per day

  if (!opened) {
    return (
      <article className="env-card" onClick={() => setOpened(true)}
        style={{ filter: `sepia(${sepiaAmount * 0.5})` }}>
        <div className="env-card-inner">
          {/* Envelope back, letter peeking out of the mouth */}
          <svg viewBox="0 0 500 340" className="env-svg-thumb" preserveAspectRatio="xMidYMid meet" aria-label="Sealed letter — tap to open">
            <defs>
              <clipPath id={`peek-${post.id}`}>
                <rect x="68" y="22" width="364" height="136" rx="2" />
              </clipPath>
              <linearGradient id={`mouth-${post.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="rgba(60,40,15,0.35)" />
                <stop offset="1" stopColor="rgba(60,40,15,0)" />
              </linearGradient>
            </defs>

            {/* Letter sticking out of the envelope */}
            <g className="env-peek">
              <rect x="64" y="18" width="372" height="150" rx="2" fill="#fffef9" stroke="#e2d8c4" strokeWidth="1" />
              {imageUrl ? (
                <image
                  href={imageUrl}
                  x="68" y="22"
                  width="364" height="220"
                  preserveAspectRatio="xMidYMin slice"
                  clipPath={`url(#peek-${post.id})`}
                  onError={(e) => { (e.target as SVGImageElement).setAttribute("opacity", "0"); }}
                />
              ) : (
                <text x="250" y="100" textAnchor="middle" fill="rgba(0,0,0,0.18)" fontSize="13" fontFamily="serif" fontStyle="italic">a blank page</text>
              )}
            </g>

            {/* Envelope body (back side, seams visible) */}
            <g>
              <rect x="28" y="150" width="444" height="174" rx="6" fill="#f3ecdc" stroke="#d6cab2" strokeWidth="1.5" />
              {/* shadow of the mouth on the letter */}
              <rect x="30" y="151" width="440" height="14" fill={`url(#mouth-${post.id})`} />
              {/* back seams: two sides meeting at the centre, bottom fold */}
              <polygon points="30,152 250,262 30,322" fill="#eee5d2" stroke="#d6cab2" strokeWidth="1" />
              <polygon points="470,152 250,262 470,322" fill="#eee5d2" stroke="#d6cab2" strokeWidth="1" />
              <polygon points="30,322 250,256 470,322" fill="#f0e8d6" stroke="#d6cab2" strokeWidth="1" />
            </g>

            {/* Sender's wax seal resting at the mouth */}
            <g className="env-seal">
              <circle cx="250" cy="160" r="27" fill={waxColor} opacity="0.95" />
              <circle cx="250" cy="160" r="27" fill="rgba(0,0,0,0.15)" transform="translate(1.5,2)" style={{ mixBlendMode: "multiply" }} />
              <circle cx="250" cy="160" r="21" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
              <circle cx="250" cy="160" r="16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              <text x="250" y="166" textAnchor="middle" fill="#fff" fontSize="15" fontFamily="serif" fontWeight="bold">{initial}</text>
            </g>

            {/* Postmark, faint */}
            <g opacity="0.5">
              <circle cx="408" cy="200" r="20" fill="none" stroke="rgba(60,40,15,0.25)" strokeWidth="1" />
              <path d="M392 196 q8 -5 16 0 t16 0" fill="none" stroke="rgba(60,40,15,0.2)" strokeWidth="1" />
              <path d="M392 204 q8 -5 16 0 t16 0" fill="none" stroke="rgba(60,40,15,0.2)" strokeWidth="1" />
            </g>

            <text x="250" y="305" textAnchor="middle" fill="rgba(60,40,15,0.28)" fontSize="11" fontFamily="serif" fontStyle="italic" className="env-open-hint">tap to open</text>
          </svg>

          <div className="env-meta">
            <div className="env-from">
              <span className="env-label">From:</span>
              {post.user.nomDePlume ? (
                <img src={post.user.nomDePlume} alt="" className="env-av" width={18} height={18} />
              ) : (
                <span className="env-av-ph">{initial}</span>
              )}
              <span className="env-name">{post.user.username}</span>
            </div>
            <span className="env-time">{timeAgo(post.createdAt)}</span>
          </div>

          <div className="env-stats">
            <span className="env-stat"><ScratchIcon size={12} /> {post._count.scratches}</span>
            <span className="env-stat"><StarIcon size={12} /> {post.stampCount || 0}</span>
          </div>
        </div>

        <style>{`
          .env-card {
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            border-radius: 6px;
            background: var(--paper-bright, #fefdf9);
            border: 1px solid var(--line, #e0d5c0);
            overflow: hidden;
          }
          .env-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(80,40,20,0.1);
          }
          .env-svg-thumb {
            width: 100%;
            max-height: 280px;
            display: block;
          }
          .env-peek {
            transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
          }
          .env-card:hover .env-peek {
            transform: translateY(-8px);
          }
          .env-open-hint { opacity: 0; transition: opacity 0.25s; }
          .env-card:hover .env-open-hint { opacity: 1; }
          .env-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 12px;
          }
          .env-from {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .env-label {
            font-size: 11px;
            color: var(--faint, #b0a090);
            font-style: italic;
          }
          .env-av {
            border-radius: 50%;
            object-fit: cover;
          }
          .env-av-ph {
            width: 18px; height: 18px; border-radius: 50%;
            background: var(--line, #e0d5c0); display: flex; align-items: center;
            justify-content: center; font-size: 9px; font-weight: 600; color: #6b5c40;
          }
          .env-name {
            font-size: 13px;
            font-weight: 600;
            color: #3a3020;
          }
          .env-time {
            font-size: 11px;
            color: var(--faint, #b0a090);
          }
          .env-card-inner { padding: 16px; }
          .env-stats {
            display: flex;
            gap: 12px;
            margin-top: 8px;
            font-size: 12px;
            color: var(--muted, #8c7a60);
          }
          .env-stat {
            display: flex;
            align-items: center;
            gap: 3px;
          }
        `}</style>
      </article>
    );
  }

  return (
    <article className={`env-card-opened ${isStamping ? "stamping" : ""}`}>
      <div className="open-header">
        <button className="open-fold-btn" onClick={() => setOpened(false)}>
          &#8593; Fold
        </button>
        <div className="open-author">
          {post.user.nomDePlume ? (
            <img src={post.user.nomDePlume} alt="" className="open-av" width={24} height={24} />
          ) : (
            <span className="open-av-ph">{initial}</span>
          )}
          <Link href={`/users/${post.user.id}`} className="open-name">
            {post.user.username}
          </Link>
        </div>
        <span className="open-time">{timeAgo(post.createdAt)}</span>
      </div>

      {imageUrl && (
        <div className="open-letter" style={{
            filter: `sepia(${sepiaAmount}) brightness(${brightness})`,
            position: 'relative',
          }}>
          <img
            src={imageUrl}
            alt=""
            className="open-img"
            onClick={() => setOpened(false)}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          {ageDays > 1 && (
            <div className="open-letter-vignette" style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(ellipse at center, transparent 60%, rgba(80,50,20,${vignetteOpacity}) 100%)`,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      <div className="open-actions">
        {onStamp && (
          <button
            className="stamp-btn"
            onClick={(e) => { e.stopPropagation(); onStamp(post.id); }}
            disabled={isStamping}
          >
            <StarIcon size={15} filled={!!isStamping} />
            <span>{post.stampCount || 0}</span>
          </button>
        )}
        <Link href={`/post/${post.id}`} className="open-discuss-btn">
          <ScratchIcon size={13} /> {post._count.scratches} scratches
        </Link>
      </div>

      {post.ocrHashtags.length > 0 && (
        <div className="open-tags">
          {post.ocrHashtags.map((tag) => (
            <span key={tag} className="open-tag">{tag}</span>
          ))}
        </div>
      )}

      <style>{`
        .env-card-opened {
          border: 1px solid #d0c8b8;
          border-radius: 6px;
          background: var(--paper-bright, #fefdf9);
          overflow: hidden;
          transition: box-shadow 0.2s;
          animation: env-unfold 0.35s cubic-bezier(0.2, 0.8, 0.3, 1);
        }
        @keyframes env-unfold {
          from { opacity: 0; transform: translateY(10px) scale(0.985); }
          to { opacity: 1; transform: none; }
        }
        .env-card-opened.stamping { box-shadow: 0 0 0 2px var(--ink, #1a1a1a); }
        .open-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #e8dcc8;
        }
        .open-fold-btn {
          background: none;
          border: none;
          color: var(--muted, #8c7a60);
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          padding: 4px 8px;
        }
        .open-fold-btn:hover { color: #2c2416; }
        .open-author {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .open-av { border-radius: 50%; object-fit: cover; }
        .open-av-ph {
          width: 24px; height: 24px; border-radius: 50%;
          background: var(--line, #e0d5c0); display: flex; align-items: center;
          justify-content: center; font-size: 11px; font-weight: 600; color: #6b5c40;
        }
        .open-name {
          font-size: 14px;
          font-weight: 600;
          color: #2c2416;
        }
        .open-name:hover { text-decoration: underline; }
        .open-time {
          font-size: 11px;
          color: var(--faint, #b0a090);
        }
        .open-letter {
          padding: 0;
          background: var(--paper, #faf7f0);
        }
        .open-img {
          width: 100%;
          max-height: 70vh;
          object-fit: contain;
          display: block;
          cursor: pointer;
        }
        .open-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-top: 1px solid #e8dcc8;
        }
        .stamp-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1.5px solid #d0c8b8;
          border-radius: 8px;
          background: var(--paper-bright, #fefdf9);
          cursor: pointer;
          font-size: 14px;
          font-family: inherit;
          color: #6b5c40;
          transition: all 0.15s;
        }
        .stamp-btn:hover { border-color: var(--ink, #1a1a1a); color: var(--ink, #1a1a1a); }
        .stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .open-discuss-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 8px 16px;
          border: 1px solid var(--line, #e0d5c0);
          border-radius: 8px;
          background: var(--paper-bright, #fefdf9);
          color: #6b5c40;
          font-size: 13px;
          font-family: inherit;
          cursor: pointer;
          text-decoration: none;
        }
        .open-discuss-btn:hover { background: #f5f0e8; }
        .open-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          padding: 8px 16px 14px;
          border-top: 1px solid var(--line-soft, #f0e8d8);
        }
        .open-tag {
          font-size: 11px;
          color: #6b5c40;
          background: var(--line-soft, #f0e8d8);
          padding: 2px 10px;
          border-radius: 6px;
        }
      `}</style>
    </article>
  );
}
