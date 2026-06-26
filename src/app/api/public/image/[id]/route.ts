import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible } from "@/lib/post-access";
import { getObjectBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// PUBLIC image of a public letter — used by share cards / Open Graph and the
// logged-out gallery. Re-checks isPubliclyVisible on every request, so a letter
// that becomes private/deleted stops serving (modulo a short cache).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      finalImageUrl: true,
      uploadedPhotoUrl: true,
      isShowcased: true,
      isPrivate: true,
      isDeadLetter: true,
      needsReview: true,
      recipientId: true,
      deliverAt: true,
      deletedAt: true,
    },
  });

  if (!isPubliclyVisible(post)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const key = post!.finalImageUrl || post!.uploadedPhotoUrl;
  if (!key) return NextResponse.json({ error: "No image" }, { status: 404 });

  try {
    const { buffer, contentType } = await getObjectBuffer(key);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/png",
        // Public content; keep the cache short so privacy/deletion changes propagate.
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    console.error("public image error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
