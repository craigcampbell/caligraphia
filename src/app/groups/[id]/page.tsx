"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { NavBar } from "@/components/NavBar";
import { Feed } from "@/components/Feed";
import { useParams } from "next/navigation";

export default function GroupDetailPage() {
  const { id } = useParams();

  return (
    <AuthGuard>
      <NavBar />
      <main style={{ padding: "24px 16px" }}>
        <Feed
          endpoint={`/api/groups/${id}/posts`}
          emptyMessage="No posts in this group yet."
        />
      </main>
    </AuthGuard>
  );
}
