// Create the first admin. Usage:
//   docker compose -f docker-compose.tunnel.yml exec app npm run admin:create -- <username>
// Set ADMIN_PASSWORD to choose your own (>=16 chars), otherwise one is generated.
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/admin/password";

const prisma = new PrismaClient();

async function main() {
  const username = (process.argv[2] || process.env.ADMIN_USERNAME || "").trim();
  if (!username) {
    console.error("Usage: npm run admin:create -- <username>   (or set ADMIN_USERNAME)");
    process.exit(1);
  }
  if (await prisma.adminUser.findUnique({ where: { username } })) {
    console.error(`Admin "${username}" already exists. Use admin:reset-pw or admin:reset-2fa.`);
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
  const enrollPlain = randomBytes(24).toString("base64url");
  const enrollToken = await hashPassword(enrollPlain);
  await prisma.adminUser.create({
    data: {
      username,
      passwordHash,
      enrollToken,
      enrollTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  console.log("\n========== Admin created ==========");
  console.log("Username:      ", username);
  if (generated) console.log("Password:      ", password, "   <-- SAVE THIS (shown once)");
  console.log("Enroll token:  ", enrollPlain, "   <-- needed at first login (valid 60 min)");
  console.log("\nNext: open /admin/login, enter username + password + enroll token,");
  console.log("then scan the QR into an authenticator app and save your recovery codes.\n");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
