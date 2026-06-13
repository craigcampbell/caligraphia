import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import { serializeScratches } from "@/lib/post-dto";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!canViewPost(post, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const scratches = await prisma.scratch.findMany({
    where: { parentPostId: params.id },
    include: {
      user: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ scratches: serializeScratches(scratches) });
}
