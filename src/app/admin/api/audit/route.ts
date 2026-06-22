import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The append-only admin action log. Detail is already redacted at write time.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 100), 1), 200);
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0), 0);

  const [total, entries] = await Promise.all([
    prisma.adminAudit.count(),
    prisma.adminAudit.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        detail: true,
        ip: true,
        createdAt: true,
        admin: { select: { username: true } },
      },
    }),
  ]);

  return NextResponse.json({ total, take, skip, entries });
});
