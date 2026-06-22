import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { canViewPost } from "@/lib/post-access";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";

// Serve an extra letter page (PostPage). Privacy is inherited from the parent
// post — a page must never be viewable by someone who can't see the letter.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const page = await prisma.postPage.findUnique({
    where: { id },
    include: { post: true },
  });

  if (!page || !canViewPost(page.post, session.userId)) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await getObjectBuffer(page.imageUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error("Page image error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
