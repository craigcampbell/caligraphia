import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewPost } from "@/lib/post-access";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { post: true },
  });

  if (!comment || comment.deletedAt || !canViewPost(comment.post, session.userId)) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const { buffer, contentType } = await getObjectBuffer(comment.imageUrl);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType || "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
