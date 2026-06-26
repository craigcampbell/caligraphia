import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";
import { getStripe, refundCheckoutSession } from "@/lib/payments";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Refund a completed stamp purchase via Stripe, then claw back the stamps the
// buyer still holds (floored at 0 — we don't drive them negative).
export const POST = withAdmin(async (_req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const purchase = await prisma.stampPurchase.findUnique({ where: { id } });
  if (!purchase) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (purchase.status !== "completed") {
    return NextResponse.json({ error: "Only a completed purchase can be refunded." }, { status: 409 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 });
  }

  try {
    await refundCheckoutSession(stripe, purchase.stripeSessionId);
  } catch (e) {
    console.error("Stripe refund failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Refund failed at Stripe." },
      { status: 400 }
    );
  }

  const clawed = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: purchase.userId },
      select: { stampBalance: true },
    });
    const claw = Math.min(purchase.stamps, user?.stampBalance ?? 0);
    if (claw > 0) {
      await tx.user.update({
        where: { id: purchase.userId },
        data: { stampBalance: { decrement: claw } },
      });
    }
    await tx.stampPurchase.update({
      where: { id },
      data: { status: "refunded", refundedAt: new Date() },
    });
    await tx.stampAdjustment.create({
      data: {
        userId: purchase.userId,
        adminId: admin.id,
        amount: -claw,
        kind: "refund_clawback",
        reason: `Refund of ${purchase.stamps}-stamp pack`,
        purchaseId: purchase.id,
      },
    });
    return claw;
  });

  return NextResponse.json({ ok: true, clawedBack: clawed });
});
