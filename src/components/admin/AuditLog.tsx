"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface AuditEntry {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  admin: { username: string } | null;
}

const DANGER = new Set(["user_ban", "image_delete", "login_failure"]);

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<{ entries: AuditEntry[]; total: number }>("/admin/api/audit");
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setEntries(r.data?.entries ?? []);
    setTotal(r.data?.total ?? 0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <h2 className="adm-h">Audit log</h2>
        <button className="adm-btn sm" onClick={load} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>
      <p className="adm-sub">{total} recorded actions · most recent first</p>

      {err && <div className="adm-err">{err}</div>}

      <div className="adm-card" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Admin</th>
              <th>Action</th>
              <th>Target</th>
              <th>Detail</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="adm-muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                  {formatDateTime(e.createdAt)}
                </td>
                <td>{e.admin?.username ?? <span className="adm-muted">system</span>}</td>
                <td>
                  <span className={`adm-badge ${DANGER.has(e.action) ? "bad" : ""}`}>{e.action}</span>
                </td>
                <td className="mono-sm">
                  {e.targetType ? `${e.targetType}:${(e.targetId ?? "").slice(0, 8)}` : "—"}
                </td>
                <td className="mono-sm">
                  {e.detail ? JSON.stringify(e.detail) : "—"}
                </td>
                <td className="mono-sm">{e.ip ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="adm-muted" style={{ padding: 18 }}>
                  No audit entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
