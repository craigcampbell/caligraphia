import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/guard";
import { getServerStats, getDockerStats } from "@/lib/admin/server-stats";
import { getDbStats } from "@/lib/admin/db-stats";
import { getCounts } from "@/lib/admin/counts";
import { getStorageStats } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One call powers the dashboard: server resources + DB health + app counts +
// real image storage + Docker disk usage.
export const GET = withAdmin(async () => {
  const [server, db, counts, storage, docker] = await Promise.all([
    getServerStats(),
    getDbStats().catch((e) => {
      console.error("db-stats failed:", e);
      return null;
    }),
    getCounts(),
    getStorageStats().catch((e) => {
      console.error("storage-stats failed:", e);
      return null;
    }),
    getDockerStats(),
  ]);
  return NextResponse.json({ server, db, counts, storage, docker });
});
