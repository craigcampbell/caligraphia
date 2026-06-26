"use client";

import { useState } from "react";

// Outbound share for a public letter. Web Share where available (great on
// phones/iPad), plus explicit X / Facebook intents and copy-link. No API
// integration needed — these just open the platforms' share dialogs.
export function ShareButtons({ url, text }: { url: string; text?: string }) {
  const [copied, setCopied] = useState(false);
  const shareText = text || "A letter written entirely by hand on Caligraphia";

  const native = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Caligraphia", text: shareText, url });
      } catch {
        /* user dismissed */
      }
    } else {
      copy();
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=600,height=520");

  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  return (
    <div className="sb-share">
      <button className="sb-b sb-primary" onClick={native}>Share</button>
      <button className="sb-b" onClick={() => open(x)} aria-label="Share on X">X</button>
      <button className="sb-b" onClick={() => open(fb)} aria-label="Share on Facebook">Facebook</button>
      <button className="sb-b" onClick={copy}>{copied ? "Copied!" : "Copy link"}</button>
      <style>{`
        .sb-share { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 14px; }
        .sb-b { font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 8px; border: 1px solid #d8c7ab;
          background: #fffdf8; color: #6b5640; cursor: pointer; }
        .sb-b:hover { border-color: #b98a5e; }
        .sb-primary { background: #6b5640; color: #faf7f0; border-color: #6b5640; font-weight: 600; }
        .sb-primary:hover { background: #5a4836; }
      `}</style>
    </div>
  );
}
