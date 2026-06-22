import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Admin media proxy: serve a post's primary image for review, bypassing
// canViewPost (private/deleted posts included). Page images are addressed by
// ?page=<position>. Read-only oversight — no caching at the edge.
export const GET = withAdmin(async (req, { params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(req.url);
  const pageParam = url.searchParams.get("page");

  let key: string | null = null;
  if (pageParam !== null && pageParam !== "0") {
    const position = Number(pageParam);
    if (!Number.isInteger(position) || position < 1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const page = await prisma.postPage.findFirst({
      where: { postId: id, position },
      select: { imageUrl: true },
    });
    key = page?.imageUrl ?? null;
  } else {
    const post = await prisma.post.findUnique({
      where: { id },
      select: { finalImageUrl: true, uploadedPhotoUrl: true },
    });
    key = post ? post.finalImageUrl || post.uploadedPhotoUrl : null;
  }

  if (!key) return NextResponse.json({ error: "No image" }, { status: 404 });

  try {
    const { buffer, contentType } = await getObjectBuffer(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Admin media proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
});
