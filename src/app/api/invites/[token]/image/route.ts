import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getObjectBuffer } from "@/lib/storage";

// Public, no auth: the invite email's <img> points here, and it's viewed by a
// recipient who isn't signed in. The unguessable token is the access control.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: { imageUrl: true },
  });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { buffer, contentType } = await getObjectBuffer(invite.imageUrl);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType || "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("Invite image error:", err);
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
  }
}
