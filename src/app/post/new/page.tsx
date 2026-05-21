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

  const handleCanvasComplete = async (strokes: any[]) => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas_stroke_data: strokes }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/post/${data.post.id}`);
      } else {
        setError(data.error || "Failed to create post");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    setSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("photo", file);

      const res = await fetch("/api/posts", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/post/${data.post.id}`);
      } else {
        setError(data.error || "Failed to create post");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="new-post-main">
        {error && <div className="error-banner">{error}</div>}

        {submitting && (
          <div className="submitting-overlay">
            <div className="spinner" />
            <p>Creating your post...</p>
          </div>
        )}

        {mode === "choose" && (
          <div className="mode-choose">
            <h1 className="page-title">Create a Post</h1>
            <p className="page-subtitle">
              Draw by hand or upload a photo of your handwriting.
            </p>
            <div className="mode-buttons">
              <button onClick={() => setMode("canvas")} className="mode-btn canvas-btn">
                <span className="mode-icon">&#9998;</span>
                <span className="mode-label">Draw</span>
                <span className="mode-desc">Use your pen or finger to write</span>
              </button>
              <button onClick={() => setMode("photo")} className="mode-btn photo-btn">
                <span className="mode-icon">&#128247;</span>
                <span className="mode-label">Photo</span>
                <span className="mode-desc">Upload a picture of your writing</span>
              </button>
            </div>
          </div>
        )}

        {mode === "canvas" && (
          <div className="canvas-section">
            <button onClick={() => setMode("choose")} className="back-btn">
              &larr; Back
            </button>
            <CanvasDraw
              onComplete={handleCanvasComplete}
              onCancel={() => setMode("choose")}
            />
          </div>
        )}

        {mode === "photo" && (
          <div className="photo-section">
            <button onClick={() => setMode("choose")} className="back-btn">
              &larr; Back
            </button>
            <h1 className="page-title">Upload a Photo</h1>
            <PhotoUpload
              onUpload={handlePhotoUpload}
              onCancel={() => setMode("choose")}
            />
          </div>
        )}
      </main>

      <style>{`
        .new-post-main {
          padding: 24px 16px;
          min-height: calc(100vh - 60px);
        }
        .page-title {
          font-size: 28px;
          font-weight: 700;
          margin-bottom: 8px;
          text-align: center;
        }
        .page-subtitle {
          text-align: center;
          color: #888;
          margin-bottom: 32px;
          font-size: 15px;
        }
        .mode-choose {
          max-width: 480px;
          margin: 0 auto;
          padding-top: 40px;
        }
        .mode-buttons {
          display: flex;
          gap: 16px;
        }
        .mode-btn {
          flex: 1;
          padding: 32px 20px;
          border: 2px solid #e0e0e0;
          border-radius: 14px;
          background: #fff;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .mode-btn:hover {
          border-color: #111;
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
        }
        .mode-icon {
          font-size: 40px;
        }
        .mode-label {
          font-size: 18px;
          font-weight: 700;
        }
        .mode-desc {
          font-size: 13px;
          color: #888;
        }
        .back-btn {
          background: none;
          border: none;
          font-size: 15px;
          color: #555;
          cursor: pointer;
          font-family: inherit;
          padding: 8px 0;
          margin-bottom: 16px;
        }
        .back-btn:hover {
          color: #111;
        }
        .canvas-section, .photo-section {
          max-width: 600px;
          margin: 0 auto;
        }
        .error-banner {
          background: #fff5f5;
          border: 1px solid #fc8181;
          color: #c53030;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          text-align: center;
          font-size: 14px;
        }
        .submitting-overlay {
          position: fixed;
          inset: 0;
          background: rgba(255,255,255,0.9);
          z-index: 300;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          font-size: 16px;
          color: #555;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #e0e0e0;
          border-top-color: #333;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthGuard>
  );
}
