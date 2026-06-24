import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getStampPack } from "@/lib/payments";

export const runtime = "nodejs";

// Start a Stripe Checkout for a stamp pack. Returns the hosted checkout URL.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Buying stamps isn't available yet." }, { status: 503 });
  }

  let body: { packId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const pack = typeof body.packId === "string" ? getStampPack(body.packId) : undefined;
  if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });

  const base = process.env.BASE_URL || "";

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.cents,
          product_data: { name: `${pack.stamps} Caligraphia stamps` },
        },
      },
    ],
    metadata: { userId: session.userId, stamps: String(pack.stamps), packId: pack.id },
    success_url: `${base}/stamps?purchased=1`,
    cancel_url: `${base}/stamps?canceled=1`,
  });

  await prisma.stampPurchase.create({
    data: {
      userId: session.userId,
      packId: pack.id,
      stamps: pack.stamps,
      cents: pack.cents,
      stripeSessionId: checkout.id,
      status: "pending",
    },
  });

  return NextResponse.json({ url: checkout.url });
}
