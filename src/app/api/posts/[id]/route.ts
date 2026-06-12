import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      _count: {
        select: {
          scratches: true,
        },
      },
    },
  });

  if (!post || post.deletedAt) {
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

  return NextResponse.json({
    post: { ...post, stamped: !!userStamp },
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

  if (post.userId !== session.userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await prisma.post.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
