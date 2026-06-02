import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!q || q.length < 1) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      NOT: { id: session.userId },
      username: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      username: true,
      nomDePlume: true,
    },
    take: 10,
    orderBy: { username: "asc" },
  });

  return NextResponse.json({ users });
}
