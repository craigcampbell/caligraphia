import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const requestInclude = {
  requester: { select: { id: true, username: true, nomDePlume: true } },
  requestee: { select: { id: true, username: true, nomDePlume: true } },
  requestPost: {
    select: { id: true, finalImageUrl: true, uploadedPhotoUrl: true, createdAt: true },
  },
  fulfillmentPost: {
    select: { id: true, finalImageUrl: true, uploadedPhotoUrl: true, createdAt: true },
  },
} as const;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter"); // "for_me" | "mine" | null (everything)

  const where: Record<string, unknown> = {};
  if (filter === "for_me") where.requesteeId = session.userId;
  if (filter === "mine") where.requesterId = session.userId;

  const requests = await prisma.letterRequest.findMany({
    where,
    include: requestInclude,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ requests });
}
