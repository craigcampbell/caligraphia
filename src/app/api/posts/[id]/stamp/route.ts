import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitInteraction } from "@/lib/rate-limit";
import { ensureDailyStamps } from "@/lib/stamps";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const rl = rateLimitInteraction(session.userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many interactions" },
      { status: 429 }
    );
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });

  if (!post || post.deletedAt) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      await ensureDailyStamps(tx, session.userId);

      const existing = await tx.postInteraction.findUnique({
        where: { postId_userId: { postId: id, userId: session.userId } },
      });

      if (existing) {
        // Already stamped — remove it and refund
        await tx.postInteraction.delete({
          where: { postId_userId: { postId: id, userId: session.userId } },
        });
        await tx.user.update({
          where: { id: session.userId },
          data: { stampBalance: { increment: 1 } },
        });
        const updated = await tx.post.update({
          where: { id },
          data: { stampCount: { decrement: 1 } },
          select: { stampCount: true },
        });
        return { action: "un-stamped" as const, stampCount: updated.stampCount };
      }

      // Spend a stamp; the guarded updateMany keeps two concurrent requests
      // from driving the balance negative.
      const spent = await tx.user.updateMany({
        where: { id: session.userId, stampBalance: { gte: 1 } },
        data: { stampBalance: { decrement: 1 } },
      });
      if (spent.count === 0) {
        throw new OutOfStampsError();
      }

      await tx.postInteraction.create({
        data: { postId: id, userId: session.userId, interactionType: "like" },
      });
      const updated = await tx.post.update({
        where: { id },
        data: { stampCount: { increment: 1 } },
        select: { stampCount: true },
      });
      return { action: "stamped" as const, stampCount: updated.stampCount };
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof OutOfStampsError) {
      return NextResponse.json(
        { error: "You're out of stamps for today. Your sheet refills tomorrow." },
        { status: 402 }
      );
    }
    throw err;
  }
}

class OutOfStampsError extends Error {
  constructor() {
    super("Out of stamps");
  }
}
