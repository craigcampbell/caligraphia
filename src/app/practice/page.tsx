"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { CanvasDraw } from "@/components/CanvasDraw";
import { PRACTICE_PHRASES } from "@/lib/practice-paper";

function PracticeContent() {
  const router = useRouter();
  // Start somewhere other than the same first phrase every visit.
  const [idx, setIdx] = useState(() => {
    const h = new Date().getHours();
    return h % PRACTICE_PHRASES.length;
  });
  const phrase = PRACTICE_PHRASES[idx];

  const shuffle = () => {
    setIdx((i) => {
      if (PRACTICE_PHRASES.length < 2) return i;
      let n = i;
      // Advance to a different phrase.
      while (n === i) n = Math.floor(Math.random() * PRACTICE_PHRASES.length);
      return n;
    });
  };

  return (
    <div className="prac-wrap">
      <header className="prac-head">
        <h1 className="prac-title">Writing practice</h1>
        <p className="prac-sub">
          Trace the faint line, then write it again below. Take your time — there&apos;s nothing to send here.
        </p>
        <p className="prac-caveat">
          <span className="prac-pen">✎</span> Works best with a pressure-sensitive pen (Apple Pencil, S Pen, and the
          like). On a mouse or trackpad you&apos;ll still get the lines, but the ink won&apos;t thicken and thin with
          your hand.
        </p>
      </header>

      <CanvasDraw
        practiceMode
        guideText={phrase}
        onShufflePhrase={shuffle}
        onComplete={() => {}}
        onCancel={() => router.push("/")}
      />

      <style>{`
        .prac-wrap { max-width: 960px; margin: 0 auto; padding: 18px 16px 40px; }
        .prac-head { text-align: center; margin-bottom: 14px; }
        .prac-title { font-size: 26px; color: #2c2416; margin: 0 0 4px; }
        .prac-sub { color: #6b5640; margin: 0 auto 10px; max-width: 560px; line-height: 1.5; }
        .prac-caveat {
          display: inline-block; max-width: 620px; margin: 0 auto;
          font-size: 13px; color: #6b5640; line-height: 1.5;
          background: #fff8e6; border: 1px solid #ecdcae; border-radius: 10px; padding: 9px 14px;
        }
        .prac-pen { color: #8b4513; font-weight: 700; margin-right: 4px; }
      `}</style>
    </div>
  );
}

export default function PracticePage() {
  return (
    <AuthGuard>
      <NavBar />
      <PracticeContent />
    </AuthGuard>
  );
}
