import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDailyStamps, DAILY_STAMP_ALLOWANCE } from "@/lib/stamps";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await ensureDailyStamps(prisma, session.userId);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      stampBalance: true,
      totalStampsEarned: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get stamp designs available
  const designs = await prisma.stampDesign.findMany({
    orderBy: [{ tier: "asc" }, { season: "asc" }],
  });

  // Get user's stamps grouped by tier
  const stamps = await prisma.stamp.findMany({
    where: { ownerId: session.userId },
    orderBy: { issuedAt: "desc" },
    take: 100,
  });

  const commonCount = stamps.filter((s) => s.tier === "Common").length;
  const unspentCount = stamps.filter((s) => !s.spentAt).length;

  return NextResponse.json({
    balance: user.stampBalance,
    dailyAllowance: DAILY_STAMP_ALLOWANCE,
    totalEarned: user.totalStampsEarned,
    unspentCount,
    commonCount,
    totalStamps: stamps.length,
    designs,
  });
}
