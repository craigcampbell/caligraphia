import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { describeExchange, getActiveExchange } from "@/lib/exchange";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const exchange = await getActiveExchange(session.userId);
  if (exchange) {
    return NextResponse.json(describeExchange(session.userId, exchange));
  }

  // No active exchange — surface a recently completed one so the user gets
  // their "exchange complete" moment before the card resets.
  const recentlyCompleted = await prisma.exchange.findFirst({
    where: {
      OR: [{ userAId: session.userId }, { userBId: session.userId }],
      letterAId: { not: null },
      letterBId: { not: null },
      matchedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    include: {
      userA: { select: { id: true, username: true, nomDePlume: true } },
      userB: { select: { id: true, username: true, nomDePlume: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    describeExchange(session.userId, recentlyCompleted)
  );
}

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const active = await getActiveExchange(session.userId);
  if (active) {
    return NextResponse.json(describeExchange(session.userId, active));
  }

  // Claim the oldest open seat that isn't ours. updateMany re-checks
  // userBId = null so two people joining at once can't take the same seat.
  const openSeat = await prisma.exchange.findFirst({
    where: { userBId: null, userAId: { not: session.userId } },
    orderBy: { createdAt: "asc" },
  });

  if (openSeat) {
    const claimed = await prisma.exchange.updateMany({
      where: { id: openSeat.id, userBId: null },
      data: { userBId: session.userId, matchedAt: new Date() },
    });
    if (claimed.count === 1) {
      const exchange = await getActiveExchange(session.userId);
      return NextResponse.json(describeExchange(session.userId, exchange), {
        status: 201,
      });
    }
    // Someone else grabbed it between the find and the update — fall through
    // and open our own seat instead.
  }

  await prisma.exchange.create({
    data: { userAId: session.userId },
  });

  const exchange = await getActiveExchange(session.userId);
  return NextResponse.json(describeExchange(session.userId, exchange), {
    status: 201,
  });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Leaving the queue is only allowed while still unmatched — once paired,
  // someone is waiting on your letter.
  const removed = await prisma.exchange.deleteMany({
    where: { userAId: session.userId, userBId: null },
  });

  if (removed.count === 0) {
    return NextResponse.json(
      { error: "You're already paired — your partner is counting on you." },
      { status: 409 }
    );
  }

  return NextResponse.json({ success: true });
}
