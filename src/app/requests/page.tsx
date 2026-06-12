"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { UserSearch } from "@/components/UserSearch";
import { useAuth } from "@/hooks/useAuth";

interface MiniUser {
  id: string;
  username: string;
  nomDePlume: string | null;
}

interface MiniPost {
  id: string;
  finalImageUrl: string | null;
  uploadedPhotoUrl: string | null;
  createdAt: string;
}

interface LetterRequest {
  id: string;
  status: "open" | "fulfilled" | "withdrawn";
  createdAt: string;
  fulfilledAt: string | null;
  requester: MiniUser;
  requestee: MiniUser;
  requestPost: MiniPost;
  fulfillmentPost: MiniPost | null;
}

interface ProminentUser extends MiniUser {
  totalStampsEarned: number;
  _count: { followers: number; posts: number; requestsReceived: number };
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Avatar({ user, size = 22 }: { user: MiniUser; size?: number }) {
  return user.nomDePlume ? (
    <img src={user.nomDePlume} alt="" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover" }} />
  ) : (
    <span className="rq-av-ph" style={{ width: size, height: size, fontSize: size * 0.45 }}>
      {user.username[0].toUpperCase()}
    </span>
  );
}

export default function RequestBoardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<LetterRequest[]>([]);
  const [prominent, setProminent] = useState<ProminentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [rq, pm] = await Promise.all([
          fetch("/api/requests"),
          fetch("/api/users/prominent"),
        ]);
        if (rq.ok) setRequests((await rq.json()).requests || []);
        if (pm.ok) setProminent((await pm.json()).users || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const withdraw = async (id: string) => {
    if (!confirm("Take this request down from the board?")) return;
    const res = await fetch(`/api/requests/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "withdrawn" } : r)));
    }
  };

  const open = requests.filter((r) => r.status === "open");
  const answered = requests.filter((r) => r.status === "fulfilled");

  return (
    <AuthGuard>
      <NavBar />
      <main className="rq-main">
        <header className="rq-header">
          <h1 className="rq-title">The Request Board</h1>
          <p className="rq-sub">
            Admire someone&apos;s hand? Pin a handwritten note asking them to write or draw
            something for you. Your ask goes up on the board; their answer comes back in ink.
          </p>
        </header>

        <section className="rq-ask-panel">
          <h2 className="rq-section-title">Pens in demand</h2>
          <div className="rq-prominent-row">
            {prominent.map((p) => (
              <div key={p.id} className="rq-prominent-card">
                <Link href={`/users/${p.id}`} className="rq-prominent-id">
                  <Avatar user={p} size={34} />
                  <span className="rq-prominent-name">{p.username}</span>
                </Link>
                <span className="rq-prominent-stats">
                  &#9733; {p.totalStampsEarned} &middot; {p._count.followers} followers
                </span>
                <button
                  className="rq-ask-btn"
                  onClick={() => router.push(`/post/new?request_of=${p.id}`)}
                >
                  &#9998; Request a piece
                </button>
              </div>
            ))}
            {!loading && prominent.length === 0 && (
              <p className="rq-empty">No other members yet — invite a penfriend.</p>
            )}
          </div>
          <div className="rq-search-row">
            <span className="rq-search-label">or ask anyone:</span>
            <div className="rq-search-box">
              <UserSearch
                onSelect={(u) => router.push(`/post/new?request_of=${u.id}`)}
                placeholder="Search by username..."
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="rq-section-title">Open requests {open.length > 0 && <span className="rq-dim">({open.length})</span>}</h2>
          {loading && <p className="rq-empty">Checking the board&hellip;</p>}
          {!loading && open.length === 0 && (
            <p className="rq-empty">The board is bare. Ask someone for a piece of their handwriting.</p>
          )}
          <div className="rq-grid">
            {open.map((r) => {
              const askImg = r.requestPost.finalImageUrl || r.requestPost.uploadedPhotoUrl;
              const forMe = user?.id === r.requestee.id;
              const mine = user?.id === r.requester.id;
              return (
                <div key={r.id} className={`rq-card ${forMe ? "rq-card-for-me" : ""}`}>
                  <span className="rq-pin" />
                  {askImg && <img src={askImg} alt="" className="rq-card-img" loading="lazy" />}
                  <div className="rq-card-meta">
                    <span className="rq-card-line">
                      <Link href={`/users/${r.requester.id}`} className="rq-name">{r.requester.username}</Link>
                      {" asks "}
                      <Link href={`/users/${r.requestee.id}`} className="rq-name">{r.requestee.username}</Link>
                    </span>
                    <span className="rq-time">{timeAgo(r.createdAt)}</span>
                  </div>
                  {forMe && (
                    <button className="rq-answer-btn" onClick={() => router.push(`/post/new?fulfill=${r.id}`)}>
                      &#9998; Answer with a letter
                    </button>
                  )}
                  {mine && (
                    <button className="rq-withdraw-btn" onClick={() => withdraw(r.id)}>
                      Take it down
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {answered.length > 0 && (
          <section>
            <h2 className="rq-section-title">Answered</h2>
            <div className="rq-answered-list">
              {answered.map((r) => {
                const askImg = r.requestPost.finalImageUrl || r.requestPost.uploadedPhotoUrl;
                const ansImg = r.fulfillmentPost?.finalImageUrl || r.fulfillmentPost?.uploadedPhotoUrl;
                return (
                  <div key={r.id} className="rq-answered-card">
                    <div className="rq-answered-pair">
                      <div className="rq-answered-half">
                        <span className="rq-half-label">{r.requester.username} asked</span>
                        {askImg && <img src={askImg} alt="" className="rq-half-img" loading="lazy" />}
                      </div>
                      <span className="rq-arrow">&rarr;</span>
                      <div className="rq-answered-half">
                        <span className="rq-half-label">{r.requestee.username} answered</span>
                        {r.fulfillmentPost ? (
                          <Link href={`/post/${r.fulfillmentPost.id}`}>
                            {ansImg && <img src={ansImg} alt="" className="rq-half-img" loading="lazy" />}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                    <span className="rq-time">{r.fulfilledAt ? timeAgo(r.fulfilledAt) : ""}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <style>{`
        .rq-main { max-width: 900px; margin: 0 auto; padding: 28px 16px 60px; }
        .rq-header { text-align: center; margin-bottom: 28px; }
        .rq-title { font-size: 30px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
        .rq-sub { font-size: 14px; color: #8c7a60; font-style: italic; max-width: 540px; margin: 6px auto 0; }
        .rq-section-title { font-size: 16px; font-weight: 700; color: #2c2416; margin: 26px 0 12px; }
        .rq-dim { font-weight: 400; color: #a09080; }
        .rq-ask-panel {
          background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 8px;
          padding: 4px 18px 16px; box-shadow: 0 2px 10px rgba(60,40,20,0.04);
        }
        .rq-prominent-row { display: flex; gap: 12px; flex-wrap: wrap; }
        .rq-prominent-card {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 14px 16px; border: 1px solid #ece2d0; border-radius: 8px;
          background: #fff; min-width: 150px;
        }
        .rq-prominent-id { display: flex; flex-direction: column; align-items: center; gap: 5px; text-decoration: none; }
        .rq-prominent-name { font-weight: 700; font-size: 13px; color: #2c2416; }
        .rq-prominent-stats { font-size: 11px; color: #a09080; }
        .rq-ask-btn {
          margin-top: 4px; padding: 6px 12px; border: 1.5px solid #d0c8b8; border-radius: 7px;
          background: #fefdf9; color: #5c4a30; cursor: pointer;
          font-family: inherit; font-size: 12px; font-weight: 600;
        }
        .rq-ask-btn:hover { border-color: #1a1a1a; color: #1a1a1a; }
        .rq-av-ph {
          border-radius: 50%; background: #e0d5c0; display: inline-flex;
          align-items: center; justify-content: center; font-weight: 700; color: #5c4a30;
        }
        .rq-search-row { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
        .rq-search-label { font-size: 13px; font-style: italic; color: #8c7a60; white-space: nowrap; }
        .rq-search-box { flex: 1; max-width: 320px; }
        .rq-empty { font-size: 13px; font-style: italic; color: #a09080; }
        .rq-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
        .rq-card {
          position: relative; background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 4px;
          padding: 10px 10px 12px; box-shadow: 0 3px 10px rgba(60,40,20,0.08);
        }
        .rq-card-for-me { border-color: #8b4513; box-shadow: 0 3px 14px rgba(139,69,19,0.18); }
        .rq-pin {
          position: absolute; top: -6px; left: 50%; margin-left: -6px;
          width: 12px; height: 12px; border-radius: 50%; background: #c0392b;
          box-shadow: inset -2px -2px 3px rgba(0,0,0,0.3), 0 2px 3px rgba(0,0,0,0.3);
        }
        .rq-card-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: #f7f3ea; border-radius: 2px; }
        .rq-card-meta { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 8px; }
        .rq-card-line { font-size: 12px; color: #6b5c40; }
        .rq-name { font-weight: 700; color: #2c2416; text-decoration: none; }
        .rq-time { font-size: 11px; color: #b0a090; white-space: nowrap; }
        .rq-answer-btn {
          width: 100%; margin-top: 10px; padding: 9px 0; border: none; border-radius: 7px;
          background: #1a1a1a; color: #fff; cursor: pointer;
          font-family: inherit; font-size: 13px; font-weight: 700;
        }
        .rq-withdraw-btn {
          width: 100%; margin-top: 10px; padding: 7px 0; border: 1px solid #ddd; border-radius: 7px;
          background: #fff; color: #888; cursor: pointer; font-family: inherit; font-size: 12px;
        }
        .rq-withdraw-btn:hover { color: #c0392b; border-color: #e8c0c0; }
        .rq-answered-list { display: flex; flex-direction: column; gap: 16px; }
        .rq-answered-card {
          background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 6px; padding: 14px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .rq-answered-pair { display: flex; align-items: center; gap: 12px; }
        .rq-answered-half { flex: 1; min-width: 0; }
        .rq-half-label { display: block; font-size: 11px; font-style: italic; color: #8c7a60; margin-bottom: 5px; }
        .rq-half-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 3px; background: #f7f3ea; display: block; }
        .rq-arrow { font-size: 20px; color: #b08850; }
      `}</style>
    </AuthGuard>
  );
}
