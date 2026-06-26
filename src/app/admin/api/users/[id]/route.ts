import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Full moderation view of one user: profile, ban state, recent posts, warnings,
// and reports filed against them.
export const GET = withAdmin(async (_req, { params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      nomDePlume: true,
      createdAt: true,
      bannedAt: true,
      banReason: true,
      stampBalance: true,
      totalStampsEarned: true,
      bannedByAdmin: { select: { username: true } },
      _count: { select: { posts: true, warnings: true } },
      stampPurchases: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, packId: true, stamps: true, cents: true, status: true, createdAt: true },
      },
      stampAdjustments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, amount: true, kind: true, reason: true, createdAt: true },
      },
      posts: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          postType: true,
          createdAt: true,
          deletedAt: true,
          isPrivate: true,
          recipientId: true,
        },
      },
      warnings: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, reason: true, createdAt: true, admin: { select: { username: true } } },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reports filed against this user (user-target reports).
  const reportsAgainst = await prisma.report.findMany({
    where: { targetType: "user", targetId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, reason: true, note: true, status: true, createdAt: true },
  });

  return NextResponse.json({ ...user, reportsAgainst });
});
