"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Feed } from "@/components/Feed";
import Link from "next/link";

export default function HomePage() {
  return (
    <AuthGuard>
      <NavBar />
      <main className="home-main">
        <div className="home-hero">
          <div className="ink-blot ink-blot-1" />
          <div className="ink-blot ink-blot-2" />
          <h1 className="home-title">Your handwriting,<br />your voice.</h1>
          <p className="home-sub">Every post is drawn by hand. No typing. No pasting.</p>
          <Link href="/post/new" className="home-cta">
            <span className="cta-icon">&#9998;</span> Create a Post
          </Link>
        </div>
        <Feed />

        <style>{`
          .home-main {
            padding-bottom: 60px;
            position: relative;
          }
          .home-hero {
            text-align: center;
            padding: 48px 16px 36px;
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
            background: radial-gradient(circle, #8e44ad, #c0392b, transparent);
            top: -80px; left: -40px;
          }
          .ink-blot-2 {
            width: 200px; height: 200px;
            background: radial-gradient(circle, #2471a3, #16a085, transparent);
            bottom: -40px; right: -20px;
          }
          .home-title {
            font-size: 36px; font-weight: 700; line-height: 1.2; position: relative; z-index: 1;
            background: linear-gradient(135deg, #1a1a2e, #8e44ad, #c0392b, #d35400);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
            margin-bottom: 10px;
          }
          .home-sub {
            font-size: 15px; color: #8c7a60; font-style: italic; position: relative; z-index: 1;
            margin-bottom: 20px;
          }
          .home-cta {
            display: inline-flex; align-items: center; gap: 8px;
            padding: 14px 32px;
            background: linear-gradient(135deg, #2c3e50, #c0392b);
            color: #fff; border-radius: 28px; font-weight: 700; font-size: 16px;
            position: relative; z-index: 1;
            box-shadow: 0 4px 20px rgba(192,57,43,0.25);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .home-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 30px rgba(192,57,43,0.35);
          }
          .cta-icon { font-size: 20px; }
        `}</style>
      </main>
    </AuthGuard>
  );
}
