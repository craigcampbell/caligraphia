import { prisma } from "@/lib/prisma";

// Headline application metrics for the dashboard.

export interface AppCounts {
  users: number;
  bannedUsers: number;
  letters: number;
  deletedLetters: number;
  openReports: number;
  invites: number;
  warnings: number;
}

export async function getCounts(): Promise<AppCounts> {
  const [users, bannedUsers, letters, deletedLetters, openReports, invites, warnings] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { bannedAt: { not: null } } }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.post.count({ where: { deletedAt: { not: null } } }),
      prisma.report.count({ where: { status: "open" } }),
      prisma.invite.count(),
      prisma.warning.count(),
    ]);
  return { users, bannedUsers, letters, deletedLetters, openReports, invites, warnings };
}
