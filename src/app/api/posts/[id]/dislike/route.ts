import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
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

  const interaction = await prisma.postInteraction.upsert({
    where: {
      postId_userId: {
        postId: params.id,
        userId: session.userId,
      },
    },
    update: { interactionType: "dislike" },
    create: {
      postId: params.id,
      userId: session.userId,
      interactionType: "dislike",
    },
  });

  return NextResponse.json({ interaction });
}
