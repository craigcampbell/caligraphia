"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface UserRow {
  id: string;
  username: string;
  email: string;
  nomDePlume: string | null;
  createdAt: string;
  bannedAt: string | null;
  banReason: string | null;
  _count: { posts: number; warnings: number };
}

export default function UsersList() {
  const [q, setQ] = useState("");
  const [bannedOnly, setBannedOnly] = useState(false);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (bannedOnly) params.set("filter", "banned");
    const r = await adminFetch<{ users: UserRow[]; total: number }>(
      `/admin/api/users?${params.toString()}`
    );
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setRows(r.data?.users ?? []);
    setTotal(r.data?.total ?? 0);
  }, [q, bannedOnly]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bannedOnly]);

  return (
    <div>
      <h2 className="adm-h">Users</h2>
      <form
        className="adm-row"
        style={{ marginBottom: 16 }}
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <input
          className="adm-input"
          style={{ maxWidth: 320 }}
          placeholder="search username or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="adm-btn" type="submit" disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
        <label className="adm-row" style={{ gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={bannedOnly} onChange={(e) => setBannedOnly(e.target.checked)} />
          <span className="adm-muted" style={{ fontSize: 13 }}>banned only</span>
        </label>
      </form>

      {err && <div className="adm-err">{err}</div>}

      <div className="adm-card" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Joined</th>
              <th>Letters</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`}>{u.username}</Link>
                  {u.nomDePlume && <div className="adm-muted" style={{ fontSize: 11 }}>{u.nomDePlume}</div>}
                </td>
                <td className="mono-sm">{u.email}</td>
                <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(u.createdAt)}</td>
                <td>
                  {u._count.posts}
                  {u._count.warnings > 0 && (
                    <span className="adm-badge warn" style={{ marginLeft: 6 }}>{u._count.warnings} warn</span>
                  )}
                </td>
                <td>
                  {u.bannedAt ? (
                    <span className="adm-badge bad">banned</span>
                  ) : (
                    <span className="adm-badge good">active</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="adm-muted" style={{ padding: 18 }}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="adm-sub">{total} total</p>
    </div>
  );
}
