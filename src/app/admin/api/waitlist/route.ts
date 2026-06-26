import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Waitlist entries, newest first, for the admin queue.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 200), 1), 500);

  const [total, pending, entries] = await Promise.all([
    prisma.waitlistEntry.count(),
    prisma.waitlistEntry.count({ where: { invitedAt: null } }),
    prisma.waitlistEntry.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        email: true,
        note: true,
        source: true,
        createdAt: true,
        invitedAt: true,
      },
    }),
  ]);

  return NextResponse.json({ total, pending, entries });
});
