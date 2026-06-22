// Per-account lockout — the primary, IP-independent brute-force control (a
// spoofable client IP must never be able to lock a real account). Survives
// restarts because it lives on the AdminUser row.
import { prisma } from "../prisma";

export async function accountLockedUntil(adminId: string): Promise<Date | null> {
  const a = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { lockedUntil: true },
  });
  if (a?.lockedUntil && a.lockedUntil.getTime() > Date.now()) return a.lockedUntil;
  return null;
}

export async function recordFailure(adminId: string): Promise<void> {
  const a = await prisma.adminUser.update({
    where: { id: adminId },
    data: { failedAttempts: { increment: 1 } },
    select: { failedAttempts: true },
  });
  let lockMs = 0;
  if (a.failedAttempts >= 15) lockMs = 60 * 60 * 1000;
  else if (a.failedAttempts >= 10) lockMs = 15 * 60 * 1000;
  else if (a.failedAttempts >= 5) lockMs = 60 * 1000;
  if (lockMs) {
    await prisma.adminUser.update({
      where: { id: adminId },
      data: { lockedUntil: new Date(Date.now() + lockMs) },
    });
  }
}

export async function resetFailures(adminId: string): Promise<void> {
  await prisma.adminUser.update({
    where: { id: adminId },
    data: { failedAttempts: 0, lockedUntil: null },
  });
}
