// List admins and their status (no secrets).
//   docker compose -f docker-compose.tunnel.yml exec app npm run admin:list
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.adminUser.findMany({ orderBy: { username: "asc" } });
  if (admins.length === 0) {
    console.log("No admins yet. Create one with: npm run admin:create -- <username>");
  }
  for (const a of admins) {
    const unusedRecovery = await prisma.adminRecoveryCode.count({
      where: { adminUserId: a.id, usedAt: null },
    });
    const locked = a.lockedUntil && a.lockedUntil > new Date() ? a.lockedUntil.toISOString() : "no";
    console.log(
      `${a.username}  active=${a.isActive}  2fa=${a.totpEnabledAt ? "on" : "OFF"}  ` +
        `lastLogin=${a.lastLoginAt?.toISOString() ?? "never"}  locked=${locked}  recoveryUnused=${unusedRecovery}`
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
