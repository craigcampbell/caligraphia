"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface UserData {
  id: string;
  username: string;
  email: string;
  nomDePlume: string | null;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
  bannedByAdmin: { username: string } | null;
  stampBalance: number;
  totalStampsEarned: number;
  _count: { posts: number; warnings: number };
  posts: { id: string; postType: string; createdAt: string; deletedAt: string | null; isPrivate: boolean; recipientId: string | null }[];
  warnings: { id: string; reason: string; createdAt: string; admin: { username: string } | null }[];
  reportsAgainst: { id: string; reason: string; note: string | null; status: string; createdAt: string }[];
  stampPurchases: { id: string; packId: string; stamps: number; cents: number; status: string; createdAt: string }[];
  stampAdjustments: { id: string; amount: number; kind: string; reason: string | null; createdAt: string }[];
}

export default function UserDetail({ userId }: { userId: string }) {
  const [u, setU] = useState<UserData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [compAmount, setCompAmount] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<UserData>(`/admin/api/users/${userId}`);
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setU(r.data);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function doAction(path: string, body: object, okMsg: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = await adminFetch(path, { method: "POST", body: JSON.stringify(body) });
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setMsg(okMsg);
    setReason("");
    await load();
  }

  if (loading && !u) return <div className="adm-card adm-muted">Loading…</div>;
  if (err && !u) return <div className="adm-err">{err}</div>;
  if (!u) return null;

  return (
    <div>
      <p className="adm-sub" style={{ marginTop: 0 }}>
        <Link href="/admin/users">← Users</Link>
      </p>
      <div className="adm-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 className="adm-h" style={{ marginBottom: 4 }}>{u.username}</h2>
          <div className="adm-muted" style={{ fontSize: 13 }}>
            {u.nomDePlume ? `“${u.nomDePlume}” · ` : ""}
            {u.email}
          </div>
          <div className="adm-muted" style={{ fontSize: 12, marginTop: 4 }}>
            joined {formatDateTime(u.createdAt)} · {u._count.posts} letters · {u._count.warnings} warnings
          </div>
        </div>
        <div>
          {u.bannedAt ? <span className="adm-badge bad">banned</span> : <span className="adm-badge good">active</span>}
        </div>
      </div>

      {err && <div className="adm-err">{err}</div>}
      {msg && <div className="adm-ok">{msg}</div>}

      {u.bannedAt && (
        <div className="adm-card">
          <strong>Banned</strong> {formatDateTime(u.bannedAt)}
          {u.bannedByAdmin && <> by {u.bannedByAdmin.username}</>}
          {u.banReason && <div style={{ marginTop: 6 }}>Reason: {u.banReason}</div>}
        </div>
      )}

      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Stamps</h3>
        <p className="adm-sub" style={{ marginTop: 0 }}>
          Balance <strong>{u.stampBalance}</strong> · {u.totalStampsEarned} earned lifetime
        </p>
        <label className="adm-label">Comp / adjust (use a negative number to remove)</label>
        <div className="adm-row">
          <input
            className="adm-input"
            type="number"
            value={compAmount}
            onChange={(e) => setCompAmount(e.target.value)}
            placeholder="e.g. 50"
            style={{ maxWidth: 140 }}
          />
          <button
            className="adm-btn primary"
            disabled={busy || !compAmount || Number(compAmount) === 0}
            onClick={async () => {
              const amount = Math.trunc(Number(compAmount));
              if (!amount) return;
              await doAction(
                `/admin/api/users/${u.id}/comp-stamps`,
                { amount, reason: reason || undefined },
                `${amount > 0 ? "Gave" : "Removed"} ${Math.abs(amount)} stamps.`
              );
              setCompAmount("");
            }}
          >
            Apply
          </button>
        </div>
        {(u.stampPurchases.length > 0 || u.stampAdjustments.length > 0) && (
          <table className="adm-table" style={{ marginTop: 14 }}>
            <tbody>
              {u.stampPurchases.map((p) => (
                <tr key={p.id}>
                  <td>Bought {p.stamps} stamps (${(p.cents / 100).toFixed(2)})</td>
                  <td>
                    <span className={`adm-badge ${p.status === "refunded" ? "bad" : p.status === "completed" ? "good" : ""}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(p.createdAt)}</td>
                </tr>
              ))}
              {u.stampAdjustments.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.amount >= 0 ? "+" : ""}{a.amount} stamps · {a.kind}
                    {a.reason ? ` — ${a.reason}` : ""}
                  </td>
                  <td />
                  <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(a.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Moderation</h3>
        <label className="adm-label">Reason (recorded in the audit log)</label>
        <input
          className="adm-input"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. repeated harassment"
        />
        <div className="adm-row" style={{ marginTop: 12 }}>
          <button
            className="adm-btn"
            disabled={busy || !reason.trim()}
            onClick={() => doAction(`/admin/api/users/${u.id}/warn`, { reason }, "Warning issued.")}
          >
            Issue warning
          </button>
          {u.bannedAt ? (
            <button
              className="adm-btn primary"
              disabled={busy}
              onClick={() => doAction(`/admin/api/users/${u.id}/unban`, {}, "User unbanned.")}
            >
              Lift ban
            </button>
          ) : (
            <button
              className="adm-btn danger"
              disabled={busy}
              onClick={() => {
                if (confirm(`Ban ${u.username}? They'll be signed out immediately and blocked from logging in.`)) {
                  doAction(`/admin/api/users/${u.id}/ban`, { reason }, "User banned.");
                }
              }}
            >
              Ban user
            </button>
          )}
        </div>
      </div>

      {u.reportsAgainst.length > 0 && (
        <div className="adm-card">
          <h3 style={{ marginTop: 0 }}>Reports against this user</h3>
          <table className="adm-table">
            <tbody>
              {u.reportsAgainst.map((r) => (
                <tr key={r.id}>
                  <td><span className="adm-badge bad">{r.reason}</span></td>
                  <td>{r.note || <span className="adm-muted">—</span>}</td>
                  <td><span className="adm-badge">{r.status}</span></td>
                  <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {u.warnings.length > 0 && (
        <div className="adm-card">
          <h3 style={{ marginTop: 0 }}>Warnings</h3>
          <table className="adm-table">
            <tbody>
              {u.warnings.map((w) => (
                <tr key={w.id}>
                  <td>{w.reason}</td>
                  <td className="adm-muted" style={{ fontSize: 12 }}>
                    {w.admin?.username ?? "—"} · {formatDateTime(w.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="adm-card">
        <h3 style={{ marginTop: 0 }}>Recent letters</h3>
        {u.posts.length === 0 && <div className="adm-muted">No letters.</div>}
        {u.posts.length > 0 && (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Created</th>
                <th>Flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {u.posts.map((p) => (
                <tr key={p.id}>
                  <td>{p.postType}</td>
                  <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(p.createdAt)}</td>
                  <td>
                    {p.deletedAt && <span className="adm-badge bad">removed</span>}{" "}
                    {p.isPrivate && <span className="adm-badge">private</span>}
                  </td>
                  <td><Link href={`/admin/posts/${p.id}`}>review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
