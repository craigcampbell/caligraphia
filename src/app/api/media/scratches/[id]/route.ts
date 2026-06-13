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
  const scratch = await prisma.scratch.findUnique({
    where: { id },
    include: { parentPost: true },
  });

  if (!scratch || !canViewPost(scratch.parentPost, session.userId)) {
    return NextResponse.json({ error: "Scratch not found" }, { status: 404 });
  }

  if (!scratch.compositeImageUrl) {
    return NextResponse.json({ error: "No image" }, { status: 404 });
  }

  const { buffer, contentType } = await getObjectBuffer(scratch.compositeImageUrl);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType || "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
