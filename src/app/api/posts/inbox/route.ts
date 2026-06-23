import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePosts } from "@/lib/post-dto";

// The postbox: private letters delivered to the current user. Returns each
// letter's readAt so the client can split them into unopened vs. read piles,
// plus a true unread count (sealed letters only).
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 300);

  // Hide anything still in transit (slow post not yet delivered).
  const delivered = {
    OR: [{ deliverAt: null }, { deliverAt: { lte: new Date() } }],
  };
  const where = {
    recipientId: session.userId,
    deletedAt: null,
    ...delivered,
  };

  const [posts, unreadCount] = await Promise.all([
    prisma.post.findMany({
      where,
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
    }),
    prisma.post.count({ where: { ...where, readAt: null } }),
  ]);

  return NextResponse.json({ posts: serializePosts(posts), unreadCount });
}
