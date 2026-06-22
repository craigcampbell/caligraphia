import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";

// List/search users for moderation. `q` matches username/email (case-insensitive).
// `filter=banned` narrows to banned accounts.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const filter = url.searchParams.get("filter");
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0), 0);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (filter === "banned") where.bannedAt = { not: null };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        username: true,
        email: true,
        nomDePlume: true,
        createdAt: true,
        bannedAt: true,
        banReason: true,
        _count: { select: { posts: true, warnings: true } },
      },
    }),
  ]);

  return NextResponse.json({ total, take, skip, users });
});
