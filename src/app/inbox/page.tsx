"use client";

import { useState, useEffect, useMemo } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import Link from "next/link";

type Letter = {
  id: string;
  createdAt: string;
  readAt: string | null;
  ocrText?: string | null;
  stampCount?: number;
  imageUrl?: string | null;
  user: { id: string; username: string; nomDePlume: string | null };
};

type StatusFilter = "all" | "unopened" | "read";
type SortOrder = "newest" | "oldest" | "sender";

export default function InboxPage() {
  const [letters, setLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOrder>("newest");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/posts/inbox");
        if (res.ok) {
          const data = await res.json();
          setLetters(data.posts || []);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = letters.filter((l) => {
      if (q && !l.user.username.toLowerCase().includes(q)) return false;
      if (status === "unopened" && l.readAt) return false;
      if (status === "read" && !l.readAt) return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "sender") return a.user.username.localeCompare(b.user.username);
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [letters, query, status, sort]);

  const unopened = filtered.filter((l) => !l.readAt);
  const read = filtered.filter((l) => l.readAt);
  const unreadTotal = letters.filter((l) => !l.readAt).length;

  return (
    <AuthGuard>
      <NavBar />
      <main className="inbox-main">
        <div className="inbox-header">
          <h1 className="inbox-title">
            <span className="inbox-icon">&#9993;</span> Your Postbox
            {unreadTotal > 0 && <span className="inbox-badge">{unreadTotal} unopened</span>}
          </h1>
          <p className="inbox-sub">Letters sent just to you — unopened ones wait sealed until you read them.</p>
        </div>

        {!loading && letters.length > 0 && (
          <div className="inbox-controls" data-allow-text="true">
            <input
              className="inbox-search"
              type="text"
              placeholder="Search by sender…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="inbox-filters">
              {(["all", "unopened", "read"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  className={`pill ${status === s ? "active" : ""}`}
                  onClick={() => setStatus(s)}
                >
                  {s === "all" ? "All" : s === "unopened" ? "Unopened" : "Read"}
                </button>
              ))}
            </div>
            <select className="inbox-sort" value={sort} onChange={(e) => setSort(e.target.value as SortOrder)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="sender">By sender</option>
            </select>
          </div>
        )}

        {loading && (
          <div className="inbox-loading">
            <div className="spinner" />
          </div>
        )}

        {!loading && letters.length === 0 && (
          <div className="inbox-empty">
            <div className="inbox-empty-icon">&#128232;</div>
            <p>Your postbox is empty.</p>
            <p className="inbox-empty-hint">Share your profile link so friends can send you letters.</p>
          </div>
        )}

        {!loading && letters.length > 0 && filtered.length === 0 && (
          <div className="inbox-empty"><p>No letters match your search.</p></div>
        )}

        {status !== "read" && unopened.length > 0 && (
          <section className="pile">
            <h2 className="pile-title">Unopened <span className="pile-count">{unopened.length}</span></h2>
            <div className="sealed-grid">
              {unopened.map((l) => (
                <Link key={l.id} href={`/post/${l.id}`} className="seal-card">
                  <span className="seal-new">NEW</span>
                  <div className="seal-wax">&#10047;</div>
                  <div className="seal-from">{l.user.username}</div>
                  <div className="seal-when">{timeAgo(l.createdAt)}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {status !== "unopened" && read.length > 0 && (
          <section className="pile">
            <h2 className="pile-title">Read <span className="pile-count">{read.length}</span></h2>
            <div className="read-list">
              {read.map((l) => (
                <Link key={l.id} href={`/post/${l.id}`} className="read-row">
                  {l.imageUrl ? (
                    <img src={l.imageUrl} alt="" className="read-thumb" loading="lazy" />
                  ) : (
                    <div className="read-thumb read-thumb-ph">&#9993;</div>
                  )}
                  <div className="read-body">
                    <div className="read-from">
                      {l.user.nomDePlume ? (
                        <img src={l.user.nomDePlume} alt="" className="read-av" width={18} height={18} />
                      ) : (
                        <span className="read-av-ph">{l.user.username[0].toUpperCase()}</span>
                      )}
                      <span>{l.user.username}</span>
                    </div>
                    {l.ocrText && <div className="read-preview">{l.ocrText.slice(0, 70)}</div>}
                    <div className="read-when">Opened · {timeAgo(l.createdAt)}</div>
                  </div>
                  <span className="read-arrow">&#8594;</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <style>{`
        .inbox-main { max-width: 760px; margin: 0 auto; padding: 24px 16px 60px; }
        .inbox-header { text-align: center; padding-bottom: 18px; border-bottom: 1px solid #e0d5c0; margin-bottom: 18px; }
        .inbox-title {
          font-size: 27px; font-weight: 700; color: #2c2416;
          display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
        }
        .inbox-icon { color: #8b4513; }
        .inbox-badge {
          font-size: 12px; font-weight: 600; color: #fff; background: #b8513f;
          border-radius: 999px; padding: 3px 10px; letter-spacing: 0.3px;
        }
        .inbox-sub { color: #7a6a52; font-size: 14px; margin-top: 6px; }

        .inbox-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 22px; }
        .inbox-search {
          flex: 1 1 200px; min-width: 160px; font: inherit; font-size: 15px;
          padding: 9px 13px; border: 1px solid #d8c7ab; border-radius: 9px;
          background: #fffdf8; color: #3a2e22;
        }
        .inbox-search:focus { outline: none; border-color: #b98a5e; }
        .inbox-filters { display: flex; gap: 6px; }
        .pill {
          font: inherit; font-size: 13px; padding: 7px 13px; border-radius: 999px;
          border: 1px solid #d8c7ab; background: #fffdf8; color: #6b5640; cursor: pointer;
        }
        .pill.active { background: #6b5640; border-color: #6b5640; color: #faf7f0; font-weight: 600; }
        .inbox-sort {
          font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 9px;
          border: 1px solid #d8c7ab; background: #fffdf8; color: #3a2e22; cursor: pointer;
        }

        .pile { margin-bottom: 30px; }
        .pile-title {
          font-size: 15px; text-transform: uppercase; letter-spacing: 1px;
          color: #8a7656; margin: 0 0 14px; display: flex; align-items: center; gap: 8px;
        }
        .pile-count {
          font-size: 12px; background: #ece0cc; color: #6b5640; border-radius: 999px;
          padding: 1px 9px; letter-spacing: 0;
        }

        .sealed-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
        .seal-card {
          position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 6px; min-height: 158px; padding: 30px 14px 16px; text-decoration: none; color: #3a2e22;
          background: linear-gradient(135deg, #f8f0e1 0%, #efe1c9 100%);
          border: 1px solid #d8c7ab; border-radius: 12px; overflow: hidden;
          box-shadow: 0 2px 6px rgba(0,0,0,0.06); transition: transform .15s, box-shadow .15s;
        }
        .seal-card::before {
          content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
          width: 0; height: 0; border-left: 78px solid transparent; border-right: 78px solid transparent;
          border-top: 40px solid rgba(123,90,55,0.10);
        }
        .seal-card:hover { transform: translateY(-2px); box-shadow: 0 10px 22px rgba(0,0,0,0.13); }
        .seal-new {
          position: absolute; top: 9px; right: 9px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
          color: #fff; background: #b8513f; border-radius: 4px; padding: 2px 5px;
        }
        .seal-wax {
          width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          color: #fbe9d2; font-size: 18px; margin-top: 4px;
          background: radial-gradient(circle at 35% 30%, #c25c47, #8a2b22);
          box-shadow: 0 2px 5px rgba(0,0,0,0.3), inset 0 1px 2px rgba(255,255,255,0.3);
        }
        .seal-from { font-weight: 700; font-size: 15px; text-align: center; }
        .seal-when { font-size: 12px; color: #8a7656; }

        .read-list { display: flex; flex-direction: column; gap: 10px; }
        .read-row {
          display: flex; align-items: center; gap: 14px; padding: 10px 12px;
          background: #fbf7ee; border: 1px solid #e6dcc6; border-radius: 11px;
          text-decoration: none; color: inherit;
        }
        .read-row:hover { background: #f5eddc; border-color: #d8c7ab; }
        .read-thumb {
          width: 56px; height: 74px; object-fit: cover; border-radius: 6px;
          border: 1px solid #e0d5c0; background: #fff; flex: 0 0 auto;
        }
        .read-thumb-ph { display: flex; align-items: center; justify-content: center; color: #c2b393; font-size: 22px; }
        .read-body { flex: 1; min-width: 0; }
        .read-from { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #3a2e22; }
        .read-av { border-radius: 50%; object-fit: cover; }
        .read-av-ph {
          width: 18px; height: 18px; border-radius: 50%; background: #ddd; display: inline-flex;
          align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: #555;
        }
        .read-preview {
          font-size: 13px; color: #7a6a52; margin-top: 3px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .read-when { font-size: 12px; color: #a08e6e; margin-top: 3px; }
        .read-arrow { color: #c2b393; font-size: 18px; flex: 0 0 auto; }

        .inbox-loading { display: flex; justify-content: center; padding: 50px; }
        .spinner { width: 36px; height: 36px; border: 3px solid #e0d5c0; border-top-color: #8b4513; border-radius: 50%; animation: spin .8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .inbox-empty { text-align: center; color: #9b8a6e; padding: 50px 16px; }
        .inbox-empty-icon { font-size: 48px; margin-bottom: 10px; }
        .inbox-empty-hint { font-size: 13px; margin-top: 6px; }
      `}</style>
    </AuthGuard>
  );
}
