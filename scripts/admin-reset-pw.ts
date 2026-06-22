// Reset an admin password. Forces a change on next login and revokes sessions.
//   docker compose -f docker-compose.tunnel.yml exec app npm run admin:reset-pw -- <username>
// Set ADMIN_PASSWORD to choose the temporary password, else one is generated.
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

  let password = process.env.ADMIN_PASSWORD || "";
  const generated = !password;
  if (generated) password = randomBytes(18).toString("base64url");
  if (password.length < 16) {
    console.error("Password must be at least 16 characters.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, mustChangePassword: true, failedAttempts: 0, lockedUntil: null },
  });
  await prisma.adminSession.updateMany({
    where: { adminUserId: admin.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log("\nPassword reset for", username);
  if (generated) console.log("Temporary password:", password);
  console.log("You'll be required to set a new password right after logging in.\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
