"use client";

import { useEffect, useState } from "react";
import { CanvasDraw, type CanvasPage } from "@/components/CanvasDraw";

type Mode = "on_sheet" | "fresh";

// "Write back" to a letter. The author chooses to reply on the original sheet
// (draw on top of it) or on a fresh page that threads as a reply. Both post to
// /api/posts/[id]/replies.
export function WriteBack({
  postId,
  letterImageUrl,
  onPosted,
}: {
  postId: string;
  letterImageUrl?: string | null;
  onPosted?: () => void;
}) {
  const [stage, setStage] = useState<"idle" | "choose" | "compose">("idle");
  const [mode, setMode] = useState<Mode>("fresh");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Escape closes the mode chooser.
  useEffect(() => {
    if (stage !== "choose") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStage("idle");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage]);

  const handleComplete = async (pages: CanvasPage[], durationMs: number) => {
    if (busy || pages.length === 0) return;
    setBusy(true);
    setErr(null);
    const page0 = pages[0];
    try {
      const res = await fetch(`/api/posts/${postId}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          canvas_stroke_data: page0.strokes,
          ink_style: page0.inkStyle,
          paper: page0.paper,
          drawing_duration_ms: durationMs,
        }),
      });
      if (res.ok) {
        setStage("idle");
        setBusy(false);
        onPosted?.();
        return;
      }
      const data = await res.json().catch(() => null);
      setErr(data?.error || "Could not send your write-back.");
      setStage("idle");
      setBusy(false);
    } catch {
      setErr("Could not send your write-back.");
      setStage("idle");
      setBusy(false);
    }
  };

  return (
    <>
      <button className="btn-writeback" onClick={() => { setErr(null); setStage("choose"); }}>
        ✎ Write back
      </button>
      {err && stage === "idle" && <div className="wb-err">{err}</div>}

      {stage === "choose" && (
        <div className="wb-backdrop" onClick={() => setStage("idle")}>
          <div
            className="wb-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Write back options"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Write back</h3>
            <p className="wb-lead">How would you like to reply?</p>
            <div className="wb-choices">
              {letterImageUrl && (
                <button
                  className="wb-choice"
                  autoFocus
                  onClick={() => { setMode("on_sheet"); setStage("compose"); }}
                >
                  <strong>On their letter</strong>
                  <span>Draw right on top of this page</span>
                </button>
              )}
              <button
                className="wb-choice"
                autoFocus={!letterImageUrl}
                onClick={() => { setMode("fresh"); setStage("compose"); }}
              >
                <strong>Fresh page</strong>
                <span>A new page that threads as a reply</span>
              </button>
            </div>
            <button className="wb-cancel" onClick={() => setStage("idle")}>Cancel</button>
          </div>
        </div>
      )}

      {stage === "compose" && (
        <div className="wb-composer">
          <CanvasDraw
            onComplete={handleComplete}
            onCancel={() => setStage("idle")}
            submitLabel={mode === "on_sheet" ? "Send write-back" : "Send reply"}
            minDrawTimeMs={1500}
            backgroundImageUrl={mode === "on_sheet" ? letterImageUrl ?? undefined : undefined}
          />
        </div>
      )}

      <style>{`
        .btn-writeback {
          padding: 8px 16px;
          border: 1px solid #b98a5e;
          border-radius: 8px;
          background: #fff;
          color: #8a5a2b;
          cursor: pointer;
          font-weight: 600;
          font-family: inherit;
          font-size: 15px;
        }
        .btn-writeback:hover { background: #fbf3e8; }
        .wb-err {
          color: #9c3b34; background: #f6e3e1; border: 1px solid #e3b9b4;
          padding: 8px 12px; border-radius: 8px; margin-top: 8px; font-size: 14px;
        }
        .wb-backdrop {
          position: fixed; inset: 0; z-index: 250;
          background: rgba(40,30,20,0.45);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .wb-sheet {
          background: #faf7f0; border: 1px solid rgba(90,70,50,0.3);
          border-radius: 14px; padding: 24px; max-width: 440px; width: 100%;
          box-shadow: 0 18px 50px rgba(0,0,0,0.3); color: #3a2e22;
        }
        .wb-sheet h3 { margin: 0 0 4px; }
        .wb-lead { margin: 0 0 16px; color: #6b5640; font-size: 14px; }
        .wb-choices { display: flex; flex-direction: column; gap: 10px; }
        .wb-choice {
          text-align: left; display: flex; flex-direction: column; gap: 3px;
          padding: 14px 16px; border: 1px solid #d8c7ab; border-radius: 10px;
          background: #fffdf8; cursor: pointer; font-family: inherit; color: #3a2e22;
        }
        .wb-choice:hover { border-color: #b98a5e; background: #fbf3e8; }
        .wb-choice strong { font-size: 15px; }
        .wb-choice span { font-size: 13px; color: #6b5640; }
        .wb-cancel {
          margin-top: 16px; width: 100%; padding: 9px; border: 1px solid #d8c7ab;
          border-radius: 8px; background: transparent; color: #6b5640;
          cursor: pointer; font-family: inherit; font-size: 14px;
        }
        .wb-composer {
          position: fixed; inset: 0; z-index: 300;
          background: #f3ece0;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }
      `}</style>
    </>
  );
}
