"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface Entry {
  id: string;
  email: string;
  note: string | null;
  source: string | null;
  createdAt: string;
  invitedAt: string | null;
}

export default function WaitlistView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<{ entries: Entry[]; pending: number }>("/admin/api/waitlist");
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setEntries(r.data?.entries ?? []);
    setPending(r.data?.pending ?? 0);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleInvited(e: Entry) {
    setBusyId(e.id);
    const r = await adminFetch(`/admin/api/waitlist/${e.id}`, {
      method: "PATCH",
      body: JSON.stringify({ invited: !e.invitedAt }),
    });
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    load();
  }

  async function remove(e: Entry) {
    if (!confirm(`Remove ${e.email} from the waitlist?`)) return;
    setBusyId(e.id);
    const r = await adminFetch(`/admin/api/waitlist/${e.id}`, { method: "DELETE" });
    setBusyId(null);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    load();
  }

  return (
    <div>
      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <h2 className="adm-h">Waitlist {pending > 0 && <span className="adm-badge">{pending} waiting</span>}</h2>
        <button className="adm-btn sm" onClick={load} disabled={loading}>{loading ? "…" : "Refresh"}</button>
      </div>
      <div className="adm-card adm-muted" style={{ fontSize: 13 }}>
        People who asked to be let in from the landing page. Bring them in with a handwritten invite,
        then mark them invited so you don&apos;t double up.
      </div>
      {err && <div className="adm-err">{err}</div>}

      <div className="adm-card" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Note</th>
              <th>When</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td><a href={`mailto:${e.email}`}>{e.email}</a></td>
                <td className="adm-muted" style={{ maxWidth: 280, fontSize: 13 }}>{e.note || "—"}</td>
                <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(e.createdAt)}</td>
                <td>
                  {e.invitedAt ? (
                    <span className="adm-badge good">invited</span>
                  ) : (
                    <span className="adm-badge">waiting</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="adm-btn sm" disabled={busyId === e.id} onClick={() => toggleInvited(e)}>
                    {busyId === e.id ? "…" : e.invitedAt ? "Un-mark" : "Mark invited"}
                  </button>{" "}
                  <button className="adm-btn danger sm" disabled={busyId === e.id} onClick={() => remove(e)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr><td colSpan={5} className="adm-muted" style={{ padding: 18 }}>No one waiting yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
