import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  // Private letters sent to the current user
  const posts = await prisma.post.findMany({
    where: {
      recipientId: session.userId,
      deletedAt: null,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
      _count: {
        select: {
          interactions: { where: { interactionType: "like" } },
          scratches: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

  // Also get count of unread
  const unreadCount = await prisma.post.count({
    where: {
      recipientId: session.userId,
      deletedAt: null,
    },
  });

  return NextResponse.json({ posts, nextCursor, unreadCount });
}
