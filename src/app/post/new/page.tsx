"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { useAuth } from "@/hooks/useAuth";
import { CanvasDraw, type CanvasPage } from "@/components/CanvasDraw";
import { LetterEnvelope } from "@/components/LetterEnvelope";
import { PhotoUpload } from "@/components/PhotoUpload";
import { UserSearch } from "@/components/UserSearch";

type PostMode = "choose" | "canvas" | "postcard" | "photo" | "photocard";
type PostStep = "draw" | "seal" | "send" | "photo";

interface Recipient {
  id: string;
  username: string;
  nomDePlume: string | null;
}

function NewPostContent() {
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
  const [sendMode, setSendMode] = useState<"feed" | "private" | "dead">("feed");
  const [slowPost, setSlowPost] = useState(false);
  // Photo postcard: the chosen front image, held until the back note is drawn.
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  // Request Board context: writing an ask for someone, or answering one
  const [requestOf, setRequestOf] = useState<Recipient | null>(null);
  const [fulfillReq, setFulfillReq] = useState<{ id: string; requester: Recipient } | null>(null);
  const [renderResult, setRenderResult] = useState<{
    pages: CanvasPage[];
    durationMs: number;
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
    if (searchParams.get("mode") === "postcard") {
      setMode("postcard");
    }
    // dead_letter=1: pre-address this letter to no one at all
    if (searchParams.get("dead_letter") === "1") {
      setSendMode("dead");
      setMode("canvas");
    }
  }, [searchParams]);

  // request_of=<userId>: this drawing is a handwritten ask for the Request Board
  useEffect(() => {
    const requestOfId = searchParams.get("request_of");
    if (!requestOfId) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${requestOfId}`);
        if (res.ok) {
          const data = await res.json();
          setRequestOf({ id: data.user.id, username: data.user.username, nomDePlume: data.user.nomDePlume });
          setMode("canvas");
        }
      } catch { /* ignore */ }
    })();
  }, [searchParams]);

  // fulfill=<requestId>: this letter answers an open request
  useEffect(() => {
    const fulfillId = searchParams.get("fulfill");
    if (!fulfillId) return;
    (async () => {
      try {
        const res = await fetch(`/api/requests/${fulfillId}`);
        if (res.ok) {
          const data = await res.json();
          setFulfillReq({ id: data.request.id, requester: data.request.requester });
          setMode("canvas");
        }
      } catch { /* ignore */ }
    })();
  }, [searchParams]);

  const pagesToBody = (pages: CanvasPage[]) =>
    pages.map((p) => ({ canvas_stroke_data: p.strokes, ink_style: p.inkStyle, paper: p.paper }));

  const handleCanvasComplete = async (pages: CanvasPage[], drawingDurationMs: number) => {
    setSubmitting(true);
    setError("");

    // A request ask goes straight to the board — no envelope ceremony
    if (requestOf) {
      try {
        const res = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: pagesToBody(pages),
            drawing_duration_ms: drawingDurationMs,
            request_of: requestOf.id,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          router.push("/requests");
        } else {
          setError(data.error || "Failed to pin your request");
        }
      } catch {
        setError("Something went wrong");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Postcards (and photo postcards) skip the envelope ceremony: straight to
    // addressing.
    if (mode === "postcard" || mode === "photocard") {
      setRenderResult({ pages, durationMs: drawingDurationMs });
      setStep("send");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: pagesToBody(pages),
          drawing_duration_ms: drawingDurationMs,
          preview_only: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenderResult({ pages, durationMs: drawingDurationMs, imageUrl: data.imageUrl });
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
    if (fulfillReq) {
      // An answer to a request is always public — skip the send-choice step
      await submitFinal({ envelopeData, signatureStrokes });
      return;
    }
    setStep("send");
  };

  const submitFinal = async (envelope: { envelopeData: any; signatureStrokes?: any[] } | null) => {
    if (!renderResult) return;

    // Photo postcard: multipart (front photo file + back-note strokes).
    if (mode === "photocard") {
      if (!photoFile) { setError("Choose a photo for the front first."); return; }
      setSubmitting(true);
      setError("");
      try {
        const back = renderResult.pages[0];
        const fd = new FormData();
        fd.append("photo", photoFile);
        fd.append("format", "photocard");
        fd.append("canvas_stroke_data", JSON.stringify(back.strokes));
        fd.append("ink_style", back.inkStyle);
        fd.append("paper", back.paper);
        fd.append("drawing_duration_ms", String(renderResult.durationMs));
        if (sendMode === "dead") {
          fd.append("is_dead_letter", "true");
        } else if (sendMode === "private" && recipient?.id) {
          fd.append("recipient_id", recipient.id);
          fd.append("is_private", "true");
        }
        const res = await fetch("/api/posts", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) {
          router.push(
            sendMode === "private" ? "/inbox" : sendMode === "dead" ? "/dead-letters?left=1" : `/post/${data.post.id}`
          );
        } else {
          setError(data.error || "Failed to send your postcard");
        }
      } catch {
        setError("Something went wrong");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const body: Record<string, any> = {
        pages: pagesToBody(renderResult.pages),
        drawing_duration_ms: renderResult.durationMs,
      };
      if (envelope) {
        body.envelope_data = envelope.envelopeData;
        body.signature_data = envelope.signatureStrokes || null;
      }
      if (mode === "postcard") {
        body.format = "postcard";
      }

      if (fulfillReq) {
        body.fulfills_request_id = fulfillReq.id;
      } else if (sendMode === "dead") {
        body.is_dead_letter = true;
      } else if (sendMode === "private" && recipient?.id) {
        body.recipient_id = recipient.id;
        body.is_private = true;
        if (slowPost) body.delivery = "slow";
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (fulfillReq) {
          router.push("/requests");
        } else if (sendMode === "dead") {
          router.push("/dead-letters?left=1");
        } else if (sendMode === "private") {
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

  const handleFinalSubmit = async () => {
    if (mode === "postcard" || mode === "photocard") {
      await submitFinal(null);
      return;
    }
    if (!envelopeResult) return;
    await submitFinal(envelopeResult);
  };

  return (
    <AuthGuard>
      <NavBar />
      <main className="new-main">
        {error && <div className="err-banner">{error}</div>}
        {requestOf && (
          <div className="ctx-banner">
            &#128204; Writing a request for <strong>{requestOf.username}</strong> — ask them, in your
            own hand, to write or draw something. It&apos;ll be pinned to the Request Board.
          </div>
        )}
        {fulfillReq && (
          <div className="ctx-banner">
            &#9993; Answering <strong>{fulfillReq.requester.username}</strong>&apos;s request — your
            letter will be posted publicly and pinned beside their ask.
          </div>
        )}
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
              <button onClick={() => setMode("postcard")} className="mode-btn postcard-btn">
                <span className="mode-icon">&#127966;</span>
                <span className="mode-label">Send a Postcard</span>
                <span className="mode-desc">Smaller, quicker, postmarked on arrival</span>
              </button>
              <button onClick={() => { setMode("photocard"); setStep("photo"); }} className="mode-btn photocard-btn">
                <span className="mode-icon">&#128247;</span>
                <span className="mode-label">Photo Postcard</span>
                <span className="mode-desc">A photo on front, your note on the back — flip to read</span>
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
            <CanvasDraw onComplete={handleCanvasComplete} onCancel={() => { setMode("choose"); setStep("draw"); }} maxPages={5} />
          </div>
        )}

        {mode === "postcard" && step === "draw" && (
          <div className="canvas-section">
            <button onClick={() => { setMode("choose"); setStep("draw"); }} className="back-btn">
              &larr; Back
            </button>
            <CanvasDraw
              onComplete={handleCanvasComplete}
              onCancel={() => { setMode("choose"); setStep("draw"); }}
              canvasW={1600}
              canvasH={1100}
              minDrawTimeMs={8000}
              submitLabel="Address the Postcard"
            />
          </div>
        )}

        {mode === "photocard" && step === "photo" && (
          <div className="photo-section">
            <button onClick={() => { setMode("choose"); setStep("draw"); setPhotoFile(null); }} className="back-btn">
              &larr; Pick mode
            </button>
            <h2 className="pg-title" style={{ textAlign: "center" }}>Choose the front photo</h2>
            <p className="pg-sub" style={{ textAlign: "center" }}>
              It&apos;ll be fitted to a postcard. You&apos;ll handwrite the note on the back next.
            </p>
            <PhotoUpload
              submitLabel="Use this photo &rarr;"
              onUpload={(file) => { setPhotoFile(file); setStep("draw"); }}
              onCancel={() => { setMode("choose"); setStep("draw"); setPhotoFile(null); }}
            />
          </div>
        )}

        {mode === "photocard" && step === "draw" && (
          <div className="canvas-section">
            <button onClick={() => setStep("photo")} className="back-btn">
              &larr; Change photo
            </button>
            <h2 className="pg-title" style={{ textAlign: "center" }}>Now write the back of the card</h2>
            <CanvasDraw
              onComplete={handleCanvasComplete}
              onCancel={() => setStep("photo")}
              canvasW={1600}
              canvasH={1100}
              minDrawTimeMs={8000}
              submitLabel="Address the Postcard"
            />
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

        {(mode === "canvas" || mode === "postcard" || mode === "photocard") && step === "send" && (
          <div className="send-section">
            {mode === "canvas" ? (
              <button onClick={() => setStep("seal")} className="back-btn">
                &larr; Edit envelope
              </button>
            ) : (
              <button onClick={() => setStep("draw")} className="back-btn">
                &larr; Back to the postcard
              </button>
            )}

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

              <button
                className={`send-option ${sendMode === "dead" ? "active" : ""}`}
                onClick={() => setSendMode("dead")}
              >
                <span className="send-opt-icon">&#128452;</span>
                <div className="send-opt-body">
                  <span className="send-opt-label">Leave at the Dead Letter Office</span>
                  <span className="send-opt-desc">Addressed to no one. A stranger will claim it, sight unseen</span>
                </div>
                {sendMode === "dead" && <span className="send-check">&#10003;</span>}
              </button>
            </div>

            {sendMode === "private" && (
              <div className="send-recipient">
                <label className="send-recipient-label">Who should receive this letter?</label>
                <UserSearch
                  onSelect={(user) => setRecipient({ id: user.id, username: user.username, nomDePlume: user.nomDePlume })}
                  placeholder="Search by username..."
                />
                <label className="slow-post-row">
                  <input
                    type="checkbox"
                    checked={slowPost}
                    onChange={(e) => setSlowPost(e.target.checked)}
                  />
                  <span>
                    <strong>Send by evening post</strong> — travels overnight, arrives
                    tomorrow at 8 in the morning
                  </span>
                </label>
              </div>
            )}

            <div className="send-actions">
              <button
                onClick={handleFinalSubmit}
                className="send-final-btn"
                disabled={sendMode === "private" && !recipient?.id}
              >
                {sendMode === "private"
                  ? `Send to ${recipient?.username || "..."}${slowPost ? " (by evening post)" : ""}`
                  : sendMode === "dead"
                  ? "Leave it with the clerk"
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
          background: #1a1a1a;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
          margin-bottom: 6px;
        }
        .pg-sub { text-align: center; color: #8c7a60; font-style: italic; margin-bottom: 32px; font-size: 15px; }
        .mode-choose { max-width: 500px; margin: 0 auto; padding-top: 40px; }
        .mode-btns { display: flex; flex-direction: column; gap: 12px; }
        .mode-btn {
          width: 100%; padding: 24px 20px; border: 2px solid #e0d5c0; border-radius: 8px;
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
          border-radius: 8px;
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
        .slow-post-row {
          display: flex; align-items: flex-start; gap: 9px;
          margin-top: 12px; padding: 10px 12px;
          background: #fef9f0; border: 1px solid #ecdfc2; border-radius: 7px;
          font-size: 13px; color: #6b5c40; cursor: pointer;
        }
        .slow-post-row input { margin-top: 2px; }
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
          border-radius: 8px;
          background: #1a1a1a;
          color: #fff;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          transition: all 0.15s;
        }
        .send-final-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
        }
        .send-final-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .ctx-banner {
          max-width: 560px; margin: 0 auto 16px;
          background: #fef9f0; border: 1px solid #e8d5a0; color: #6b5520;
          padding: 12px 16px; border-radius: 6px; text-align: center; font-size: 14px;
        }
        .err-banner {
          background: #fef5f5; border: 1px solid #f5c6cb; color: #c0392b;
          padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; text-align: center; font-size: 14px;
        }
        .submit-overlay {
          position: fixed; inset: 0; background: rgba(250,247,240,0.92);
          z-index: 300; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 16px; font-size: 16px; font-style: italic; color: #6b5c40;
        }
        .splat-spinner {
          width: 48px; height: 48px; border-radius: 50%;
          border: 4px solid #e0d5c0; border-top-color: #1a1a1a;
          animation: ink-spin 0.7s linear infinite;
        }
        @keyframes ink-spin { to { transform: rotate(360deg); } }
      `}</style>
    </AuthGuard>
  );
}

export default function NewPostPage() {
  return (
    <Suspense fallback={null}>
      <NewPostContent />
    </Suspense>
  );
}
