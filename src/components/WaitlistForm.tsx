"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A quiet "leave your address" form for the invite-only landing. Typing an email
// is allowed here (same as login) — the no-keyboards ethos is about the letters,
// not the front door.
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!EMAIL_RE.test(email.trim())) {
      setErr("Please enter a valid email address.");
      return;
    }
    setState("busy");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), note: note.trim() || undefined, source: "landing" }),
      });
      if (res.ok) {
        setState("done");
      } else {
        const d = await res.json().catch(() => null);
        setErr(d?.error || "Something went wrong. Try again later.");
        setState("idle");
      }
    } catch {
      setErr("Something went wrong. Try again later.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <div className="wl-done">
        <span className="wl-seal">&#9993;</span>
        <p>You&apos;re on the list. We&apos;ll send word when there&apos;s room.</p>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <form className="wl" onSubmit={submit}>
      <p className="wl-lead">Not invited yet? Leave your address and we&apos;ll write when a spot opens.</p>
      <div className="wl-row">
        <input
          className="wl-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={state === "busy"}
          aria-label="Email address"
        />
        <button className="wl-btn" type="submit" disabled={state === "busy"}>
          {state === "busy" ? "…" : "Join the waitlist"}
        </button>
      </div>
      <input
        className="wl-note"
        type="text"
        placeholder="A word about why you'd like in (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={280}
        disabled={state === "busy"}
        aria-label="Optional note"
      />
      {err && <div className="wl-err">{err}</div>}
      <style>{styles}</style>
    </form>
  );
}

const styles = `
  .wl { max-width: 440px; margin: 18px auto 0; position: relative; z-index: 1; text-align: center; }
  .wl-lead { font-size: 13px; color: #8c7a60; margin: 0 0 10px; }
  .wl-row { display: flex; gap: 8px; }
  .wl-input { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #d8cfb8; border-radius: 8px;
    background: #fffef9; color: #2c2416; font-size: 14px; }
  .wl-input:focus, .wl-note:focus { outline: none; border-color: #b98a5e; }
  .wl-note { width: 100%; margin-top: 8px; padding: 9px 12px; border: 1px solid #e2d8c2; border-radius: 8px;
    background: #fffef9; color: #2c2416; font-size: 13px; box-sizing: border-box; }
  .wl-btn { white-space: nowrap; padding: 10px 18px; background: #1a1a1a; color: #fff; border: none;
    border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; }
  .wl-btn:disabled { opacity: 0.6; cursor: default; }
  .wl-err { color: #9c3b34; font-size: 12.5px; margin-top: 8px; }
  .wl-done { max-width: 440px; margin: 18px auto 0; text-align: center; position: relative; z-index: 1; color: #6b5640; }
  .wl-done .wl-seal { display: block; font-size: 30px; color: #8b4513; margin-bottom: 4px; }
  .wl-done p { margin: 0; font-size: 14px; }
`;
