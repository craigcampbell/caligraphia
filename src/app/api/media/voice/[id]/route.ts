import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import { getObjectBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// Serve a letter's voice postscript to anyone allowed to view the letter.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      voiceUrl: true,
      userId: true,
      recipientId: true,
      isPrivate: true,
      isDeadLetter: true,
      needsReview: true,
      deliverAt: true,
      deletedAt: true,
    },
  });
  if (!post || !canViewPost(post, session.userId) || !post.voiceUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await getObjectBuffer(post.voiceUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "audio/webm",
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    console.error("voice proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch audio" }, { status: 500 });
  }
}
