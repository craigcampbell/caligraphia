import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Issue a warning to a user. Recorded in the DB and surfaced to the user in-app;
// optionally tied to the report that prompted it.
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { reason?: unknown; reportId?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500).trim() : "";
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });
  const reportId =
    typeof body.reportId === "string" && UUID.test(body.reportId) ? body.reportId : null;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only honour reportId if it actually exists (avoid FK explosions on bad input).
  let linkedReportId: string | undefined;
  if (reportId) {
    const r = await prisma.report.findUnique({ where: { id: reportId }, select: { id: true } });
    if (r) linkedReportId = r.id;
  }

  const warning = await prisma.warning.create({
    data: { userId: id, adminId: admin.id, reason, reportId: linkedReportId },
    select: { id: true, createdAt: true },
  });
  await writeAudit(admin.id, "user_warn", {
    targetType: "user",
    targetId: id,
    detail: { warningId: warning.id },
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true, warning });
});
