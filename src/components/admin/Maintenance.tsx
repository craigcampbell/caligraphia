"use client";

import { useState } from "react";
import { adminFetch } from "@/lib/admin/adminFetch";

// Mirror of the server allowlist (src/app/admin/api/maintenance/route.ts). The
// server re-validates, so this is only for the picker.
const TABLES = [
  "posts",
  "post_pages",
  "post_interactions",
  "users",
  "user_follows",
  "scratches",
  "replies",
  "comments",
  "marginalia",
  "flags",
  "stamps",
  "guestbook_entries",
  "letter_requests",
  "invites",
  "reports",
  "warnings",
  "admin_audit",
  "admin_sessions",
];

const OPS = [
  { op: "vacuum", label: "VACUUM (ANALYZE)", hint: "reclaim dead rows + refresh stats" },
  { op: "analyze", label: "ANALYZE", hint: "refresh planner statistics" },
  { op: "reindex", label: "REINDEX", hint: "rebuild this table's indexes" },
];

export default function Maintenance() {
  const [table, setTable] = useState(TABLES[0]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  async function runOp(op: string) {
    setBusy(op);
    setErr(null);
    setMsg(null);
    const r = await adminFetch<{ ms: number }>("/admin/api/maintenance", {
      method: "POST",
      body: JSON.stringify({ op, table }),
    });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg(`${op.toUpperCase()} on ${table} completed in ${r.data?.ms ?? "?"}ms.`);
  }

  async function downloadBackup() {
    setDownloading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/admin/api/backup", { credentials: "same-origin" });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = "/admin/login";
          return;
        }
        const j = await res.json().catch(() => null);
        setErr(j?.error ?? `Backup failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m ? m[1] : "caligraphia-backup.sql";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Downloaded ${filename} (${(blob.size / 1024 / 1024).toFixed(2)} MB).`);
    } catch {
      setErr("Backup failed.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <h2 className="adm-h">Maintenance</h2>

      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}

      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Backup</h3>
        <p className="adm-sub" style={{ marginTop: 0 }}>
          Download a full plain-SQL dump of the database (schema + data). Restore with{" "}
          <code className="mono-sm">psql &lt; file.sql</code>.
        </p>
        <button className="adm-btn primary" onClick={downloadBackup} disabled={downloading}>
          {downloading ? "Dumping…" : "Download backup (.sql)"}
        </button>
      </div>

      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Table maintenance</h3>
        <p className="adm-sub" style={{ marginTop: 0 }}>
          Run a maintenance command against a single table. Safe to run anytime; large
          tables may take a moment.
        </p>
        <label className="adm-label">Table</label>
        <select className="adm-select" style={{ maxWidth: 320 }} value={table} onChange={(e) => setTable(e.target.value)}>
          {TABLES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="adm-row" style={{ marginTop: 14 }}>
          {OPS.map((o) => (
            <button
              key={o.op}
              className="adm-btn"
              title={o.hint}
              disabled={busy !== null}
              onClick={() => runOp(o.op)}
            >
              {busy === o.op ? "…" : o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
