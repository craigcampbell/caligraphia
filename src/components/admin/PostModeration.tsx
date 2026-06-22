"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface PostData {
  id: string;
  postType: string;
  format: string;
  paperType: string | null;
  inkStyle: string | null;
  pageCount: number;
  recipientId: string | null;
  isPrivate: boolean;
  isDeadLetter: boolean;
  needsReview: boolean | null;
  deliverAt: string | null;
  ocrText: string | null;
  createdAt: string;
  deletedAt: string | null;
  hasImage: boolean;
  user: { id: string; username: string; nomDePlume: string | null; bannedAt: string | null };
  _count: { reports: number };
}

export default function PostModeration({ postId }: { postId: string }) {
  const [p, setP] = useState<PostData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [imgVersion, setImgVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<PostData>(`/admin/api/posts/${postId}`);
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setP(r.data);
    setImgVersion((v) => v + 1);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function call(method: string, path: string, okMsg: string, body?: object) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await adminFetch(path, {
      method,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg(okMsg);
    setReason("");
    await load();
  }

  if (loading && !p) return <div className="adm-card adm-muted">Loading…</div>;
  if (err && !p) return <div className="adm-err">{err}</div>;
  if (!p) return null;

  return (
    <div>
      <p className="adm-sub" style={{ marginTop: 0 }}>
        <Link href="/admin/reports">← Reports</Link>
      </p>
      <h2 className="adm-h" style={{ marginBottom: 4 }}>Letter</h2>
      <div className="adm-muted" style={{ fontSize: 13, marginBottom: 16 }}>
        by <Link href={`/admin/users/${p.user.id}`}>{p.user.username}</Link>
        {p.user.bannedAt && <span className="adm-badge bad" style={{ marginLeft: 6 }}>banned</span>} ·{" "}
        {formatDateTime(p.createdAt)}
      </div>

      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}

      <div className="adm-row" style={{ alignItems: "flex-start", gap: 20 }}>
        <div className="adm-card" style={{ flex: "0 0 auto", maxWidth: 420 }}>
          {p.hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/admin/api/media/post/${p.id}?v=${imgVersion}`}
              alt="letter"
              style={{ maxWidth: 380, borderRadius: 6, border: "1px solid var(--border)", background: "#fff" }}
            />
          ) : (
            <div className="adm-muted">No image (purged or text-only).</div>
          )}
          {p.pageCount > 1 && (
            <p className="adm-sub" style={{ marginBottom: 0 }}>{p.pageCount} pages</p>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <div className="adm-card">
            <table className="adm-table">
              <tbody>
                <tr><th>Status</th><td>
                  {p.deletedAt ? <span className="adm-badge bad">removed</span> : <span className="adm-badge good">live</span>}
                  {p.isPrivate && <span className="adm-badge" style={{ marginLeft: 6 }}>private</span>}
                  {p.isDeadLetter && <span className="adm-badge" style={{ marginLeft: 6 }}>dead letter</span>}
                </td></tr>
                <tr><th>Type</th><td>{p.postType} · {p.format}</td></tr>
                <tr><th>Reports</th><td>{p._count.reports}</td></tr>
                {p.deliverAt && <tr><th>Delivers</th><td>{formatDateTime(p.deliverAt)}</td></tr>}
                {p.ocrText && <tr><th>OCR</th><td className="adm-muted" style={{ fontSize: 12 }}>{p.ocrText.slice(0, 300)}</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="adm-card">
            <h3 style={{ marginTop: 0 }}>Actions</h3>
            <label className="adm-label">Reason (audit log)</label>
            <input className="adm-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="optional" />
            <div className="adm-row" style={{ marginTop: 12 }}>
              {p.deletedAt ? (
                <button
                  className="adm-btn primary"
                  disabled={busy}
                  onClick={() => call("POST", `/admin/api/posts/${p.id}/restore`, "Letter restored.")}
                >
                  Restore
                </button>
              ) : (
                <button
                  className="adm-btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Remove this letter? It will be hidden everywhere (reversible).")) {
                      call("DELETE", `/admin/api/posts/${p.id}`, "Letter removed.", { reason });
                    }
                  }}
                >
                  Remove letter
                </button>
              )}
              <button
                className="adm-btn danger"
                disabled={busy || !p.hasImage}
                onClick={() => {
                  if (
                    confirm(
                      "Permanently purge this letter's images from storage? This is IRREVERSIBLE and also removes the letter."
                    )
                  ) {
                    call("DELETE", `/admin/api/posts/${p.id}/image`, "Images purged.", { reason });
                  }
                }}
              >
                Purge images (permanent)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
