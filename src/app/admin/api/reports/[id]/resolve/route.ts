import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Resolve a report (action was taken). Idempotent-ish: only open reports move.
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { note?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const note =
    typeof body.note === "string" ? body.note.slice(0, 500).trim() || null : null;

  const report = await prisma.report.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status !== "open") {
    return NextResponse.json({ error: "Report already closed" }, { status: 409 });
  }

  await prisma.report.update({
    where: { id },
    data: {
      status: "resolved",
      resolvedByAdminId: admin.id,
      resolvedAt: new Date(),
      resolutionNote: note,
    },
  });
  await writeAudit(admin.id, "report_resolve", {
    targetType: "report",
    targetId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
