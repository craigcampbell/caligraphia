"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin/adminFetch";

type Stage = "credentials" | "totp" | "enroll" | "change_password" | "recovery";

const noRedirect = { redirectOn401: false };

export default function LoginFlow() {
  const [stage, setStage] = useState<Stage>("credentials");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // credentials
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showEnrollField, setShowEnrollField] = useState(false);
  const [enrollToken, setEnrollToken] = useState("");

  // totp
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  // enroll
  const [qr, setQr] = useState<string | null>(null);
  const [otpUri, setOtpUri] = useState<string | null>(null);

  // change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // recovery codes (shown once)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [nextAfterRecovery, setNextAfterRecovery] = useState("/admin");

  function go(next: string) {
    window.location.href = next;
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await adminFetch<{ next?: string }>(
      "/admin/api/login",
      { method: "POST", body: JSON.stringify({ username, password, enrollToken }) },
      noRedirect
    );
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      // 403 from a missing/invalid enroll token: reveal the field to retry.
      if (r.status === 403) setShowEnrollField(true);
      return;
    }
    setPassword("");
    if (r.data?.next === "enroll") {
      await startEnroll();
    } else if (r.data?.next === "totp") {
      setStage("totp");
    }
  }

  async function startEnroll() {
    setErr(null);
    setBusy(true);
    const r = await adminFetch<{ qrDataUrl: string; uri: string }>(
      "/admin/api/2fa/enroll/start",
      { method: "POST" },
      noRedirect
    );
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setQr(r.data?.qrDataUrl ?? null);
    setOtpUri(r.data?.uri ?? null);
    setStage("enroll");
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await adminFetch<{ recoveryCodes: string[]; next: string }>(
      "/admin/api/2fa/enroll/confirm",
      { method: "POST", body: JSON.stringify({ code }) },
      noRedirect
    );
    setBusy(false);
    setCode("");
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setRecoveryCodes(r.data?.recoveryCodes ?? []);
    setNextAfterRecovery(r.data?.next ?? "/admin");
    setStage("recovery");
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await adminFetch<{ ok?: boolean; next?: string }>(
      "/admin/api/login/totp",
      { method: "POST", body: JSON.stringify({ code, recovery: useRecovery }) },
      noRedirect
    );
    setBusy(false);
    setCode("");
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    if (r.data?.next === "change_password") {
      setStage("change_password");
    } else if (r.data?.next) {
      go(r.data.next);
    }
  }

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newPassword.length < 16) {
      setErr("Password must be at least 16 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErr("Passwords don't match.");
      return;
    }
    setBusy(true);
    const r = await adminFetch<{ next?: string }>(
      "/admin/api/change-password",
      { method: "POST", body: JSON.stringify({ newPassword }) },
      noRedirect
    );
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    go(r.data?.next ?? "/admin");
  }

  return (
    <div className="adm-card">
      {err && <div className="adm-err">{err}</div>}

      {stage === "credentials" && (
        <form onSubmit={submitCredentials}>
          <label className="adm-label">Username</label>
          <input
            className="adm-input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <label className="adm-label">Password</label>
          <input
            className="adm-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {showEnrollField && (
            <>
              <label className="adm-label">Enrollment token (one-time)</label>
              <input
                className="adm-input"
                value={enrollToken}
                onChange={(e) => setEnrollToken(e.target.value)}
                placeholder="from npm run admin:create / reset-2fa"
              />
            </>
          )}
          <div style={{ marginTop: 16 }}>
            <button className="adm-btn primary" disabled={busy} type="submit" style={{ width: "100%" }}>
              {busy ? "…" : "Continue"}
            </button>
          </div>
          {!showEnrollField && (
            <p className="adm-sub" style={{ marginTop: 14, marginBottom: 0 }}>
              First time?{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setShowEnrollField(true); }}>
                I have an enrollment token
              </a>
            </p>
          )}
        </form>
      )}

      {stage === "totp" && (
        <form onSubmit={submitTotp}>
          <p className="adm-sub">
            {useRecovery ? "Enter one of your recovery codes." : "Enter the 6-digit code from your authenticator."}
          </p>
          <input
            className="adm-input"
            inputMode={useRecovery ? "text" : "numeric"}
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            placeholder={useRecovery ? "recovery code" : "123456"}
          />
          <div style={{ marginTop: 16 }}>
            <button className="adm-btn primary" disabled={busy} type="submit" style={{ width: "100%" }}>
              {busy ? "…" : "Verify"}
            </button>
          </div>
          <p className="adm-sub" style={{ marginTop: 14, marginBottom: 0 }}>
            <a href="#" onClick={(e) => { e.preventDefault(); setUseRecovery((v) => !v); setCode(""); setErr(null); }}>
              {useRecovery ? "Use authenticator code instead" : "Lost your authenticator? Use a recovery code"}
            </a>
          </p>
        </form>
      )}

      {stage === "enroll" && (
        <form onSubmit={confirmEnroll}>
          <p className="adm-sub">
            Scan this with your authenticator app, then enter the 6-digit code to finish enrollment.
          </p>
          {qr && <img className="adm-qr" src={qr} alt="TOTP QR code" />}
          {otpUri && (
            <details>
              <summary className="adm-muted" style={{ cursor: "pointer", fontSize: 12 }}>
                Can&apos;t scan? Show setup key
              </summary>
              <p className="mono-sm">{otpUri}</p>
            </details>
          )}
          <label className="adm-label">6-digit code</label>
          <input
            className="adm-input"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            placeholder="123456"
          />
          <div style={{ marginTop: 16 }}>
            <button className="adm-btn primary" disabled={busy} type="submit" style={{ width: "100%" }}>
              {busy ? "…" : "Activate 2FA"}
            </button>
          </div>
        </form>
      )}

      {stage === "change_password" && (
        <form onSubmit={submitNewPassword}>
          <p className="adm-sub">Choose a new password (at least 16 characters).</p>
          <label className="adm-label">New password</label>
          <input
            className="adm-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
          <label className="adm-label">Confirm</label>
          <input
            className="adm-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <div style={{ marginTop: 16 }}>
            <button className="adm-btn primary" disabled={busy} type="submit" style={{ width: "100%" }}>
              {busy ? "…" : "Set password & sign in"}
            </button>
          </div>
        </form>
      )}

      {stage === "recovery" && (
        <div>
          <p className="adm-ok">2FA is active. Save these recovery codes now — they won&apos;t be shown again.</p>
          <div className="adm-codes">
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <p className="adm-sub" style={{ marginTop: 12 }}>
            Each code works once, as a stand-in for your authenticator.
          </p>
          <button className="adm-btn primary" style={{ width: "100%" }} onClick={() => go(nextAfterRecovery)}>
            I&apos;ve saved them — continue
          </button>
        </div>
      )}
    </div>
  );
}
