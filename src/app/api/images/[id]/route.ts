import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewPost } from "@/lib/post-access";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";

// Serve post images through Next.js to avoid MinIO hostname issues
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const side = new URL(request.url).searchParams.get("side");

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        finalImageUrl: true,
        uploadedPhotoUrl: true,
        backImageUrl: true,
        userId: true,
        recipientId: true,
        isPrivate: true,
        isDeadLetter: true,
        needsReview: true,
        deliverAt: true,
        deletedAt: true,
      },
    });

    if (!post || !canViewPost(post, session.userId)) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // The handwritten back of a photo postcard.
    const imageUrl =
      side === "back" ? post.backImageUrl : post.finalImageUrl || post.uploadedPhotoUrl;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image" }, { status: 404 });
    }

    const { buffer, contentType } = await getObjectBuffer(imageUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Image proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
