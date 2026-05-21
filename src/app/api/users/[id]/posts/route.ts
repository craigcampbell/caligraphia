import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  const posts = await prisma.post.findMany({
    where: { userId: params.id, deletedAt: null },
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

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].id : null;

  const enriched = await Promise.all(
    posts.map(async (post) => {
      const dislikes = await prisma.postInteraction.count({
        where: { postId: post.id, interactionType: "dislike" },
      });
      return { ...post, dislikeCount: dislikes };
    })
  );

  return NextResponse.json({ posts: enriched, nextCursor });
}
