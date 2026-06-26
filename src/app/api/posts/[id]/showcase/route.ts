import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isShowcaseEligible } from "@/lib/post-access";

export const runtime = "nodejs";

// The author opts a public-feed letter into (or out of) the open, crawlable web.
// Only the author, only an eligible (public, unaddressed, live) letter.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  let body: { showcase?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const showcase = body.showcase === true;

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      userId: true,
      isPrivate: true,
      isDeadLetter: true,
      needsReview: true,
      recipientId: true,
      deliverAt: true,
      deletedAt: true,
    },
  });
  if (!post || post.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (showcase && !isShowcaseEligible(post)) {
    return NextResponse.json(
      { error: "Only a public, unaddressed letter can be showcased." },
      { status: 400 }
    );
  }

  await prisma.post.update({ where: { id }, data: { isShowcased: showcase } });
  return NextResponse.json({ ok: true, isShowcased: showcase });
}
