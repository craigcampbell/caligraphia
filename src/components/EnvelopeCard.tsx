"use client";

import { useState } from "react";
import Link from "next/link";

interface EnvelopeCardProps {
  post: {
    id: string;
    postType: string;
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
      interactions: number;
      scratches: number;
    };
    userInteraction?: string | null;
  };
  onStamp?: (postId: string) => void;
  isStamping?: boolean;
}

export function EnvelopeCard({ post, onStamp, isStamping }: EnvelopeCardProps) {
  const [opened, setOpened] = useState(false);
  const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;

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
          {/* Envelope back */}
          <svg viewBox="0 0 500 360" className="env-svg-thumb" preserveAspectRatio="xMidYMid meet">
            <rect x="20" y="20" width="460" height="320" rx="6" fill="#f5f0e8" stroke="#d0c8b8" strokeWidth="1.5"/>
            <polygon points="250,20 20,340 480,340" fill="#ede4d0" stroke="#d0c8b8" strokeWidth="1"/>

            {/* Letter peeking through */}
            {imageUrl ? (
              <g>
                <clipPath id={`clip-${post.id}`}>
                  <rect x="80" y="70" width="340" height="210" rx="3"/>
                </clipPath>
                <image
                  href={imageUrl}
                  x="80" y="70"
                  width="340" height="210"
                  preserveAspectRatio="xMidYMid slice"
                  opacity="0.7"
                  clipPath={`url(#clip-${post.id})`}
                  onError={(e) => { (e.target as SVGImageElement).setAttribute('opacity', '0'); }}
                />
              </g>
            ) : (
              <text x="250" y="200" textAnchor="middle" fill="rgba(0,0,0,0.06)" fontSize="12" fontFamily="serif" fontStyle="italic">nothing inside</text>
            )}

            {/* Stamp on envelope */}
            <rect x="385" y="50" width="40" height="50" rx="1" fill="#e8d5b0" stroke="#c0a880" strokeWidth="0.5" opacity="0.7"/>
            <text x="405" y="78" textAnchor="middle" fill="#8b6914" fontSize="6" opacity="0.7">STAMP</text>

            {/* Decorative postmark */}
            <circle cx="370" cy="75" r="18" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.5"/>
            <line x1="355" y1="60" x2="385" y2="90" stroke="rgba(0,0,0,0.06)" strokeWidth="0.3"/>
            <line x1="385" y1="60" x2="355" y2="90" stroke="rgba(0,0,0,0.06)" strokeWidth="0.3"/>

            {/* Open hint */}
            <text x="250" y="200" textAnchor="middle" fill="rgba(0,0,0,0.08)" fontSize="10" fontFamily="serif" fontStyle="italic">tap to open</text>
          </svg>

          <div className="env-meta">
            <div className="env-from">
              <span className="env-label">From:</span>
              {post.user.nomDePlume ? (
                <img src={post.user.nomDePlume} alt="" className="env-av" width={18} height={18} />
              ) : (
                <span className="env-av-ph">{post.user.username[0].toUpperCase()}</span>
              )}
              <span className="env-name">{post.user.username}</span>
            </div>
            <span className="env-time">{timeAgo(post.createdAt)}</span>
          </div>

          <div className="env-stats">
            <span className="env-stat">&#9998; {post._count.scratches}</span>
            <span className="env-stat">&#9997; {post._count.interactions}</span>
          </div>
        </div>

        <style>{`
          .env-card {
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            border-radius: 12px;
            background: #fefdf9;
            border: 1px solid #e0d5c0;
            overflow: hidden;
          }
          .env-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 32px rgba(80,40,20,0.08);
          }
          .env-card-inner {
            padding: 16px;
          }
          .env-svg-thumb {
            width: 100%;
            max-height: 280px;
            display: block;
            transition: transform 0.3s;
          }
          .env-card:hover .env-svg-thumb {
            transform: scale(1.02);
          }
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
            color: #b0a090;
            font-style: italic;
          }
          .env-av {
            border-radius: 50%;
            object-fit: cover;
          }
          .env-av-ph {
            width: 18px; height: 18px; border-radius: 50%;
            background: #e0d5c0; display: flex; align-items: center;
            justify-content: center; font-size: 9px; font-weight: 600; color: #6b5c40;
          }
          .env-name {
            font-size: 13px;
            font-weight: 600;
            color: #3a3020;
          }
          .env-time {
            font-size: 11px;
            color: #b0a090;
          }
          .env-stats {
            display: flex;
            gap: 12px;
            margin-top: 8px;
            font-size: 12px;
            color: #8c7a60;
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
    <article className={`env-card-opened ${isStamping ? "stamping" : ""}`}
      style={{ filter: `sepia(${sepiaAmount}) brightness(${brightness})` }}>
      <div className="open-header">
        <button className="open-fold-btn" onClick={() => setOpened(false)}>
          &#8593; Fold
        </button>
        <div className="open-author">
          {post.user.nomDePlume ? (
            <img src={post.user.nomDePlume} alt="" className="open-av" width={24} height={24} />
          ) : (
            <span className="open-av-ph">{post.user.username[0].toUpperCase()}</span>
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
            className={`stamp-btn ${isStamping ? "stamped" : ""}`}
            onClick={(e) => { e.stopPropagation(); onStamp(post.id); }}
            disabled={isStamping}
          >
            <span className="stamp-icon">{isStamping ? "⭐" : "☆"}</span>
            <span>{post.stampCount || 0}</span>
          </button>
        )}
        <Link href={`/post/${post.id}`} className="open-discuss-btn">
          &#9998; {post._count.scratches} scratches
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
          border-radius: 12px;
          background: #fefdf9;
          overflow: hidden;
          transition: box-shadow 0.2s;
        }
        .env-card-opened.stamping { box-shadow: 0 0 0 2px #c0392b; }
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
          color: #8c7a60;
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
          background: #e0d5c0; display: flex; align-items: center;
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
          color: #b0a090;
        }
        .open-letter {
          padding: 0;
          background: #faf7f0;
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
          border-radius: 20px;
          background: #fefdf9;
          cursor: pointer;
          font-size: 14px;
          font-family: inherit;
          color: #6b5c40;
          transition: all 0.15s;
        }
        .stamp-btn:hover { border-color: #c0392b; color: #c0392b; }
        .stamp-btn.stamped {
          background: #fff5f0;
          border-color: #c0392b;
          color: #c0392b;
        }
        .stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .stamp-icon { font-size: 16px; }
        .open-discuss-btn {
          padding: 8px 16px;
          border: 1px solid #e0d5c0;
          border-radius: 8px;
          background: #fefdf9;
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
          border-top: 1px solid #f0e8d8;
        }
        .open-tag {
          font-size: 11px;
          color: #6b5c40;
          background: #f0e8d8;
          padding: 2px 10px;
          border-radius: 12px;
        }
      `}</style>
    </article>
  );
}
