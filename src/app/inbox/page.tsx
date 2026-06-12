"use client";

import { useState, useEffect } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import Link from "next/link";

export default function InboxPage() {
  const [letters, setLetters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/posts/inbox");
        if (res.ok) {
          const data = await res.json();
          setLetters(data.posts || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="inbox-main">
        <div className="inbox-header">
          <h1 className="inbox-title">
            <span className="inbox-icon">&#9993;</span> Your Postbox
          </h1>
          <p className="inbox-sub">Private letters sent just to you.</p>
        </div>

        {loading && (
          <div className="inbox-loading">
            <div className="spinner" />
          </div>
        )}

        {!loading && letters.length === 0 && (
          <div className="inbox-empty">
            <div className="inbox-empty-icon">&#128232;</div>
            <p>Your postbox is empty.</p>
            <p className="inbox-empty-hint">
              Share your profile link so friends can send you letters.
            </p>
          </div>
        )}

        <div className="inbox-list">
          {letters.map((letter) => (
            <Link
              key={letter.id}
              href={`/post/${letter.id}`}
              className="inbox-letter"
            >
              <div className="il-envelope-icon">&#9993;</div>
              <div className="il-body">
                <div className="il-from">
                  <span className="il-label">From:</span>
                  {letter.user.nomDePlume ? (
                    <img src={letter.user.nomDePlume} alt="" className="il-av" width={18} height={18} />
                  ) : (
                    <span className="il-av-ph">{letter.user.username[0].toUpperCase()}</span>
                  )}
                  <span className="il-name">{letter.user.username}</span>
                </div>
                {letter.ocrText && (
                  <div className="il-preview">{letter.ocrText.slice(0, 80)}</div>
                )}
                <div className="il-meta">
                  <span className="il-time">{timeAgo(letter.createdAt)}</span>
                  <span className="il-stamps">&#9733; {letter.stampCount || 0}</span>
                </div>
              </div>
              <div className="il-arrow">&#8594;</div>
            </Link>
          ))}
        </div>
      </main>

      <style>{`
        .inbox-main {
          max-width: 600px;
          margin: 0 auto;
          padding: 24px 16px 60px;
        }
        .inbox-header {
          text-align: center;
          padding-bottom: 20px;
          border-bottom: 1px solid #e0d5c0;
          margin-bottom: 20px;
        }
        .inbox-title {
          font-size: 28px;
          font-weight: 700;
          color: #2c2416;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .inbox-icon { color: #8b4513; }
        .inbox-sub {
          font-size: 14px;
          color: #8c7a60;
          font-style: italic;
          margin-top: 4px;
        }
        .inbox-loading {
          display: flex;
          justify-content: center;
          padding: 60px;
        }
        .spinner {
          width: 32px; height: 32px; border: 3px solid #e0e0e0;
          border-top-color: #333; border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .inbox-empty {
          text-align: center;
          padding: 60px 16px;
          color: #8c7a60;
        }
        .inbox-empty-icon { font-size: 48px; margin-bottom: 12px; }
        .inbox-empty-hint {
          font-size: 13px;
          font-style: italic;
          margin-top: 6px;
          color: #b0a090;
        }
        .inbox-list { display: flex; flex-direction: column; gap: 8px; }
        .inbox-letter {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid #e0d5c0;
          border-radius: 6px;
          background: #fefdf9;
          text-decoration: none;
          color: inherit;
          transition: all 0.15s;
        }
        .inbox-letter:hover {
          border-color: #c0a880;
          box-shadow: 0 2px 12px rgba(80,40,20,0.04);
          transform: translateX(2px);
        }
        .il-envelope-icon {
          font-size: 28px;
          color: #8b4513;
          flex-shrink: 0;
        }
        .il-body { flex: 1; min-width: 0; }
        .il-from {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .il-label {
          font-size: 11px;
          color: #b0a090;
          font-style: italic;
        }
        .il-av { border-radius: 50%; object-fit: cover; }
        .il-av-ph {
          width: 18px; height: 18px; border-radius: 50%;
          background: #e0d5c0; display: flex; align-items: center;
          justify-content: center; font-size: 9px; font-weight: 600; color: #6b5c40;
        }
        .il-name {
          font-weight: 600;
          font-size: 14px;
          color: #2c2416;
        }
        .il-preview {
          font-size: 13px;
          color: #8c7a60;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-style: italic;
        }
        .il-meta {
          display: flex;
          gap: 12px;
          margin-top: 4px;
          font-size: 11px;
          color: #b0a090;
        }
        .il-stamps { color: #8b6914; }
        .il-arrow {
          font-size: 16px;
          color: #c0b8a8;
          flex-shrink: 0;
        }
      `}</style>
    </AuthGuard>
  );
}
