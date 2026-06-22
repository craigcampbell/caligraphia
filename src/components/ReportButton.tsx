"use client";

import { useState } from "react";

// Lets a signed-in member flag a letter or a person. Posts to /api/reports,
// which binds the target server-side and dedupes open reports. The modal carries
// data-allow-text="true" so the note field escapes the app-wide keyboard block.

const REASONS: { value: string; label: string }[] = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hateful", label: "Hateful content" },
  { value: "spam", label: "Spam" },
  { value: "automated", label: "Bot / automated posting" },
  { value: "slop", label: "Low-effort / AI slop" },
  { value: "other", label: "Something else" },
];

export function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "post" | "user";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("harassment");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, note: note.trim() || undefined }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const j = await res.json().catch(() => null);
        setErr(j?.error || "Could not send the report. Please try again.");
      }
    } catch {
      setErr("Could not send the report. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          setDone(false);
          setErr(null);
        }}
        style={{
          background: "transparent",
          border: "1px solid rgba(90,70,50,0.35)",
          color: "#6b5640",
          borderRadius: 8,
          padding: "6px 12px",
          cursor: "pointer",
          font: "inherit",
          fontSize: 14,
        }}
      >
        {label}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(40,30,20,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            data-allow-text="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#faf7f0",
              border: "1px solid rgba(90,70,50,0.3)",
              borderRadius: 14,
              padding: "22px 24px",
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 18px 50px rgba(0,0,0,0.3)",
              color: "#3a2e22",
            }}
          >
            {done ? (
              <>
                <h3 style={{ margin: "0 0 8px" }}>Thank you</h3>
                <p style={{ margin: "0 0 18px", color: "#6b5640" }}>
                  A moderator will take a look. We appreciate you helping keep Caligraphia kind.
                </p>
                <div style={{ textAlign: "right" }}>
                  <button onClick={() => setOpen(false)} style={primaryBtn}>
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: "0 0 4px" }}>
                  Report this {targetType === "post" ? "letter" : "person"}
                </h3>
                <p style={{ margin: "0 0 16px", color: "#6b5640", fontSize: 14 }}>
                  This goes to the moderators privately.
                </p>
                {err && (
                  <p style={{ color: "#9c3b34", background: "#f6e3e1", padding: "8px 10px", borderRadius: 8, fontSize: 14 }}>
                    {err}
                  </p>
                )}
                <label style={labelStyle}>Reason</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} style={fieldStyle}>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <label style={labelStyle}>Anything to add? (optional)</label>
                <textarea
                  value={note}
                  maxLength={240}
                  rows={3}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Context for the moderators"
                  style={{ ...fieldStyle, resize: "vertical" }}
                />
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
                  <button onClick={() => setOpen(false)} disabled={busy} style={ghostBtn}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={busy} style={primaryBtn}>
                    {busy ? "Sending…" : "Send report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#6b5640",
  margin: "12px 0 5px",
};
const fieldStyle: React.CSSProperties = {
  width: "100%",
  font: "inherit",
  fontSize: 15,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid rgba(90,70,50,0.35)",
  background: "#fffdf8",
  color: "#3a2e22",
  boxSizing: "border-box",
};
const primaryBtn: React.CSSProperties = {
  background: "#6b5640",
  color: "#faf7f0",
  border: "none",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  font: "inherit",
  fontSize: 14,
};
const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: "#6b5640",
  border: "1px solid rgba(90,70,50,0.35)",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
  font: "inherit",
  fontSize: 14,
};
