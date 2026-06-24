import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";

export const runtime = "nodejs";

// Serve a custom stationery texture. Usable by its owner or anyone if it's public.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const design = await prisma.paperDesign.findUnique({
    where: { id },
    select: { imageUrl: true, ownerId: true, isPublic: true },
  });
  if (!design || (!design.isPublic && design.ownerId !== session.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await getObjectBuffer(design.imageUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": contentType || "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    console.error("paper media proxy error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
