import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/payments";

export const runtime = "nodejs";
// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !whSecret) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature") || "";
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch (err) {
    console.error("Stripe webhook signature check failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const sessionId = (event.data.object as Stripe.Checkout.Session).id;

    // Credit the buyer once. Idempotent: only a still-pending purchase is paid out.
    const purchase = await prisma.stampPurchase.findFirst({
      where: { stripeSessionId: sessionId },
    });
    if (purchase && purchase.status !== "completed") {
      await prisma.$transaction([
        prisma.stampPurchase.update({
          where: { id: purchase.id },
          data: { status: "completed", completedAt: new Date() },
        }),
        prisma.user.update({
          where: { id: purchase.userId },
          data: {
            stampBalance: { increment: purchase.stamps },
            totalStampsEarned: { increment: purchase.stamps },
          },
        }),
      ]);
    }
  }

  return NextResponse.json({ received: true });
}
