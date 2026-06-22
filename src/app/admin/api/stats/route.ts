import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/admin/guard";
import { getServerStats } from "@/lib/admin/server-stats";
import { getDbStats } from "@/lib/admin/db-stats";
import { getCounts } from "@/lib/admin/counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One call powers the dashboard: server resources + DB health + app counts.
export const GET = withAdmin(async () => {
  const [server, db, counts] = await Promise.all([
    getServerStats(),
    getDbStats().catch((e) => {
      console.error("db-stats failed:", e);
      return null;
    }),
    getCounts(),
  ]);
  return NextResponse.json({ server, db, counts });
});
