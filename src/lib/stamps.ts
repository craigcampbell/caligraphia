import { prisma } from "./prisma";

// Stamps are the one reaction, and they're near-free: everyone wakes up to a
// full sheet. The balance only exists to nudge people toward thoughtfulness,
// never to gate participation.
export const DAILY_STAMP_ALLOWANCE = 25;

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Tops a user back up to the daily allowance if they haven't been refilled
 * today. Never takes stamps away from someone holding more than the allowance.
 */
export async function ensureDailyStamps(
  db: TxClient | typeof prisma,
  userId: string
): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  await db.user.updateMany({
    where: {
      id: userId,
      stampRefillAt: { lt: startOfToday },
      stampBalance: { lt: DAILY_STAMP_ALLOWANCE },
    },
    data: {
      stampBalance: DAILY_STAMP_ALLOWANCE,
      stampRefillAt: new Date(),
    },
  });
}
