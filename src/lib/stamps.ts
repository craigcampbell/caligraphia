import { prisma } from "./prisma";

// Stamps are a scarce currency. New stamps only enter the economy three ways:
// a one-time signup grant, a small monthly grant, and real-money purchases.
// They mostly *circulate* — stamping (liking) a letter hands a stamp to its
// author, so writing things people love is the main way to earn.

export const SIGNUP_GRANT_STAMPS = 25; // a starter sheet so new folks can engage
export const MONTHLY_GRANT_STAMPS = 10; // a gentle monthly trickle (set 0 to disable)

// Stamps it costs to make a piece of custom stationery.
export const CUSTOM_PAPER_COST_STAMPS = 20;

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Grants the monthly stamp allotment once per calendar month. `stampRefillAt`
 * doubles as "last granted". Idempotent within a month; never removes stamps.
 */
export async function grantMonthlyStamps(
  db: TxClient | typeof prisma,
  userId: string
): Promise<void> {
  if (MONTHLY_GRANT_STAMPS <= 0) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  await db.user.updateMany({
    where: {
      id: userId,
      stampRefillAt: { lt: startOfMonth },
    },
    data: {
      stampBalance: { increment: MONTHLY_GRANT_STAMPS },
      stampRefillAt: new Date(),
    },
  });
}
