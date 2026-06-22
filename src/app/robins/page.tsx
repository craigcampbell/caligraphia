"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { CanvasDraw } from "@/components/CanvasDraw";

interface Robin {
  id: string;
  size: number;
  status: string;
  createdAt: string;
  sectionCount: number;
  contributors: string[];
  alreadyJoined: boolean;
  peekUrl: string | null;
  finalPost: { id: string; finalImageUrl: string | null } | null;
}

export default function RobinsPage() {
  const [robins, setRobins] = useState<Robin[]>([]);
  const [loading, setLoading] = useState(true);
  // null = browsing; "new" = starting a chain; otherwise the robin being continued
  const [writingFor, setWritingFor] = useState<Robin | "new" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [finished, setFinished] = useState<string | null>(null); // postId of a just-completed robin

  const refresh = async () => {
    try {
      const res = await fetch("/api/robins");
      if (res.ok) setRobins((await res.json()).robins || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const submitSection = async (pages: { strokes: any[]; inkStyle: string }[], durationMs: number) => {
    if (!writingFor) return;
    setSubmitting(true);
    setError("");
    try {
      const page = pages[0]; // round-robin sections are single-page
      const url = writingFor === "new" ? "/api/robins" : `/api/robins/${writingFor.id}/sections`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvas_stroke_data: page.strokes,
          drawing_duration_ms: durationMs,
          ink_style: page.inkStyle,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWritingFor(null);
        if (data.done && data.postId) setFinished(data.postId);
        refresh();
      } else {
        setError(data.error || "Failed to add your part");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const open = robins.filter((r) => r.status === "open");
  const done = robins.filter((r) => r.status === "done" && r.finalPost);

  if (writingFor) {
    const continuing = writingFor !== "new" ? writingFor : null;
    return (
      <AuthGuard>
        <NavBar />
        <main className="rb-main rb-writing">
          <button className="rb-back" onClick={() => { setWritingFor(null); setError(""); }}>
            &larr; Put the pen down
          </button>
          <h1 className="rb-title">
            {continuing ? `Part ${continuing.sectionCount + 1} of ${continuing.size}` : "Start a round robin"}
          </h1>
          {continuing && continuing.peekUrl ? (
            <div className="rb-peek-wrap">
              <p className="rb-peek-label">All you may see of the part before yours:</p>
              <img src={continuing.peekUrl} alt="" className="rb-peek-img" />
            </div>
          ) : (
            <p className="rb-peek-label">
              Write or draw the opening band. The next writer will see only your last sliver.
            </p>
          )}
          {error && <div className="rb-error">{error}</div>}
          {submitting && <div className="rb-submitting">Passing the letter on&hellip;</div>}
          <CanvasDraw
            onComplete={submitSection}
            onCancel={() => setWritingFor(null)}
            canvasW={2400}
            canvasH={1100}
            minDrawTimeMs={8000}
            submitLabel={continuing && continuing.sectionCount + 1 >= continuing.size ? "Finish the letter" : "Pass it on"}
          />
        </main>
        <style>{`
          .rb-main { max-width: 980px; margin: 0 auto; padding: 22px 14px 60px; }
          .rb-back { background: none; border: none; color: #8c7a60; font-size: 14px; cursor: pointer; font-family: inherit; padding: 0 0 12px; }
          .rb-title { font-size: 24px; font-weight: 700; color: #1a1a1a; margin-bottom: 10px; }
          .rb-peek-label { font-size: 13px; font-style: italic; color: #8c7a60; margin-bottom: 8px; }
          .rb-peek-wrap { margin-bottom: 14px; }
          .rb-peek-img { width: 100%; border: 1px solid #e0d5c0; border-bottom: 2px dashed #c9b98e; border-radius: 3px 3px 0 0; display: block; }
          .rb-error { background: #fef5f5; border: 1px solid #f5c6cb; color: #c0392b; padding: 10px 14px; border-radius: 6px; margin-bottom: 12px; font-size: 13px; }
          .rb-submitting { font-size: 13px; font-style: italic; color: #8c7a60; margin-bottom: 10px; }
        `}</style>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <NavBar />
      <main className="rb-main">
        <header className="rb-header">
          <h1 className="rb-title">Round Robins</h1>
          <p className="rb-sub">
            A letter that passes through three hands. Each writer adds a band,
            seeing only a sliver of what came before. The third hand finishes
            it, and the whole letter is published for everyone.
          </p>
          <button className="rb-start-btn" onClick={() => setWritingFor("new")}>
            &#9998; Start a new chain
          </button>
        </header>

        {finished && (
          <div className="rb-finished-note">
            You finished the letter! <Link href={`/post/${finished}`}>See the whole thing &rarr;</Link>
          </div>
        )}

        <section>
          <h2 className="rb-section-title">Letters in flight {open.length > 0 && <span className="rb-dim">({open.length})</span>}</h2>
          {loading && <p className="rb-empty">Looking through the mailbag&hellip;</p>}
          {!loading && open.length === 0 && (
            <p className="rb-empty">No letters are circulating. Start one and see where it goes.</p>
          )}
          <div className="rb-list">
            {open.map((r) => (
              <div key={r.id} className="rb-card">
                {r.peekUrl && <img src={r.peekUrl} alt="" className="rb-card-peek" />}
                <div className="rb-card-row">
                  <span className="rb-card-meta">
                    {r.sectionCount} of {r.size} parts &middot; started by {r.contributors[0]}
                  </span>
                  {r.alreadyJoined ? (
                    <span className="rb-joined">Your part is in &#10003;</span>
                  ) : (
                    <button className="rb-join-btn" onClick={() => setWritingFor(r)}>
                      &#9998; Add part {r.sectionCount + 1}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {done.length > 0 && (
          <section>
            <h2 className="rb-section-title">Finished letters</h2>
            <div className="rb-done-grid">
              {done.map((r) => (
                <Link key={r.id} href={`/post/${r.finalPost!.id}`} className="rb-done-card">
                  {r.finalPost!.finalImageUrl && (
                    <img src={r.finalPost!.finalImageUrl} alt="" className="rb-done-img" loading="lazy" />
                  )}
                  <span className="rb-done-by">{r.contributors.join(" · ")}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <style>{`
        .rb-main { max-width: 760px; margin: 0 auto; padding: 28px 16px 70px; }
        .rb-header { text-align: center; margin-bottom: 26px; }
        .rb-title { font-size: 30px; font-weight: 700; color: #1a1a1a; letter-spacing: -0.5px; }
        .rb-sub { margin: 8px auto 16px; max-width: 480px; font-size: 14px; font-style: italic; color: #8c7a60; line-height: 1.6; }
        .rb-start-btn {
          padding: 12px 28px; border: none; border-radius: 8px;
          background: #1a1a1a; color: #fff; font-size: 14px; font-weight: 700;
          cursor: pointer; font-family: inherit; box-shadow: 0 4px 16px rgba(0,0,0,0.16);
        }
        .rb-finished-note {
          margin-bottom: 18px; padding: 12px 16px; text-align: center;
          background: #f0f5ec; border: 1px solid #c9dbbc; color: #4a6b3a;
          border-radius: 7px; font-size: 14px;
        }
        .rb-finished-note a { font-weight: 700; color: #2f5220; }
        .rb-section-title { font-size: 16px; font-weight: 700; color: #2c2416; margin: 24px 0 12px; }
        .rb-dim { font-weight: 400; color: #a09080; }
        .rb-empty { font-size: 13px; font-style: italic; color: #a09080; }
        .rb-list { display: flex; flex-direction: column; gap: 16px; }
        .rb-card {
          background: #fefdf9; border: 1px solid #e8dcc8; border-radius: 6px;
          overflow: hidden; box-shadow: 0 2px 8px rgba(60,40,20,0.05);
        }
        .rb-card-peek {
          width: 100%; display: block; border-bottom: 2px dashed #c9b98e;
          background: #fff;
        }
        .rb-card-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; padding: 10px 14px;
        }
        .rb-card-meta { font-size: 12px; color: #8c7a60; }
        .rb-joined { font-size: 12px; color: #4a6b3a; font-weight: 600; }
        .rb-join-btn {
          padding: 7px 16px; border: none; border-radius: 7px;
          background: #1a1a1a; color: #fff; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        }
        .rb-done-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .rb-done-card {
          display: block; background: #fefdf9; border: 1px solid #e8dcc8;
          border-radius: 5px; overflow: hidden; text-decoration: none;
        }
        .rb-done-img { width: 100%; aspect-ratio: 2400 / 3300; object-fit: cover; display: block; background: #fff; }
        .rb-done-by { display: block; padding: 7px 10px; font-size: 11px; color: #8c7a60; }
      `}</style>
    </AuthGuard>
  );
}
