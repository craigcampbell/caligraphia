"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatDateTime } from "./format";

interface Purchase {
  id: string;
  packId: string;
  stamps: number;
  cents: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  refundedAt: string | null;
  user: { id: string; username: string } | null;
}

export default function PurchasesView() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [stripeEnabled, setStripeEnabled] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<{ purchases: Purchase[]; stripeEnabled: boolean }>("/admin/api/purchases");
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setPurchases(r.data?.purchases ?? []);
    setStripeEnabled(r.data?.stripeEnabled ?? false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refund(p: Purchase) {
    if (!confirm(`Refund ${p.user?.username ?? "this user"}'s ${p.stamps}-stamp purchase ($${(p.cents / 100).toFixed(2)})? This refunds the card and claws back the stamps they still hold.`)) {
      return;
    }
    setBusyId(p.id);
    const r = await adminFetch<{ clawedBack: number }>(`/admin/api/purchases/${p.id}/refund`, { method: "POST" });
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
        <h2 className="adm-h">Purchases</h2>
        <button className="adm-btn sm" onClick={load} disabled={loading}>{loading ? "…" : "Refresh"}</button>
      </div>
      {!stripeEnabled && (
        <div className="adm-card adm-muted" style={{ fontSize: 13 }}>
          Stripe isn&apos;t configured, so no purchases can be made or refunded yet.
        </div>
      )}
      {err && <div className="adm-err">{err}</div>}

      <div className="adm-card" style={{ padding: 0 }}>
        <table className="adm-table">
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Pack</th>
              <th>Amount</th>
              <th>Status</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.user ? <Link href={`/admin/users/${p.user.id}`}>{p.user.username}</Link> : "—"}
                </td>
                <td>{p.stamps} stamps</td>
                <td>${(p.cents / 100).toFixed(2)}</td>
                <td>
                  <span className={`adm-badge ${p.status === "refunded" ? "bad" : p.status === "completed" ? "good" : ""}`}>
                    {p.status}
                  </span>
                </td>
                <td className="adm-muted" style={{ fontSize: 12 }}>{formatDateTime(p.createdAt)}</td>
                <td>
                  {p.status === "completed" && (
                    <button className="adm-btn danger sm" disabled={busyId === p.id} onClick={() => refund(p)}>
                      {busyId === p.id ? "…" : "Refund"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {purchases.length === 0 && !loading && (
              <tr><td colSpan={6} className="adm-muted" style={{ padding: 18 }}>No purchases yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
