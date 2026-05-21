"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Feed } from "@/components/Feed";

export default function HomePage() {
  return (
    <AuthGuard>
      <NavBar />
      <main className="main-content">
        <Feed />
      </main>
      <style>{`
        .main-content {
          padding: 24px 16px;
          min-height: 100vh;
        }
      `}</style>
    </AuthGuard>
  );
}
