import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Toggle an entry's "invited" flag. Body: { invited: boolean }. Marking invited
// is just bookkeeping — the actual invitation goes out via the handwritten flow.
export const PATCH = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { invited?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* default below */
  }
  const invited = body.invited !== false; // default to marking invited

  const entry = await prisma.waitlistEntry.findUnique({ where: { id }, select: { id: true } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.waitlistEntry.update({
    where: { id },
    data: { invitedAt: invited ? new Date() : null },
    select: { id: true, invitedAt: true },
  });

  await writeAudit(admin.id, "waitlist_invite", {
    targetType: "waitlist",
    targetId: id,
    detail: { invited },
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true, entry: updated });
});

// Remove an entry from the list (e.g. spam, or once they've joined).
export const DELETE = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.waitlistEntry.findUnique({ where: { id }, select: { id: true } });
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.waitlistEntry.delete({ where: { id } });

  await writeAudit(admin.id, "waitlist_remove", {
    targetType: "waitlist",
    targetId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
