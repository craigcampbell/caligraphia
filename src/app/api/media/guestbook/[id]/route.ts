import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
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
  const entry = await prisma.guestbookEntry.findUnique({
    where: { id },
    select: { imageUrl: true, deletedAt: true },
  });

  if (!entry || entry.deletedAt) {
    return NextResponse.json({ error: "Guestbook entry not found" }, { status: 404 });
  }

  const { buffer, contentType } = await getObjectBuffer(entry.imageUrl);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType || "image/png",
      "Cache-Control": "private, max-age=300",
    },
  });
}
