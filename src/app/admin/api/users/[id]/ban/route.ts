import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Ban a user. getSession() rejects banned accounts, and bumping sessionEpoch
// invalidates any session tokens they currently hold (immediate logout).
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { reason?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const reason =
    typeof body.reason === "string" ? body.reason.slice(0, 500).trim() || null : null;

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, bannedAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (user.bannedAt) return NextResponse.json({ ok: true, already: true });

  await prisma.user.update({
    where: { id },
    data: {
      bannedAt: new Date(),
      banReason: reason,
      bannedByAdminId: admin.id,
      sessionEpoch: { increment: 1 },
    },
  });
  await writeAudit(admin.id, "user_ban", {
    targetType: "user",
    targetId: id,
    detail: reason ? { reason } : undefined,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
