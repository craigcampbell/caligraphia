import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

const unclaimed = (userId: string) => ({
  isDeadLetter: true,
  recipientId: null,
  deletedAt: null,
  NOT: { userId },
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [available, claimed, left] = await Promise.all([
    prisma.post.count({ where: unclaimed(session.userId) }),
    prisma.post.count({
      where: { isDeadLetter: true, recipientId: session.userId, deletedAt: null },
    }),
    prisma.post.count({
      where: { isDeadLetter: true, userId: session.userId, deletedAt: null },
    }),
  ]);

  return NextResponse.json({ available, claimed, left });
}

// Claim one letter from the office, sight unseen
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`dlo:${session.userId}`, 2, 60 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "The clerk eyes you suspiciously. Come back in a while." },
      { status: 429 }
    );
  }

  // A few attempts in case a concurrent claim wins the same letter
  for (let attempt = 0; attempt < 3; attempt++) {
    const count = await prisma.post.count({ where: unclaimed(session.userId) });
    if (count === 0) {
      return NextResponse.json(
        { error: "The pigeonholes are empty. Leave a letter of your own?" },
        { status: 404 }
      );
    }

    const pick = await prisma.post.findFirst({
      where: unclaimed(session.userId),
      skip: Math.floor(Math.random() * count),
      select: { id: true },
    });
    if (!pick) continue;

    const won = await prisma.post.updateMany({
      where: { id: pick.id, recipientId: null },
      data: { recipientId: session.userId },
    });
    if (won.count === 1) {
      const post = await prisma.post.findUnique({
        where: { id: pick.id },
        include: { user: { select: { id: true, username: true, nomDePlume: true } } },
      });
      return NextResponse.json({ post }, { status: 200 });
    }
  }

  return NextResponse.json(
    { error: "Someone reached that pigeonhole first. Try again." },
    { status: 409 }
  );
}
