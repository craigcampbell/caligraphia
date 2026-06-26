import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Grant (or remove) stamps for a user — comps, goodwill, corrections. Recorded in
// stamp_adjustments. Positive = give, negative = take (floored at 0).
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { amount?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 5000) {
    return NextResponse.json({ error: "Amount must be a non-zero number up to ±5000." }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.slice(0, 300).trim() || null : null;

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id }, select: { stampBalance: true } });
    if (!user) return null;
    const newBalance = Math.max(0, user.stampBalance + amount);
    const applied = newBalance - user.stampBalance; // what actually changed (floored)
    await tx.user.update({ where: { id }, data: { stampBalance: newBalance } });
    await tx.stampAdjustment.create({
      data: { userId: id, adminId: admin.id, amount: applied, kind: "comp", reason },
    });
    return { newBalance, applied };
  });

  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Best-effort note in the IP-tagged path; the adjustment row is the real record.
  void getClientIp(req);
  return NextResponse.json({ ok: true, balance: result.newBalance, applied: result.applied });
});
