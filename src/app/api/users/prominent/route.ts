import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Members whose pens are in demand: ranked by stamps earned, with follower
// count as a tiebreaker. Shown on the Request Board as people worth asking.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { NOT: { id: session.userId } },
    select: {
      id: true,
      username: true,
      nomDePlume: true,
      totalStampsEarned: true,
      _count: { select: { followers: true, posts: true, requestsReceived: true } },
    },
    orderBy: [
      { totalStampsEarned: "desc" },
      { createdAt: "asc" },
    ],
    take: 8,
  });

  return NextResponse.json({ users });
}
