import { NextResponse } from "next/server";
import { withAdmin, revokeAdminSession } from "@/lib/admin/guard";
import { clearAdminCookies } from "@/lib/admin/session";

export const runtime = "nodejs";

export const POST = withAdmin(async (_req, { session }) => {
  if (session) await revokeAdminSession(session.id);
  await clearAdminCookies();
  return NextResponse.json({ ok: true });
});
