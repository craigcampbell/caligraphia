"use client";

import { useState } from "react";

interface Props {
  postId: string;
  initialStampCount: number;
  initialStamped: boolean;
}

export function StampButton({ postId, initialStampCount, initialStamped }: Props) {
  const [stampCount, setStampCount] = useState(initialStampCount);
  const [stamped, setStamped] = useState(initialStamped);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/posts/${postId}/stamp`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setStamped(data.action === "stamped");
        setStampCount(data.stampCount);
      } else {
        setError(data.error || "Couldn't stamp this");
      }
    } catch {
      setError("Couldn't stamp this");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stamp-wrap">
      <button
        className={`stamp-btn ${stamped ? "stamped" : ""}`}
        onClick={toggle}
        disabled={loading}
        aria-label={stamped ? "Remove stamp" : "Stamp this letter"}
        title={stamped ? "Remove your stamp" : "Affix a stamp"}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={stamped ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6">
          <path d="M4 4h16v16H4z" strokeDasharray="2.5 2" />
          <path d="M8.5 9.5h7v7h-7z" fill="none" />
        </svg>
        {stampCount}
      </button>
      {error && <span className="stamp-err">{error}</span>}

      <style>{`
        .stamp-wrap { display: flex; align-items: center; gap: 8px; }
        .stamp-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px;
          border: 1px solid #d8cfb8; border-radius: 8px;
          background: #fefdf9; cursor: pointer;
          font-size: 15px; font-family: inherit; color: #6b5c40;
          transition: all 0.15s;
        }
        .stamp-btn:hover { border-color: #8b4513; color: #8b4513; }
        .stamp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .stamp-btn.stamped {
          border-color: #8b4513; color: #8b4513; background: #fef9f0;
        }
        .stamp-err { font-size: 12px; color: #c0392b; }
      `}</style>
    </div>
  );
}
