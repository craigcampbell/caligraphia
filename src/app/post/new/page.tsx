"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { CanvasDraw } from "@/components/CanvasDraw";
import { LetterEnvelope } from "@/components/LetterEnvelope";
import { PhotoUpload } from "@/components/PhotoUpload";
import { UserSearch } from "@/components/UserSearch";

type PostMode = "choose" | "canvas" | "photo";
type PostStep = "draw" | "seal" | "send";

interface Recipient {
  id: string;
  username: string;
  nomDePlume: string | null;
}

export default function NewPostPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // Check if it's midnight mode (2-4 AM)
  const isMidnight = (() => {
    const h = new Date().getHours();
    return h >= 2 && h < 4;
  })();
  const [mode, setMode] = useState<PostMode>(
    searchParams.get("mode") === "draw" ? "canvas" : "choose"
  );
  const [step, setStep] = useState<PostStep>("draw");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [sendMode, setSendMode] = useState<"feed" | "private">("feed");
  const [renderResult, setRenderResult] = useState<{
    strokes: any[];
    durationMs: number;
    paper: string;
    inkStyle: string;
    imageUrl?: string;
  } | null>(null);
  const [envelopeResult, setEnvelopeResult] = useState<{
    envelopeData: any;
    signatureStrokes?: any[];
  } | null>(null);

  // If send_to is in the URL, pre-select that user as recipient
  useEffect(() => {
    const sendToId = searchParams.get("send_to");
    if (sendToId) {
      (async () => {
        try {
          const res = await fetch(`/api/users/${sendToId}`);
          if (res.ok) {
            const data = await res.json();
            setRecipient({ id: data.user.id, username: data.user.username, nomDePlume: data.user.nomDePlume });
            setSendMode("private");
          }
        } catch { /* ignore */ }
      })();
    }
  }, [searchParams]);

  // If mode=draw was passed, start on canvas
  useEffect(() => {
    if (searchParams.get("mode") === "draw") {
      setMode("canvas");
    }
  }, [searchParams]);

  const handleCanvasComplete = async (strokes: any[], drawingDurationMs: number, paper: string, inkStyle: string) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_stroke_data: strokes,
          drawing_duration_ms: drawingDurationMs,
          paper,
          ink_style: inkStyle,
          preview_only: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenderResult({ strokes, durationMs: drawingDurationMs, paper, inkStyle, imageUrl: data.imageUrl });
        setStep("seal");
      } else {
        setError(data.error || "Failed to render letter");
      }
    } catch {
      setError("Something went wrong rendering your letter");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnvelopeComplete = async (envelopeData: any, signatureStrokes?: any[]) => {
    setEnvelopeResult({ envelopeData, signatureStrokes });
    setStep("send");
  };

  const handleFinalSubmit = async () => {
    if (!renderResult || !envelopeResult) return;
    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, any> = {
        canvas_stroke_data: renderResult.strokes,
        drawing_duration_ms: renderResult.durationMs,
        paper: renderResult.paper,
        ink_style: renderResult.inkStyle,
        envelope_data: envelopeResult.envelopeData,
        signature_data: envelopeResult.signatureStrokes || null,
      };

      if (sendMode === "private" && recipient?.id) {
        body.recipient_id = recipient.id;
        body.is_private = true;
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (sendMode === "private") {
          router.push("/inbox");
        } else {
          router.push(`/post/${data.post.id}`);
        }
      } else {
        setError(data.error || "Failed to send");
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
      <main className="new-main">
        {error && <div className="err-banner">{error}</div>}
        {submitting && (
          <div className="submit-overlay">
            <div className="splat-spinner" />
            <p>Posting your letter...</p>
          </div>
        )}

        {mode === "choose" && step === "draw" && (
          <div className="mode-choose">
            <h1 className="pg-title">Create Something</h1>
            <p className="pg-sub">Put pen to paper, or snap a photo of your handwriting.</p>
            <div className="mode-btns">
              <button onClick={() => setMode("canvas")} className="mode-btn draw-btn">
                <span className="mode-icon">&#9998;</span>
                <span className="mode-label">Pen a Letter</span>
                <span className="mode-desc">Write a proper letter or note</span>
              </button>
              <button onClick={() => { setMode("canvas"); }} className="mode-btn sketch-btn">
                <span className="mode-icon">&#9998;</span>
                <span className="mode-label">Draw Something</span>
                <span className="mode-desc">Quick sketch, doodle, or scribble</span>
              </button>
              <button onClick={() => setMode("photo")} className="mode-btn photo-btn">
                <span className="mode-icon">&#128247;</span>
                <span className="mode-label">Upload Photo</span>
                <span className="mode-desc">Snap your handwriting</span>
              </button>
            </div>
          </div>
        )}

        {mode === "canvas" && step === "draw" && (
          <div className="canvas-section">
            <button onClick={() => { setMode("choose"); setStep("draw"); }} className="back-btn">
              &larr; Back
            </button>
            <CanvasDraw onComplete={handleCanvasComplete} onCancel={() => { setMode("choose"); setStep("draw"); }} />
          </div>
        )}

        {mode === "canvas" && step === "seal" && renderResult?.imageUrl && (
          <div className="seal-section">
            <LetterEnvelope
              letterImageUrl={renderResult.imageUrl}
              onComplete={handleEnvelopeComplete}
              onBack={() => setStep("draw")}
              username={user?.username}
              stampCount={user?.stampBalance}
              isMidnight={isMidnight}
            />
          </div>
        )}

        {mode === "canvas" && step === "send" && (
          <div className="send-section">
            <button onClick={() => setStep("seal")} className="back-btn">
              &larr; Edit envelope
            </button>

            <h2 className="send-title">Where should this go?</h2>

            <div className="send-options">
              <button
                className={`send-option ${sendMode === "feed" ? "active" : ""}`}
                onClick={() => setSendMode("feed")}
              >
                <span className="send-opt-icon">&#128279;</span>
                <div className="send-opt-body">
                  <span className="send-opt-label">Post to The Postbox</span>
                  <span className="send-opt-desc">Visible on your feed for everyone to see</span>
                </div>
                {sendMode === "feed" && <span className="send-check">&#10003;</span>}
              </button>

              <button
                className={`send-option ${sendMode === "private" ? "active" : ""}`}
                onClick={() => setSendMode("private")}
              >
                <span className="send-opt-icon">&#9993;</span>
                <div className="send-opt-body">
                  <span className="send-opt-label">Send Privately</span>
                  <span className="send-opt-desc">Delivered only to one person&apos;s inbox</span>
                </div>
                {sendMode === "private" && <span className="send-check">&#10003;</span>}
              </button>
            </div>

            {sendMode === "private" && (
              <div className="send-recipient">
                <label className="send-recipient-label">Who should receive this letter?</label>
                <UserSearch
                  onSelect={(user) => setRecipient({ id: user.id, username: user.username, nomDePlume: user.nomDePlume })}
                  placeholder="Search by username..."
                />
              </div>
            )}

            <div className="send-actions">
              <button
                onClick={handleFinalSubmit}
                className="send-final-btn"
                disabled={sendMode === "private" && !recipient?.id}
              >
                {sendMode === "private"
                  ? `Send to ${recipient?.username || "..."}`
                  : "Post to Feed"}
              </button>
            </div>
          </div>
        )}

        {mode === "photo" && (
          <div className="photo-section">
            <button onClick={() => setMode("choose")} className="back-btn">
              &larr; Pick mode
            </button>
            <PhotoUpload onUpload={async (file) => {
              setSubmitting(true);
              setError("");
              try {
                const formData = new FormData();
                formData.append("photo", file);
                if (sendMode === "private" && recipient?.id) {
                  formData.append("recipient_id", recipient.id);
                }
                const res = await fetch("/api/posts", { method: "POST", body: formData });
                const data = await res.json();
                if (res.ok) {
                  router.push(sendMode === "private" ? "/inbox" : `/post/${data.post.id}`);
                } else {
                  setError(data.error || "Failed to create post");
                }
              } catch {
                setError("Something went wrong");
              } finally { setSubmitting(false); }
            }} onCancel={() => setMode("choose")} />
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
        .mode-btns { display: flex; flex-direction: column; gap: 12px; }
        .mode-btn {
          width: 100%; padding: 24px 20px; border: 2px solid #e0d5c0; border-radius: 16px;
          background: #fefdf9; cursor: pointer; display: flex;
          align-items: center; gap: 14px; transition: all 0.2s; font-family: inherit;
        }
        .mode-btn:hover { border-color: #8b4513; box-shadow: 0 4px 20px rgba(80,40,20,0.06); }
        .mode-icon { font-size: 32px; }
        .mode-label { font-size: 17px; font-weight: 700; color: #2c2416; }
        .mode-desc { font-size: 13px; color: #8c7a60; }
        .back-btn {
          background: none; border: none; font-size: 14px; color: #8c7a60;
          cursor: pointer; font-family: inherit; padding: 6px 0 14px; display: block;
        }
        .back-btn:hover { color: #2c2416; }
        .canvas-section, .seal-section { max-width: 100%; margin: 0 auto; }
        .seal-section { max-width: 560px; margin: 0 auto; }
        .photo-section { max-width: 540px; margin: 0 auto; }

        .send-section {
          max-width: 500px;
          margin: 0 auto;
          padding-top: 20px;
        }
        .send-title {
          font-size: 22px;
          font-weight: 700;
          color: #2c2416;
          margin-bottom: 20px;
          text-align: center;
        }
        .send-options {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 20px;
        }
        .send-option {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border: 2px solid #e0d5c0;
          border-radius: 14px;
          background: #fefdf9;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: all 0.15s;
        }
        .send-option:hover { border-color: #c0a880; }
        .send-option.active {
          border-color: #8b4513;
          background: #fef9f0;
          box-shadow: 0 0 0 2px rgba(139,69,19,0.1);
        }
        .send-opt-icon { font-size: 24px; }
        .send-opt-body { flex: 1; }
        .send-opt-label {
          display: block;
          font-weight: 600;
          font-size: 15px;
          color: #2c2416;
          margin-bottom: 2px;
        }
        .send-opt-desc {
          font-size: 12px;
          color: #8c7a60;
        }
        .send-check {
          font-size: 18px;
          color: #8b4513;
        }
        .send-recipient {
          margin-bottom: 20px;
        }
        .send-recipient-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #6b5c40;
          margin-bottom: 8px;
        }
        .send-actions {
          text-align: center;
        }
        .send-final-btn {
          padding: 14px 40px;
          border: none;
          border-radius: 28px;
          background: linear-gradient(135deg, #2c3e50, #c0392b);
          color: #fff;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 16px rgba(192,57,43,0.25);
          transition: all 0.15s;
        }
        .send-final-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(192,57,43,0.35);
        }
        .send-final-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
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
