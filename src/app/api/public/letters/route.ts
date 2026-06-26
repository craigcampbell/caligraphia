import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible } from "@/lib/post-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUBLIC, no auth. Only letters posted to the open feed — never anything private
// or addressed to someone. Exposes a minimal, safe shape (no email, no recipient,
// no stroke data).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 24), 1), 48);
  const cursor = url.searchParams.get("cursor");
  if (cursor && !/^[0-9a-f-]{36}$/i.test(cursor)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
  }

  const rows = await prisma.post.findMany({
    where: {
      isShowcased: true,
      deletedAt: null,
      isPrivate: false,
      isDeadLetter: false,
      needsReview: false,
      recipientId: null,
      OR: [{ deliverAt: null }, { deliverAt: { lte: new Date() } }],
    },
    select: {
      id: true,
      createdAt: true,
      stampCount: true,
      ocrHashtags: true,
      format: true,
      finalImageUrl: true,
      uploadedPhotoUrl: true,
      // fields the public gate needs to re-verify each row:
      isShowcased: true,
      isPrivate: true,
      isDeadLetter: true,
      needsReview: true,
      recipientId: true,
      deliverAt: true,
      deletedAt: true,
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).filter((p) => isPubliclyVisible(p));

  return NextResponse.json({
    letters: page.map((p) => ({
      id: p.id,
      author: { id: p.user.id, username: p.user.username, avatar: p.user.nomDePlume },
      createdAt: p.createdAt,
      stampCount: p.stampCount,
      hashtags: p.ocrHashtags,
      format: p.format,
      imageUrl: p.finalImageUrl || p.uploadedPhotoUrl ? `/api/public/image/${p.id}` : null,
    })),
    nextCursor: hasMore ? rows[limit - 1].id : null,
  });
}
