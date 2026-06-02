import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Serve post images through Next.js to avoid MinIO hostname issues
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
      select: { finalImageUrl: true, uploadedPhotoUrl: true },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const imageUrl = post.finalImageUrl || post.uploadedPhotoUrl;
    if (!imageUrl) {
      return NextResponse.json({ error: "No image" }, { status: 404 });
    }

    // Fetch from MinIO internally and proxy
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "Image not found in storage" }, { status: 404 });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Image proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
