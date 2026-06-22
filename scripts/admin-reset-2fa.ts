// Reset an admin's 2FA (lost authenticator). Wipes the TOTP secret + recovery
// codes, revokes sessions, and prints a fresh one-time enroll token so re-enroll
// still requires console possession as the second factor.
//   docker compose -f docker-compose.tunnel.yml exec app npm run admin:reset-2fa -- <username>
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/admin/password";

const prisma = new PrismaClient();

async function main() {
  const username = (process.argv[2] || process.env.ADMIN_USERNAME || "").trim();
  const admin = await prisma.adminUser.findUnique({ where: { username } });
  if (!admin) {
    console.error(`No admin named "${username}".`);
    process.exit(1);
  }

  const enrollPlain = randomBytes(24).toString("base64url");
  const enrollToken = await hashPassword(enrollPlain);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      totpSecret: null,
      pendingTotpSecret: null,
      totpEnabledAt: null,
      lastTotpStep: null,
      enrollToken,
      enrollTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  await prisma.adminRecoveryCode.deleteMany({ where: { adminUserId: admin.id } });
  await prisma.adminSession.updateMany({
    where: { adminUserId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log("\n2FA reset for", username);
  console.log("New enroll token (valid 60 min):", enrollPlain);
  console.log("Log in with your password + this token to re-enroll your authenticator.\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
