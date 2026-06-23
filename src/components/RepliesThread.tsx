"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReplyItem {
  id: string;
  onSheet: boolean;
  createdAt: string;
  childPost: {
    id: string;
    imageUrl?: string | null;
    user: { id: string; username: string; nomDePlume: string | null };
  };
}

// The write-back thread under a letter: each reply links to its own page, where
// it can be replied to again (threading happens by navigation, not nesting).
export function RepliesThread({
  postId,
  refreshKey = 0,
}: {
  postId: string;
  refreshKey?: number;
}) {
  const [replies, setReplies] = useState<ReplyItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/replies`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setReplies(data.replies || []);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId, refreshKey]);

  if (loaded && replies.length === 0) return null;

  return (
    <div className="replies-thread">
      <h3 className="replies-title">Write-backs ({replies.length})</h3>
      {replies.map((r) => (
        <Link key={r.id} href={`/post/${r.childPost.id}`} className="reply-item">
          {r.childPost.imageUrl ? (
            <img src={r.childPost.imageUrl} alt="" className="reply-thumb" loading="lazy" />
          ) : (
            <div className="reply-thumb reply-thumb-ph">no image</div>
          )}
          <div className="reply-meta">
            <span className="reply-author">{r.childPost.user.username}</span>
            <span className="reply-kind">
              {r.onSheet ? "wrote on this letter" : "wrote back"}
            </span>
          </div>
        </Link>
      ))}

      <style>{`
        .replies-thread { margin-top: 28px; animation: repliesFadeIn 0.3s ease-in; }
        @keyframes repliesFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .replies-title { font-size: 16px; color: #5c4a30; margin: 0 0 12px; }
        .reply-item {
          display: flex; align-items: center; gap: 14px;
          padding: 10px; border: 1px solid #e0d5c0; border-radius: 10px;
          background: #fefdf9; margin-bottom: 10px; text-decoration: none; color: inherit;
        }
        .reply-item:hover { border-color: #b98a5e; background: #fbf6ec; }
        .reply-thumb {
          width: 72px; height: 96px; object-fit: cover; border-radius: 6px;
          border: 1px solid #e0d5c0; background: #fff; flex: 0 0 auto;
        }
        .reply-thumb-ph {
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: #b3a78f;
        }
        .reply-meta { display: flex; flex-direction: column; gap: 2px; }
        .reply-author { font-weight: 600; color: #3a2e22; }
        .reply-kind { font-size: 13px; color: #8a7a5e; }
      `}</style>
    </div>
  );
}
