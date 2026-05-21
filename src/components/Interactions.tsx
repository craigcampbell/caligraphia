"use client";

import { useState } from "react";

interface Props {
  postId: string;
  initialLikeCount: number;
  initialDislikeCount: number;
  initialUserInteraction: string | null;
}

export function Interactions({
  postId,
  initialLikeCount,
  initialDislikeCount,
  initialUserInteraction,
}: Props) {
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [dislikeCount, setDislikeCount] = useState(initialDislikeCount);
  const [userInteraction, setUserInteraction] = useState<string | null>(
    initialUserInteraction
  );
  const [loading, setLoading] = useState<string | null>(null);

  const interact = async (type: "like" | "dislike") => {
    setLoading(type);
    try {
      if (userInteraction === type) {
        const res = await fetch(`/api/posts/${postId}/interaction`, {
          method: "DELETE",
        });
        if (res.ok) {
          setUserInteraction(null);
          if (type === "like") setLikeCount((c) => c - 1);
          else setDislikeCount((c) => c - 1);
        }
      } else {
        const res = await fetch(`/api/posts/${postId}/${type}`, {
          method: "POST",
        });
        if (res.ok) {
          if (userInteraction === "like") setLikeCount((c) => c - 1);
          if (userInteraction === "dislike") setDislikeCount((c) => c - 1);
          setUserInteraction(type);
          if (type === "like") setLikeCount((c) => c + 1);
          else setDislikeCount((c) => c + 1);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="interactions">
      <button
        className={`interact-btn ${userInteraction === "like" ? "active-like" : ""}`}
        onClick={() => interact("like")}
        disabled={loading !== null}
        aria-label="Like"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={userInteraction === "like" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
        </svg>
        {likeCount}
      </button>

      <button
        className={`interact-btn ${userInteraction === "dislike" ? "active-dislike" : ""}`}
        onClick={() => interact("dislike")}
        disabled={loading !== null}
        aria-label="Dislike"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={userInteraction === "dislike" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
        </svg>
        {dislikeCount}
      </button>

      <style>{`
        .interactions {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .interact-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 15px;
          font-family: inherit;
          color: #666;
          transition: all 0.15s;
        }
        .interact-btn:hover {
          border-color: #aaa;
        }
        .interact-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .active-like {
          border-color: #38a169;
          color: #38a169;
          background: #f0fff4;
        }
        .active-dislike {
          border-color: #e53e3e;
          color: #e53e3e;
          background: #fff5f5;
        }
      `}</style>
    </div>
  );
}
