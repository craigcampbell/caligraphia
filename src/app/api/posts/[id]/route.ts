import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost, canThrowAwayPost } from "@/lib/post-access";
import { serializePost } from "@/lib/post-dto";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
      scratches: {
        include: {
          user: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      comments: {
        where: { deletedAt: null },
        include: {
          user: { select: { id: true, username: true, nomDePlume: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      pages: {
        orderBy: { position: "asc" },
      },
      _count: {
        select: {
          scratches: true,
          comments: true,
        },
      },
    },
  });

  if (!post || !canViewPost(post, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const userStamp = await prisma.postInteraction.findUnique({
    where: {
      postId_userId: {
        postId: post.id,
        userId: session.userId,
      },
    },
  });

  // Opening a letter you received seals its "read" — it moves to the read pile.
  if (post.recipientId === session.userId && !post.readAt) {
    const now = new Date();
    await prisma.post.update({ where: { id: post.id }, data: { readAt: now } }).catch(() => {});
    post.readAt = now;
  }

  return NextResponse.json({
    post: serializePost({ ...post, stamped: !!userStamp }),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post || post.deletedAt) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!canThrowAwayPost(post, session.userId)) {
    // The author of a letter that's already been sent gets a clear explanation;
    // anyone else who isn't a party to it gets a uniform 404 (no existence oracle).
    if (post.userId === session.userId) {
      return NextResponse.json(
        { error: "Once a letter has been sent, only the person who received it can throw it away." },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.post.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
