"use client";

import Link from "next/link";
import { todaysPrompt } from "@/lib/prompts";

// A small pinned notice with today's prompt. `pinned` styles it for the cork
// board; otherwise it sits inline on a page.
export function DailyPromptCard({ pinned = false }: { pinned?: boolean }) {
  const prompt = todaysPrompt();
  return (
    <div className={`dp-card ${pinned ? "dp-pinned" : ""}`}>
      <span className="dp-pin" />
      <span className="dp-label">Today&apos;s prompt</span>
      <p className="dp-prompt">{prompt}</p>
      <Link
        href="/post/new?mode=draw"
        className="dp-cta"
        onPointerDown={(e) => e.stopPropagation()}
      >
        &#9998; Take up your pen
      </Link>

      <style>{`
        .dp-card {
          position: relative;
          background: #fff8e6;
          border: 1px solid #e8d5a0;
          border-radius: 3px;
          padding: 16px 18px 14px;
          max-width: 320px;
          box-shadow: 0 5px 14px rgba(80,55,10,0.18);
        }
        .dp-pinned { transform: rotate(-1.6deg); }
        .dp-pin {
          position: absolute; top: -7px; left: 50%; margin-left: -7px;
          width: 14px; height: 14px; border-radius: 50%;
          background: #b7950b;
          box-shadow: inset -2px -2px 3px rgba(0,0,0,0.35), inset 2px 2px 3px rgba(255,255,255,0.35), 0 3px 4px rgba(60,40,0,0.4);
        }
        .dp-label {
          font-size: 10px; font-weight: 700; letter-spacing: 1.4px;
          text-transform: uppercase; color: #a08020;
        }
        .dp-prompt {
          margin: 7px 0 12px; font-size: 16px; font-style: italic;
          color: #4a3a16; line-height: 1.45;
        }
        .dp-cta {
          display: inline-block; padding: 7px 14px; border-radius: 7px;
          background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 700;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
