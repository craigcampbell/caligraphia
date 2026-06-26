"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PencilIcon, EnvelopeIcon, StarIcon } from "./Icons";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stampBalance, setStampBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetch("/api/stamps/balance")
        .then((r) => r.json())
        .then((d) => setStampBalance(d.balance))
        .catch(() => {});
    }
  }, [user]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          <PencilIcon size={20} className="brand-mark" />
          Caligraphia
        </Link>

        {user && (
          <button
            className={`nav-toggle ${menuOpen ? "open" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
            <span className="nav-toggle-bar" />
          </button>
        )}

        {user && (
          <div className={`nav-links ${menuOpen ? "open" : ""}`} onClick={() => setMenuOpen(false)}>
            <Link href="/post/new" className="nav-link nav-write-link">
              <PencilIcon size={14} />Pen a Letter
            </Link>
            <Link href="/post/new?mode=draw" className="nav-link">Doodle</Link>
            <Link href="/practice" className="nav-link" title="Warm up your hand — guide lines and a phrase to trace">Practice</Link>
            <Link href="/inbox" className="nav-link">
              <EnvelopeIcon size={14} />Inbox
            </Link>
            <Link href="/gallery" className="nav-link" title="Walk among the letters">The Line</Link>
            <Link href="/board" className="nav-link" title="Everyone's letters, pinned along one wall">The Board</Link>
            <Link href="/requests" className="nav-link" title="Ask someone to write or draw for you">Requests</Link>
            <Link href="/robins" className="nav-link" title="Letters written by three hands">Robins</Link>
            <Link href="/dead-letters" className="nav-link" title="Letters to no one, waiting to be claimed">Dead Letters</Link>
            <Link href="/groups" className="nav-link">Circles</Link>
            <Link href="/invite" className="nav-link" title="Send a friend a handwritten postcard invitation">Invite</Link>
            <Link href="/stamps" className="nav-link" title="Stamp Book">
              <StarIcon size={14} />Stamps
            </Link>

            {/* Stamp balance */}
            {stampBalance !== null && (
              <span className="nav-stamp-balance" title="Your stamps">
                <StarIcon size={13} filled />
                <span className="stamp-count-nav">{stampBalance}</span>
              </span>
            )}

            <Link href={`/users/${user.id}`} className="nav-link nav-user">
              {user.nomDePlume ? (
                <img src={user.nomDePlume} alt="" className="nav-av" width={26} height={26} />
              ) : (
                <span className="nav-av-ph">{user.username[0].toUpperCase()}</span>
              )}
              {user.username}
            </Link>
            <button onClick={handleLogout} className="nav-link nav-btn">Leave</button>
          </div>
        )}
      </div>

      <style>{`
        .nav {
          background: linear-gradient(180deg, #fefcf6 0%, #faf6ee 100%);
          border-bottom: 1px solid #e0d5c0;
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-inner {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 20px;
          position: relative;
        }
        .nav-toggle { display: none; }
        .nav-brand {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: #1a1a1a;
          display: flex;
          align-items: center;
          gap: 7px;
          flex-shrink: 0;
        }
        .brand-mark { color: #8b4513; }
        .nav-links {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #5c4a30;
          font-size: 13px;
          font-weight: 500;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 10px;
          border-radius: 6px;
          font-family: inherit;
          white-space: nowrap;
        }
        .nav-link:hover {
          color: #1a1a1a;
          background: rgba(0,0,0,0.04);
        }
        .nav-write-link {
          background: rgba(0,0,0,0.05);
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 8px;
          padding: 6px 14px;
          font-weight: 600;
        }
        .nav-write-link:hover {
          background: rgba(0,0,0,0.09);
        }
        .nav-icon { font-size: 16px; line-height: 1; }
        .nav-av { border-radius: 50%; object-fit: cover; }
        .nav-av-ph {
          width: 26px; height: 26px; border-radius: 50%;
          background: #e0d5c0; display: flex; align-items: center;
          justify-content: center; font-size: 12px; font-weight: 600; color: #5c4a30;
        }
        .nav-stamp-balance {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #fef9e8;
          border: 1px solid #e8d5a0;
          border-radius: 8px;
          font-size: 13px;
          color: #8b6914;
          cursor: default;
        }
        .stamp-icon-nav { font-size: 14px; }
        .stamp-count-nav { font-weight: 700; }
        .nav-btn { font-family: inherit; }

        /* Phones & small tablets: collapse the links behind a menu button so the
           header stays a single slim bar. */
        @media (max-width: 900px) {
          .nav-inner { padding: 11px 16px; }
          .nav-brand { font-size: 20px; }
          .nav-toggle {
            display: inline-flex; flex-direction: column; justify-content: center; gap: 4px;
            width: 42px; height: 38px; padding: 0 10px; flex-shrink: 0;
            border: 1px solid #e0d5c0; border-radius: 9px; background: #fffef9; cursor: pointer;
          }
          .nav-toggle-bar {
            display: block; height: 2px; width: 100%; background: #5c4a30;
            border-radius: 2px; transition: transform 0.2s, opacity 0.2s;
          }
          .nav-toggle.open .nav-toggle-bar:nth-child(1) { transform: translateY(6px) rotate(45deg); }
          .nav-toggle.open .nav-toggle-bar:nth-child(2) { opacity: 0; }
          .nav-toggle.open .nav-toggle-bar:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }

          .nav-links {
            display: none;
            position: absolute; top: 100%; left: 0; right: 0;
            flex-direction: column; align-items: stretch; justify-content: flex-start;
            gap: 2px; padding: 8px;
            background: #fefcf6; border-bottom: 1px solid #e0d5c0;
            box-shadow: 0 14px 28px rgba(80,40,20,0.14);
            max-height: calc(100vh - 60px); overflow-y: auto;
          }
          .nav-links.open { display: flex; }
          .nav-link, .nav-btn {
            width: 100%; justify-content: flex-start;
            font-size: 15px; padding: 12px 14px; border-radius: 8px;
          }
          .nav-write-link { width: 100%; justify-content: flex-start; font-size: 15px; padding: 12px 14px; }
          .nav-stamp-balance { align-self: flex-start; margin: 4px 0 4px 14px; }
          .nav-user { border-top: 1px solid #efe6d4; margin-top: 4px; padding-top: 14px; }
        }
      `}</style>
    </nav>
  );
}
