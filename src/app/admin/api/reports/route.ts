import { NextResponse } from "next/server";
import type { ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/admin/guard";

export const runtime = "nodejs";

const STATUSES = new Set(["open", "resolved", "dismissed"]);

// Admin reports queue. Default to the open queue; allow filtering by status.
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") ?? "open";
  const status = STATUSES.has(statusParam) ? (statusParam as ReportStatus) : "open";
  const take = Math.min(Math.max(Number(url.searchParams.get("take") ?? 50), 1), 100);
  const skip = Math.max(Number(url.searchParams.get("skip") ?? 0), 0);

  const [total, reports] = await Promise.all([
    prisma.report.count({ where: { status } }),
    prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
      take,
      skip,
      select: {
        id: true,
        targetType: true,
        targetId: true,
        postId: true,
        reason: true,
        note: true,
        status: true,
        createdAt: true,
        reporter: { select: { id: true, username: true } },
        post: {
          select: {
            id: true,
            userId: true,
            postType: true,
            deletedAt: true,
            createdAt: true,
            user: { select: { id: true, username: true, bannedAt: true } },
          },
        },
      },
    }),
  ]);

  // For user-target reports, attach a light snapshot of the reported account.
  const userTargetIds = reports
    .filter((r) => r.targetType === "user")
    .map((r) => r.targetId);
  const targetUsers = userTargetIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userTargetIds } },
        select: { id: true, username: true, bannedAt: true },
      })
    : [];
  const userById = new Map(targetUsers.map((u) => [u.id, u]));

  return NextResponse.json({
    status,
    total,
    take,
    skip,
    reports: reports.map((r) => ({
      ...r,
      targetUser: r.targetType === "user" ? userById.get(r.targetId) ?? null : null,
    })),
  });
});
