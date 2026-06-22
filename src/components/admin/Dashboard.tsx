"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminFetch } from "@/lib/admin/adminFetch";
import { formatBytes, formatDuration } from "./format";

interface Stats {
  server: {
    memory: { usedBytes: number; limitBytes: number | null; totalBytes: number; source: string };
    disk: { path: string; totalBytes: number; freeBytes: number; usedBytes: number } | null;
    cpu: { cores: number; loadavg: number[] };
    uptime: { processSeconds: number; osSeconds: number };
    node: string;
    platform: string;
  };
  db: { databaseSizeBytes: number; connections: number; tables: { name: string; rows: number; totalBytes: number }[] } | null;
  counts: {
    users: number;
    bannedUsers: number;
    letters: number;
    deletedLetters: number;
    openReports: number;
    invites: number;
    warnings: number;
  };
}

function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const color = pct > 90 ? "var(--bad)" : pct > 75 ? "var(--warn)" : "var(--accent)";
  return (
    <div>
      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <span className="adm-muted" style={{ fontSize: 12 }}>{label}</span>
        <span style={{ fontSize: 12 }}>
          {formatBytes(used)} / {formatBytes(total)} ({pct}%)
        </span>
      </div>
      <div className="adm-bar">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminFetch<Stats>("/admin/api/stats");
    setLoading(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setErr(null);
    setStats(r.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = stats?.counts;
  const mem = stats?.server.memory;
  const disk = stats?.server.disk;

  return (
    <div>
      <div className="adm-row" style={{ justifyContent: "space-between" }}>
        <h2 className="adm-h">Dashboard</h2>
        <button className="adm-btn sm" onClick={load} disabled={loading}>
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {err && <div className="adm-err">{err}</div>}

      {c && (
        <div className="adm-grid">
          <Link href="/admin/users" className="adm-stat">
            <div className="n">{c.users}</div>
            <div className="l">Users{c.bannedUsers ? ` · ${c.bannedUsers} banned` : ""}</div>
          </Link>
          <div className="adm-stat">
            <div className="n">{c.letters}</div>
            <div className="l">Letters{c.deletedLetters ? ` · ${c.deletedLetters} removed` : ""}</div>
          </div>
          <Link href="/admin/reports" className="adm-stat">
            <div className="n" style={{ color: c.openReports ? "var(--bad)" : undefined }}>
              {c.openReports}
            </div>
            <div className="l">Open reports</div>
          </Link>
          <div className="adm-stat">
            <div className="n">{c.invites}</div>
            <div className="l">Invites sent</div>
          </div>
          <div className="adm-stat">
            <div className="n">{c.warnings}</div>
            <div className="l">Warnings issued</div>
          </div>
        </div>
      )}

      {stats && (
        <div className="adm-card">
          <h3 style={{ marginTop: 0 }}>Server</h3>
          <div style={{ display: "grid", gap: 14 }}>
            {mem && (
              <Meter
                used={mem.usedBytes}
                total={mem.limitBytes ?? mem.totalBytes}
                label={`Memory (${mem.source}${mem.limitBytes ? ", container limit" : ", host"})`}
              />
            )}
            {disk && <Meter used={disk.usedBytes} total={disk.totalBytes} label={`Disk (${disk.path})`} />}
          </div>
          <table className="adm-table" style={{ marginTop: 16 }}>
            <tbody>
              <tr>
                <th>CPU</th>
                <td>
                  {stats.server.cpu.cores} cores · load{" "}
                  {stats.server.cpu.loadavg.map((n) => n.toFixed(2)).join(" / ")}
                </td>
              </tr>
              <tr>
                <th>Uptime</th>
                <td>
                  process {formatDuration(stats.server.uptime.processSeconds)} · host{" "}
                  {formatDuration(stats.server.uptime.osSeconds)}
                </td>
              </tr>
              <tr>
                <th>Runtime</th>
                <td>
                  Node {stats.server.node} · {stats.server.platform}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {stats?.db && (
        <div className="adm-card">
          <h3 style={{ marginTop: 0 }}>Database</h3>
          <p className="adm-sub" style={{ marginTop: 0 }}>
            {formatBytes(stats.db.databaseSizeBytes)} total · {stats.db.connections} active connection
            {stats.db.connections === 1 ? "" : "s"}
          </p>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Rows</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {stats.db.tables.slice(0, 12).map((t) => (
                <tr key={t.name}>
                  <td>{t.name}</td>
                  <td>{t.rows.toLocaleString()}</td>
                  <td>{formatBytes(t.totalBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {stats && !stats.db && (
        <div className="adm-card adm-muted">Database statistics are unavailable right now.</div>
      )}
    </div>
  );
}
