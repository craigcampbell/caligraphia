import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Lift a ban. The user must sign in again (their old tokens stay dead from the
// epoch bump at ban time); we bump once more for good measure.
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, bannedAt: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.bannedAt) return NextResponse.json({ ok: true, already: true });

  await prisma.user.update({
    where: { id },
    data: {
      bannedAt: null,
      banReason: null,
      bannedByAdminId: null,
      sessionEpoch: { increment: 1 },
    },
  });
  await writeAudit(admin.id, "user_unban", {
    targetType: "user",
    targetId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
