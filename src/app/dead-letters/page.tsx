"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";

interface ClaimedPost {
  id: string;
  finalImageUrl: string | null;
  uploadedPhotoUrl: string | null;
  user: { id: string; username: string };
}

function DeadLettersContent() {
  const searchParams = useSearchParams();
  const justLeft = searchParams.get("left") === "1";
  const [available, setAvailable] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState<ClaimedPost | null>(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    try {
      const res = await fetch("/api/dead-letters");
      if (res.ok) {
        const d = await res.json();
        setAvailable(d.available);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => { refresh(); }, []);

  const claim = async () => {
    setClaiming(true);
    setError("");
    try {
      const res = await fetch("/api/dead-letters", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setClaimed(data.post);
        refresh();
      } else {
        setError(data.error || "The clerk shrugs.");
      }
    } catch {
      setError("The office is closed unexpectedly.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <main className="dlo-main">
      <header className="dlo-header">
        <h1 className="dlo-title">The Dead Letter Office</h1>
        <p className="dlo-sub">
          Letters written to no one end up here, sorted into pigeonholes by a
          patient clerk. You may claim one, sight unseen &mdash; but the office
          expects a letter of your own in return, someday.
        </p>
      </header>

      {justLeft && (
        <div className="dlo-left-note">
          Your letter has been filed. Someone, someday, will open it.
        </div>
      )}

      <div className="dlo-counter">
        {available === null ? (
          <span className="dlo-count-line">Counting the pigeonholes&hellip;</span>
        ) : available === 0 ? (
          <span className="dlo-count-line">The pigeonholes are empty.</span>
        ) : (
          <span className="dlo-count-line">
            <strong>{available}</strong> unclaimed {available === 1 ? "letter waits" : "letters wait"} in the pigeonholes.
          </span>
        )}
      </div>

      {claimed ? (
        <div className="dlo-claimed">
          <p className="dlo-claimed-note">
            The clerk slides an old envelope across the counter. It was written by{" "}
            <Link href={`/users/${claimed.user.id}`} className="dlo-claimed-author">{claimed.user.username}</Link>, to no one — now it&apos;s yours.
          </p>
          <Link href={`/post/${claimed.id}`} className="dlo-open-btn">&#9993; Open your letter</Link>
          <p className="dlo-debt">Remember your debt: <Link href="/post/new?dead_letter=1">leave one of your own</Link>.</p>
        </div>
      ) : (
        <div className="dlo-actions">
          <button
            className="dlo-claim-btn"
            onClick={claim}
            disabled={claiming || available === 0}
          >
            {claiming ? "Rummaging…" : "Claim a letter, sight unseen"}
          </button>
          <Link href="/post/new?dead_letter=1" className="dlo-write-link">
            &#9998; Write a letter to no one
          </Link>
        </div>
      )}

      {error && <p className="dlo-error">{error}</p>}

      <style>{`
        .dlo-main {
          max-width: 620px; margin: 0 auto; padding: 44px 16px 80px;
          text-align: center;
        }
        .dlo-header { margin-bottom: 26px; }
        .dlo-title { font-size: 30px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
        .dlo-sub {
          margin: 10px auto 0; max-width: 480px;
          font-size: 14px; font-style: italic; color: #8c7a60; line-height: 1.6;
        }
        .dlo-left-note {
          margin: 0 auto 18px; max-width: 420px;
          background: #f0f5ec; border: 1px solid #c9dbbc; color: #4a6b3a;
          padding: 11px 16px; border-radius: 7px; font-size: 14px;
        }
        .dlo-counter { margin-bottom: 26px; }
        .dlo-count-line { font-size: 15px; color: #5c4a30; }
        .dlo-actions { display: flex; flex-direction: column; align-items: center; gap: 14px; }
        .dlo-claim-btn {
          padding: 14px 34px; border: none; border-radius: 8px;
          background: #1a1a1a; color: #fff; font-size: 15px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        }
        .dlo-claim-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .dlo-write-link { font-size: 14px; color: #6b5c40; }
        .dlo-claimed {
          background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 8px;
          padding: 26px 22px;
        }
        .dlo-claimed-note { font-size: 15px; color: #5c4a30; margin-bottom: 18px; line-height: 1.6; }
        .dlo-claimed-author { font-weight: 700; color: #2c2416; }
        .dlo-open-btn {
          display: inline-block; padding: 12px 28px; border-radius: 8px;
          background: #1a1a1a; color: #fff; font-weight: 700; font-size: 14px;
          text-decoration: none;
        }
        .dlo-debt { margin-top: 16px; font-size: 12px; font-style: italic; color: #a09080; }
        .dlo-debt a { color: #8b4513; }
        .dlo-error { margin-top: 16px; font-size: 13px; color: #c0392b; font-style: italic; }
      `}</style>
    </main>
  );
}

export default function DeadLettersPage() {
  return (
    <AuthGuard>
      <NavBar />
      <Suspense fallback={null}>
        <DeadLettersContent />
      </Suspense>
    </AuthGuard>
  );
}
