import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";
import { isStripeConfigured } from "@/lib/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stamp-pack purchases, newest first, for the admin purchases queue.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 100), 1), 200);
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0), 0);

  const [total, purchases] = await Promise.all([
    prisma.stampPurchase.count(),
    prisma.stampPurchase.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        packId: true,
        stamps: true,
        cents: true,
        status: true,
        createdAt: true,
        completedAt: true,
        refundedAt: true,
        user: { select: { id: true, username: true } },
      },
    }),
  ]);

  return NextResponse.json({ total, purchases, stripeEnabled: isStripeConfigured() });
});
