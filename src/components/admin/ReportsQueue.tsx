"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface ReportRow {
  id: string;
  targetType: "post" | "user";
  targetId: string;
  postId: string | null;
  reason: string;
  note: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; username: string } | null;
  post: { id: string; userId: string; postType: string; deletedAt: string | null; user: { id: string; username: string; bannedAt: string | null } } | null;
  targetUser: { id: string; username: string; bannedAt: string | null } | null;
}

const TABS = ["open", "resolved", "dismissed"] as const;

export default function ReportsQueue() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("open");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    const r = await adminFetch<{ reports: ReportRow[]; total: number }>(
      `/admin/api/reports?status=${status}`
    );
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setRows(r.data?.reports ?? []);
    setTotal(r.data?.total ?? 0);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function act(id: string, action: "resolve" | "dismiss") {
    setBusyId(id);
    const r = await adminFetch(`/admin/api/reports/${id}/${action}`, { method: "POST", body: "{}" });
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setRows((rs) => rs.filter((x) => x.id !== id));
  }

  return (
    <div>
      <h2 className="adm-h">Reports</h2>
      <div className="adm-row" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t}
            className={`adm-btn sm ${t === tab ? "primary" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
            {t === tab ? ` · ${total}` : ""}
          </button>
        ))}
        <button className="adm-btn sm" onClick={() => load(tab)} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {err && <div className="adm-err">{err}</div>}

      {!loading && rows.length === 0 && (
        <div className="adm-card adm-muted">Nothing in the {tab} queue.</div>
      )}

      {rows.map((r) => (
        <div className="adm-card" key={r.id}>
          <div className="adm-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div className="adm-row" style={{ gap: 8 }}>
                <span className="adm-badge bad">{r.reason}</span>
                <span className="adm-badge">{r.targetType}</span>
                <span className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(r.createdAt)}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                reported by{" "}
                {r.reporter ? (
                  <Link href={`/admin/users/${r.reporter.id}`}>{r.reporter.username}</Link>
                ) : (
                  "(deleted user)"
                )}
              </div>
              {r.note && (
                <div style={{ marginTop: 6, color: "var(--text)", fontSize: 13 }}>
                  “{r.note}”
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 13 }}>
                {r.targetType === "post" && r.post && (
                  <span>
                    letter by{" "}
                    <Link href={`/admin/users/${r.post.user.id}`}>{r.post.user.username}</Link>
                    {r.post.deletedAt && <span className="adm-badge bad" style={{ marginLeft: 6 }}>removed</span>}
                    {" — "}
                    <Link href={`/admin/posts/${r.post.id}`}>review letter →</Link>
                  </span>
                )}
                {r.targetType === "post" && !r.post && <span className="adm-muted">letter no longer exists</span>}
                {r.targetType === "user" && r.targetUser && (
                  <span>
                    account{" "}
                    <Link href={`/admin/users/${r.targetUser.id}`}>{r.targetUser.username}</Link>
                    {r.targetUser.bannedAt && <span className="adm-badge bad" style={{ marginLeft: 6 }}>banned</span>}
                  </span>
                )}
                {r.targetType === "user" && !r.targetUser && <span className="adm-muted">account no longer exists</span>}
              </div>
            </div>
            {r.targetType === "post" && r.post && (
              <Link href={`/admin/posts/${r.post.id}`} style={{ flex: "0 0 auto" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/admin/api/media/post/${r.post.id}`}
                  alt="letter"
                  style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", background: "#0b0e13" }}
                />
              </Link>
            )}
          </div>
          {r.status === "open" && (
            <div className="adm-row" style={{ marginTop: 12 }}>
              <button className="adm-btn primary sm" disabled={busyId === r.id} onClick={() => act(r.id, "resolve")}>
                Resolve
              </button>
              <button className="adm-btn sm" disabled={busyId === r.id} onClick={() => act(r.id, "dismiss")}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
