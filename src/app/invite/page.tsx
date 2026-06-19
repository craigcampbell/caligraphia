"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { CanvasDraw } from "@/components/CanvasDraw";

type Step = "address" | "write" | "sent";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function InviteContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("address");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/invites")
      .then((r) => r.json())
      .then((d) => setRemaining(d.remainingThisWeek ?? null))
      .catch(() => {});
  }, []);

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setStep("write");
  };

  const handleComplete = async (
    strokes: unknown[],
    drawingDurationMs: number,
    paper: string,
    inkStyle: string
  ) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          canvas_stroke_data: strokes,
          drawing_duration_ms: drawingDurationMs,
          paper,
          ink_style: inkStyle,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRemaining((r) => (r === null ? r : Math.max(0, r - 1)));
        setStep("sent");
      } else {
        setError(data.error || "Failed to send your invitation.");
        setStep("address");
      }
    } catch {
      setError("Something went wrong sending your invitation.");
      setStep("address");
    } finally {
      setSubmitting(false);
    }
  };

  const outOfInvites = remaining === 0;

  return (
    <AuthGuard>
      <NavBar />
      <main className="inv-main">
        {submitting && (
          <div className="submit-overlay">
            <div className="splat-spinner" />
            <p>Posting your invitation...</p>
          </div>
        )}

        {error && <div className="err-banner">{error}</div>}

        {step === "address" && (
          <div className="inv-card">
            <div className="inv-mark">&#9993;</div>
            <h1 className="inv-title">Invite a Friend</h1>
            <p className="inv-sub">
              Send someone a handwritten postcard and a way in. You may send{" "}
              <strong>two a week</strong>.
            </p>
            {remaining !== null && (
              <p className="inv-remaining">
                {outOfInvites
                  ? "You've used both invitations this week. Come back in a few days."
                  : `${remaining} invitation${remaining === 1 ? "" : "s"} left this week`}
              </p>
            )}

            {!outOfInvites && (
              <form onSubmit={handleContinue} className="inv-form">
                <label className="inv-label" htmlFor="invite-email">
                  Their email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className="inv-input"
                  autoFocus
                  data-allow-text="true"
                />
                <button type="submit" className="inv-btn">
                  Write the postcard &rarr;
                </button>
              </form>
            )}
          </div>
        )}

        {step === "write" && (
          <div className="canvas-section">
            <button onClick={() => setStep("address")} className="back-btn">
              &larr; Back
            </button>
            <p className="inv-write-hint">
              Write a few words by hand to <strong>{email.trim()}</strong> — their
              name, &ldquo;wish you were here,&rdquo; whatever you like. It arrives
              as a postmarked postcard.
            </p>
            <CanvasDraw
              onComplete={handleComplete}
              onCancel={() => setStep("address")}
              canvasW={1600}
              canvasH={1100}
              minDrawTimeMs={6000}
              submitLabel="Post this invitation"
            />
          </div>
        )}

        {step === "sent" && (
          <div className="inv-card">
            <div className="inv-mark">&#10003;</div>
            <h1 className="inv-title">On its way</h1>
            <p className="inv-sub">
              Your postcard has been posted to <strong>{email.trim()}</strong>.
              When they accept, you&apos;ll become friends here.
            </p>
            <div className="sent-actions">
              <button
                onClick={() => {
                  setEmail("");
                  setError("");
                  setStep("address");
                }}
                className="inv-btn-secondary"
                disabled={outOfInvites}
              >
                Send another
              </button>
              <button onClick={() => router.push("/")} className="inv-btn">
                Done
              </button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        .inv-main { min-height: calc(100vh - 60px); padding: 20px 12px 40px; }
        .inv-card {
          max-width: 440px; margin: 32px auto 0; background: #fffef9;
          border: 1px solid #e0d5c0; border-radius: 8px; padding: 40px 36px;
          box-shadow: 0 4px 32px rgba(80,40,20,0.06); text-align: center;
        }
        .inv-mark { font-size: 44px; color: #1a1a1a; margin-bottom: 4px; }
        .inv-title { font-size: 26px; font-weight: 700; color: #1a1a1a; margin-bottom: 8px; }
        .inv-sub { color: #6b5c40; font-size: 15px; line-height: 1.5; margin-bottom: 12px; }
        .inv-remaining { font-size: 13px; color: #8b6914; font-style: italic; margin-bottom: 20px; }
        .inv-form { display: flex; flex-direction: column; gap: 12px; text-align: left; }
        .inv-label { font-size: 13px; font-weight: 500; color: #6b5c40; }
        .inv-input {
          padding: 14px 16px; border: 2px solid #27ae60; border-radius: 6px;
          font-size: 16px; font-family: inherit; outline: none; background: #f4faf6;
          user-select: text; -webkit-user-select: text;
        }
        .inv-input:focus { border-color: #1a1a1a; }
        .inv-btn {
          padding: 14px; background: #1a1a1a; color: #fff; border: none; border-radius: 6px;
          font-size: 16px; font-weight: 700; cursor: pointer; font-family: inherit;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18); transition: transform 0.15s, box-shadow 0.15s;
        }
        .inv-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
        .inv-btn-secondary {
          padding: 14px; background: #fefdf9; color: #2c2416; border: 2px solid #e0d5c0;
          border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .inv-btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .sent-actions { display: flex; gap: 10px; margin-top: 8px; }
        .sent-actions > * { flex: 1; }
        .canvas-section { max-width: 100%; margin: 0 auto; }
        .inv-write-hint {
          max-width: 560px; margin: 0 auto 12px; text-align: center;
          color: #6b5c40; font-size: 14px; line-height: 1.5;
        }
        .back-btn {
          background: none; border: none; font-size: 14px; color: #8c7a60;
          cursor: pointer; font-family: inherit; padding: 6px 0 8px; display: block;
        }
        .back-btn:hover { color: #2c2416; }
        .err-banner {
          max-width: 440px; margin: 0 auto 16px;
          background: #fef5f5; border: 1px solid #f5c6cb; color: #c0392b;
          padding: 12px 16px; border-radius: 6px; text-align: center; font-size: 14px;
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

export default function InvitePage() {
  return <InviteContent />;
}
