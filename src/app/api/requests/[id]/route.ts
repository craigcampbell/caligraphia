import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializePost } from "@/lib/post-dto";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const letterRequest = await prisma.letterRequest.findUnique({
    where: { id: params.id },
    include: {
      requester: { select: { id: true, username: true, nomDePlume: true } },
      requestee: { select: { id: true, username: true, nomDePlume: true } },
      requestPost: {
        select: { id: true, finalImageUrl: true, uploadedPhotoUrl: true, createdAt: true },
      },
      fulfillmentPost: {
        select: { id: true, finalImageUrl: true, uploadedPhotoUrl: true, createdAt: true },
      },
    },
  });

  if (!letterRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    request: {
      ...letterRequest,
      requestPost: serializePost(letterRequest.requestPost),
      fulfillmentPost: letterRequest.fulfillmentPost
        ? serializePost(letterRequest.fulfillmentPost)
        : null,
    },
  });
}

// Withdraw a request you made (only while it's still open)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const letterRequest = await prisma.letterRequest.findUnique({ where: { id: params.id } });
  if (!letterRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (letterRequest.requesterId !== session.userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  if (letterRequest.status !== "open") {
    return NextResponse.json({ error: "Only open requests can be withdrawn" }, { status: 409 });
  }

  await prisma.letterRequest.update({
    where: { id: params.id },
    data: { status: "withdrawn" },
  });

  return NextResponse.json({ success: true });
}
