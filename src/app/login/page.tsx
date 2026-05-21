"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, Suspense } from "react";

function LoginContent() {
  const { user, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [magicLink, setMagicLink] = useState("");

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

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

        if (!res.ok) {
          setError(data.error || "Invalid link");
          return;
        }

        if (data.needsSignup) {
          router.push(`/signup?signupToken=${encodeURIComponent(data.signupToken)}`);
        } else {
          router.push("/");
        }
      } catch {
        setError("Something went wrong");
      }
    })();
  }, [searchParams, router]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");

    const result = await login(email);
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
      if (result.magicLink) {
        setMagicLink(result.magicLink);
      }
    }
  };

  if (user) return null;

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Caligraphia</h1>
        <p className="login-subtitle">
          A place for handwriting. No typing, no pasting, no bots.
        </p>

        {sent ? (
          <div className="login-sent">
            <div className="sent-icon">&#9993;</div>
            <p>Magic link sent to <strong>{email}</strong></p>
            <p className="sent-hint">Check the link below (dev mode):</p>
            <a href={magicLink} className="magic-link">
              {magicLink}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSend} className="login-form">
            <label className="input-label" htmlFor="login-email">
              Email address
            </label>
            <input
              id="login-email"
              name="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="email-input"
              autoFocus
              data-allow-text="true"
            />
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="btn-send">
              Send Magic Link
            </button>
          </form>
        )}
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #fafafa;
          padding: 16px;
        }
        .login-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 16px;
          padding: 48px 40px;
          max-width: 420px;
          width: 100%;
          text-align: center;
        }
        .login-title {
          font-size: 32px;
          font-weight: 700;
          font-style: italic;
          letter-spacing: -1px;
          margin-bottom: 8px;
        }
        .login-subtitle {
          color: #888;
          font-size: 15px;
          margin-bottom: 32px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .input-label {
          text-align: left;
          font-size: 14px;
          font-weight: 500;
          color: #555;
        }
        .email-input {
          padding: 12px 16px;
          border: 2px solid #ddd;
          border-radius: 10px;
          font-size: 16px;
          font-family: inherit;
          outline: none;
          user-select: text;
          -webkit-user-select: text;
        }
        .email-input:focus {
          border-color: #111;
        }
        .btn-send {
          margin-top: 8px;
          padding: 14px;
          background: #111;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-send:hover {
          background: #333;
        }
        .error-msg {
          color: #e53e3e;
          font-size: 14px;
          text-align: left;
        }
        .login-sent {
          padding: 20px 0;
        }
        .sent-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .sent-hint {
          color: #888;
          font-size: 13px;
          margin-top: 12px;
          margin-bottom: 8px;
        }
        .magic-link {
          display: block;
          color: #3182ce;
          font-size: 13px;
          word-break: break-all;
          padding: 8px;
          background: #ebf8ff;
          border-radius: 6px;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="loading-screen"><div className="spinner" /><style>{`.loading-screen{display:flex;align-items:center;justify-content:center;min-height:100vh}.spinner{width:32px;height:32px;border:3px solid #e0e0e0;border-top-color:#333;border-radius:50%;animation:spin 0.8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>}>
      <LoginContent />
    </Suspense>
  );
}
