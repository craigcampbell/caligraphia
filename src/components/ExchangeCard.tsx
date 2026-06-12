"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ExchangeStatus {
  state: "none" | "waiting" | "write" | "sent" | "complete";
  partner?: { id: string; username: string; nomDePlume: string | null };
  receivedLetterId?: string | null;
}

export function ExchangeCard() {
  const [status, setStatus] = useState<ExchangeStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/exchange");
      if (res.ok) setStatus(await res.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    load();
  }, []);

  const join = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/exchange", { method: "POST" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/exchange", { method: "DELETE" });
      if (res.ok) setStatus({ state: "none" });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;

  return (
    <div className="xc">
      <div className="xc-seal">&#9993;</div>

      {status.state === "none" && (
        <>
          <h2 className="xc-title">The Letter Exchange</h2>
          <p className="xc-body">
            Be paired with a stranger. You write them one letter; they write
            you one back. That&apos;s the whole deal.
          </p>
          <button className="xc-btn" onClick={join} disabled={busy}>
            Join the Exchange
          </button>
        </>
      )}

      {status.state === "waiting" && (
        <>
          <h2 className="xc-title">You&apos;re in line</h2>
          <p className="xc-body">
            We&apos;ll pair you with the next writer who joins. Check back soon.
          </p>
          <button className="xc-btn xc-btn-quiet" onClick={leave} disabled={busy}>
            Leave the queue
          </button>
        </>
      )}

      {status.state === "write" && status.partner && (
        <>
          <h2 className="xc-title">You&apos;ve been paired</h2>
          <p className="xc-body">
            <strong>{status.partner.username}</strong> is waiting on a letter
            from you. Take your time — make it worth opening.
          </p>
          <Link href={`/post/new?send_to=${status.partner.id}`} className="xc-btn">
            &#9998; Write your letter
          </Link>
        </>
      )}

      {status.state === "sent" && status.partner && (
        <>
          <h2 className="xc-title">Your letter is on its way</h2>
          <p className="xc-body">
            Delivered to <strong>{status.partner.username}</strong>. Now you
            wait for the post — watch your{" "}
            <Link href="/inbox" className="xc-link">inbox</Link>.
          </p>
        </>
      )}

      {status.state === "complete" && status.partner && (
        <>
          <h2 className="xc-title">Exchange complete</h2>
          <p className="xc-body">
            You and <strong>{status.partner.username}</strong> each have a
            letter written just for you.
            {status.receivedLetterId && (
              <>
                {" "}
                <Link href={`/post/${status.receivedLetterId}`} className="xc-link">
                  Read yours again
                </Link>
                .
              </>
            )}
          </p>
          <button className="xc-btn" onClick={join} disabled={busy}>
            Exchange with someone new
          </button>
        </>
      )}

      <style>{`
        .xc {
          max-width: 480px;
          margin: 0 auto 8px;
          padding: 24px 28px 26px;
          background: #fffef9;
          border: 1px solid #e0d5c0;
          border-radius: 8px;
          text-align: center;
          position: relative;
          z-index: 1;
          box-shadow: 0 2px 16px rgba(80,40,20,0.06);
        }
        .xc-seal { font-size: 30px; margin-bottom: 6px; }
        .xc-title { font-size: 20px; font-weight: 700; color: #2c2416; margin-bottom: 8px; }
        .xc-body { font-size: 14px; color: #6b5c40; margin-bottom: 16px; line-height: 1.5; }
        .xc-btn {
          display: inline-block;
          padding: 11px 26px;
          background: #1a1a1a; color: #fff;
          border: none; border-radius: 8px;
          font-size: 14px; font-weight: 600; font-family: inherit;
          cursor: pointer;
          box-shadow: 0 3px 14px rgba(0,0,0,0.16);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .xc-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .xc-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .xc-btn-quiet {
          background: none; color: #8c7a60; box-shadow: none;
          border: 1px solid #d8cfb8;
        }
        .xc-link { color: #8b4513; text-decoration: underline; }
      `}</style>
    </div>
  );
}
