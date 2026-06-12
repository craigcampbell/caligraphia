"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Feed } from "@/components/Feed";
import { ExchangeCard } from "@/components/ExchangeCard";
import Link from "next/link";

export default function HomePage() {
  return (
    <AuthGuard>
      <NavBar />
      <main className="home-main">
        <div className="home-hero">
          <div className="ink-blot ink-blot-1" />
          <div className="ink-blot ink-blot-2" />
          <h1 className="home-title">Caligraphia</h1>
          <svg className="home-flourish" viewBox="0 0 220 14" aria-hidden="true">
            <path d="M4 9 C 50 3, 90 12, 130 7 S 200 4, 216 8" fill="none" stroke="#8b4513" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
            <path d="M150 11 C 165 9, 180 10, 192 10" fill="none" stroke="#8b4513" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
          </svg>
          <p className="home-sub">Where people who love handwriting and doodling find one another.</p>
          <div className="home-ctas">
            <Link href="/post/new" className="home-cta">
              <span className="cta-icon">&#9998;</span> Write a Letter
            </Link>
            <Link href="/inbox" className="home-cta home-cta-quiet">
              <span className="cta-icon">&#9993;</span> Open your Inbox
            </Link>
          </div>
        </div>
        <ExchangeCard />
        <h2 className="feed-heading">The Postbox <span className="feed-heading-sub">— letters left out for everyone</span></h2>
        <Feed />

        <style>{`
          .home-main {
            padding-bottom: 60px;
            position: relative;
          }
          .home-hero {
            text-align: center;
            padding: 40px 16px 28px;
            position: relative;
            overflow: hidden;
            background: linear-gradient(180deg, #fefdf9 0%, #faf7f0 100%);
            border-bottom: 1px solid #e8dcc8;
          }
          .ink-blot {
            position: absolute; border-radius: 50%; pointer-events: none;
            filter: blur(50px); opacity: 0.12; z-index: 0;
          }
          .ink-blot-1 {
            width: 280px; height: 280px;
            background: radial-gradient(circle, #4a3018, #8b6948, transparent);
            top: -80px; left: -40px;
          }
          .ink-blot-2 {
            width: 200px; height: 200px;
            background: radial-gradient(circle, #54381c, #96764e, transparent);
            bottom: -40px; right: -20px;
          }
          .home-title {
            font-size: 34px; font-weight: 700; line-height: 1.2; position: relative; z-index: 1;
            color: var(--ink, #1a1a1a);
            letter-spacing: -0.5px;
            margin-bottom: 0;
          }
          .home-flourish {
            width: 190px; height: 13px; margin: 2px auto 8px;
            display: block; position: relative; z-index: 1;
          }
          .home-sub {
            font-size: 14px; color: #8c7a60; font-style: italic; position: relative; z-index: 1;
            margin-bottom: 16px;
          }
          .home-ctas {
            display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
            position: relative; z-index: 1;
          }
          .home-cta-quiet {
            background: #fffef9 !important;
            color: #5c4a30 !important;
            border: 1px solid #d8cfb8;
            box-shadow: none !important;
          }
          .feed-heading {
            max-width: 900px; margin: 28px auto 4px; padding: 0 16px;
            font-size: 17px; font-weight: 700; color: #2c2416;
          }
          .feed-heading-sub {
            font-weight: 400; font-style: italic; color: #a09080; font-size: 13px;
          }
          .home-cta {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 12px 28px;
            background: #1a1a1a;
            color: #fff; border-radius: 8px; font-weight: 700; font-size: 15px;
            position: relative; z-index: 1;
            box-shadow: 0 4px 20px rgba(0,0,0,0.18);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .home-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(0,0,0,0.18);
          }
          .cta-icon { font-size: 18px; }
        `}</style>
      </main>
    </AuthGuard>
  );
}
