import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimitInteraction } from "@/lib/rate-limit";

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

  // Check if user has stamps to spend
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { stampBalance: true },
  });

  if (!user || user.stampBalance < 1) {
    return NextResponse.json(
      { error: "Not enough stamps. Earn stamps by creating letters." },
      { status: 402 }
    );
  }

  // Check if post exists
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, deletedAt: true },
  });

  if (!post || post.deletedAt) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Check if user already stamped this post
  const existingLike = await prisma.postInteraction.findUnique({
    where: { postId_userId: { postId: id, userId: session.userId } },
  });

  if (existingLike && existingLike.interactionType === "like") {
    // User already stamped (liked) this post — remove the stamp
    // Refund the stamp
    await prisma.user.update({
      where: { id: session.userId },
      data: { stampBalance: { increment: 1 } },
    });

    await prisma.postInteraction.delete({
      where: { postId_userId: { postId: id, userId: session.userId } },
    });

    await prisma.post.update({
      where: { id },
      data: { stampCount: { decrement: 1 } },
    });

    // Mark the stamp as unspent
    await prisma.stamp.updateMany({
      where: { spentOnPostId: id, ownerId: session.userId },
      data: { spentAt: null, spentOnPostId: null },
    });

    const count = await prisma.post.findUnique({ where: { id }, select: { stampCount: true } });

    return NextResponse.json({
      action: "un-stamped",
      stampCount: count?.stampCount || 0,
    });
  }

  // Find an unspent stamp to spend
  const availableStamp = await prisma.stamp.findFirst({
    where: { ownerId: session.userId, spentAt: null },
    orderBy: { issuedAt: "asc" },
  });

  if (!availableStamp) {
    return NextResponse.json(
      { error: "No stamps available. Earn stamps by creating letters." },
      { status: 402 }
    );
  }

  // Spend the stamp
  await prisma.stamp.update({
    where: { id: availableStamp.id },
    data: { spentAt: new Date(), spentOnPostId: id },
  });

  // Deduct from user balance
  await prisma.user.update({
    where: { id: session.userId },
    data: { stampBalance: { decrement: 1 } },
  });

  // Update post stamp count
  await prisma.post.update({
    where: { id },
    data: { stampCount: { increment: 1 } },
  });

  // Create or update interaction
  await prisma.postInteraction.upsert({
    where: { postId_userId: { postId: id, userId: session.userId } },
    create: {
      postId: id,
      userId: session.userId,
      interactionType: "like",
    },
    update: {
      interactionType: "like",
    },
  });

  const count = await prisma.post.findUnique({ where: { id }, select: { stampCount: true } });

  return NextResponse.json({
    action: "stamped",
    stampCount: count?.stampCount || 0,
    spentStampId: availableStamp.id,
    stampTier: availableStamp.tier,
    stampIssue: availableStamp.issueNumber,
  });
}
