"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { CanvasDraw } from "@/components/CanvasDraw";
import { PhotoUpload } from "@/components/PhotoUpload";

type PostMode = "choose" | "canvas" | "photo";

export default function NewPostPage() {
  const router = useRouter();
  const [mode, setMode] = useState<PostMode>("choose");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleCanvasComplete = async (strokes: any[], drawingDurationMs: number, paper: string, inkStyle: string) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_stroke_data: strokes, drawing_duration_ms: drawingDurationMs, paper, ink_style: inkStyle }),
      });
      const data = await res.json();
      if (res.ok) { router.push(`/post/${data.post.id}`); }
      else { setError(data.error || "Failed to create post"); }
    } catch {
      setError("Something went wrong");
    } finally { setSubmitting(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    setSubmitting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/posts", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) { router.push(`/post/${data.post.id}`); }
      else { setError(data.error || "Failed to create post"); }
    } catch {
      setError("Something went wrong");
    } finally { setSubmitting(false); }
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="new-main">
        {error && <div className="err-banner">{error}</div>}
        {submitting && (
          <div className="submit-overlay">
            <div className="splat-spinner" />
            <p>Rendering your ink...</p>
          </div>
        )}

        {mode === "choose" && (
          <div className="mode-choose">
            <h1 className="pg-title">Put Pen to Paper</h1>
            <p className="pg-sub">Draw by hand or upload a photo of your handwriting.</p>
            <div className="mode-btns">
              <button onClick={() => setMode("canvas")} className="mode-btn draw-btn">
                <span className="mode-icon">&#9998;</span>
                <span className="mode-label">Draw</span>
                <span className="mode-desc">Pen, stylus, or finger</span>
              </button>
              <button onClick={() => setMode("photo")} className="mode-btn photo-btn">
                <span className="mode-icon">&#128247;</span>
                <span className="mode-label">Photo</span>
                <span className="mode-desc">Upload your handwriting</span>
              </button>
            </div>
          </div>
        )}

        {mode === "canvas" && (
          <div className="canvas-section">
            <button onClick={() => setMode("choose")} className="back-btn">&larr; Pick mode</button>
            <CanvasDraw onComplete={handleCanvasComplete} onCancel={() => setMode("choose")} />
          </div>
        )}

        {mode === "photo" && (
          <div className="photo-section">
            <button onClick={() => setMode("choose")} className="back-btn">&larr; Pick mode</button>
            <PhotoUpload onUpload={handlePhotoUpload} onCancel={() => setMode("choose")} />
          </div>
        )}
      </main>

      <style>{`
        .new-main {
          min-height: calc(100vh - 60px);
          padding: 20px 12px 40px;
        }
        .pg-title {
          font-size: 32px; font-weight: 700; text-align: center;
          background: linear-gradient(135deg, #1a1a2e, #8e44ad, #c0392b);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 6px;
        }
        .pg-sub { text-align: center; color: #8c7a60; font-style: italic; margin-bottom: 32px; font-size: 15px; }
        .mode-choose { max-width: 500px; margin: 0 auto; padding-top: 40px; }
        .mode-btns { display: flex; gap: 16px; }
        .mode-btn {
          flex: 1; padding: 36px 20px; border: 2px solid #e0d5c0; border-radius: 16px;
          background: #fefdf9; cursor: pointer; display: flex; flex-direction: column;
          align-items: center; gap: 8px; transition: all 0.2s; font-family: inherit;
        }
        .mode-btn:hover { border-color: #8b4513; box-shadow: 0 4px 20px rgba(80,40,20,0.08); }
        .mode-icon { font-size: 44px; }
        .mode-label { font-size: 18px; font-weight: 700; color: #2c2416; }
        .mode-desc { font-size: 13px; color: #8c7a60; }
        .back-btn {
          background: none; border: none; font-size: 14px; color: #8c7a60;
          cursor: pointer; font-family: inherit; padding: 6px 0 14px; display: block;
        }
        .back-btn:hover { color: #2c2416; }
        .canvas-section { max-width: 100%; margin: 0 auto; }
        .photo-section { max-width: 540px; margin: 0 auto; }
        .err-banner {
          background: #fef5f5; border: 1px solid #f5c6cb; color: #c0392b;
          padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; text-align: center; font-size: 14px;
        }
        .submit-overlay {
          position: fixed; inset: 0; background: rgba(250,247,240,0.92);
          z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; font-size: 16px; font-style: italic; color: #6b5c40;
        }
        .splat-spinner {
          width: 48px; height: 48px; border-radius: 50%;
          border: 4px solid #e0d5c0; border-top-color: #c0392b;
          animation: ink-spin 0.7s linear infinite;
        }
        @keyframes ink-spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthGuard>
  );
}
