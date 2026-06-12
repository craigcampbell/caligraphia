"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

function LoginContent() {
  const { user, login, refresh } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [magicLink, setMagicLink] = useState("");

  useEffect(() => { if (user) router.push("/"); }, [user, router]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/auth/verify-magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Invalid link"); return; }
        if (data.needsSignup) {
          router.push(`/signup?signupToken=${encodeURIComponent(data.signupToken)}`);
        } else {
          // Pull the fresh session into the auth provider before navigating,
          // otherwise AuthGuard still sees the stale logged-out state and bounces back here
          await refresh();
          router.push("/");
        }
      } catch { setError("Something went wrong"); }
    })();
  }, [searchParams, router]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) { setError("Please enter a valid email address"); return; }
    setError("");
    const result = await login(email);
    if (result.error) { setError(result.error); }
    else { setSent(true); if (result.magicLink) setMagicLink(result.magicLink); }
  };

  if (user) return null;

  return (
    <div className="login-page">
      <div className="ink-splat ink-splat-1" />
      <div className="ink-splat ink-splat-2" />
      <div className="ink-splat ink-splat-3" />

      <div className="login-card">
        <div className="brand-mark">&#9998;</div>
        <h1 className="login-title">Caligraphia</h1>
        <p className="login-subtitle">
          Where handwriting lives. No keyboards. No copypasta. No bots.
        </p>

        {sent ? (
          <div className="login-sent">
            <div className="sent-icon">&#9993;</div>
            <p>A letter is on its way to <strong>{email}</strong></p>
            <p className="sent-hint">Check your inbox for your sign-in link. It expires in 10 minutes.</p>
            {magicLink && (
              <>
                <p className="sent-hint">Dev mode — use the link below:</p>
                <a href={magicLink} className="magic-link">{magicLink}</a>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSend} className="login-form">
            <label className="input-label" htmlFor="login-email">Email address</label>
            <input
              id="login-email" name="login-email" type="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com" className="email-input"
              autoFocus data-allow-text="true"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-send">Send Magic Link</button>
          </form>
        )}
      </div>

      <style>{`
        .login-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 16px; position: relative; overflow: hidden;
          background: linear-gradient(170deg, #fefcf8 0%, #f5efe0 40%, #faf4ec 100%);
        }
        .ink-splat {
          position: absolute; border-radius: 50%; pointer-events: none; z-index: 0;
          filter: blur(60px); opacity: 0.18;
        }
        .ink-splat-1 { width: 340px; height: 340px; background: radial-gradient(circle, #4a3018, #8b6948, transparent); top: -60px; left: 10%; }
        .ink-splat-2 { width: 260px; height: 260px; background: radial-gradient(circle, #3e2a14, #7a5c3a, transparent); bottom: -40px; right: 15%; }
        .ink-splat-3 { width: 200px; height: 200px; background: radial-gradient(circle, #54381c, #96764e, transparent); top: 40%; left: 70%; }
        .login-card {
          background: #fffef9; border: 1px solid #e0d5c0; border-radius: 8px;
          padding: 52px 44px; max-width: 430px; width: 100%; text-align: center;
          position: relative; z-index: 1;
          box-shadow: 0 4px 32px rgba(80,40,20,0.08), 0 1px 6px rgba(0,0,0,0.04);
        }
        .brand-mark { font-size: 52px; margin-bottom: 8px; }
        .brand-mark span { color: #1a1a1a; }
        .login-title {
          font-size: 34px; font-weight: 700; margin-bottom: 6px;
          color: #1a1a1a;
          letter-spacing: -1px;
        }
        .login-subtitle { color: #8c7a60; font-size: 14px; margin-bottom: 28px; font-style: italic; }
        .login-form { display: flex; flex-direction: column; gap: 12px; }
        .input-label { text-align: left; font-size: 13px; font-weight: 500; color: #6b5c40; }
        .email-input {
          padding: 14px 16px; border: 2px solid #d8cfb8; border-radius: 6px;
          font-size: 15px; font-family: inherit; outline: none; background: #fefdf9;
          user-select: text; -webkit-user-select: text;
        }
        .email-input:focus { border-color: #8b4513; }
        .btn-send {
          margin-top: 8px; padding: 15px;
          background: #1a1a1a;
          color: #fff; border: none; border-radius: 6px;
          font-size: 16px; font-weight: 600; cursor: pointer;
          font-family: inherit; box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-send:hover { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,0.18); }
        .error-msg { color: #c0392b; font-size: 13px; text-align: left; }
        .login-sent { padding: 20px 0; }
        .sent-icon { font-size: 44px; margin-bottom: 14px; }
        .sent-hint { color: #a09080; font-size: 12px; margin-top: 12px; margin-bottom: 6px; }
        .magic-link {
          display: block; color: #2471a3; font-size: 12px; word-break: break-all;
          padding: 8px 12px; background: #eef6fb; border-radius: 8px; margin-top: 8px;
        }
        .brand-mark { color: #1a1a1a; }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#faf7f0"}}><div style={{width:32,height:32,border:"3px solid #ddd",borderTopColor:"#1a1a1a",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} /></div>}>
      <LoginContent />
    </Suspense>
  );
}
