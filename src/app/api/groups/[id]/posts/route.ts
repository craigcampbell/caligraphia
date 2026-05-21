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

  const group = await prisma.group.findUnique({ where: { id: params.id } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  let pattern: RegExp;
  try {
    pattern = new RegExp(group.tagPattern, "i");
  } catch {
    return NextResponse.json(
      { error: "Group has invalid tag pattern" },
      { status: 500 }
    );
  }

  const allPosts = await prisma.post.findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
      _count: { select: { interactions: { where: { interactionType: "like" } }, scratches: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 5,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const filtered = allPosts.filter(
    (p) => p.ocrHashtags.some((h) => pattern.test(h))
  );

  const truncated = filtered.slice(0, limit);
  const nextCursor =
    filtered.length > limit ? filtered[limit - 1].id : null;

  const enriched = await Promise.all(
    truncated.map(async (post) => {
      const dislikes = await prisma.postInteraction.count({
        where: { postId: post.id, interactionType: "dislike" },
      });
      return { ...post, dislikeCount: dislikes };
    })
  );

  return NextResponse.json({ posts: enriched, nextCursor });
}
