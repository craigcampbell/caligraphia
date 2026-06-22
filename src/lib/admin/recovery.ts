// One-time recovery codes. Each code carries a non-secret 4-char lookup prefix so
// login verifies exactly ONE argon2 candidate (no O(n) loop, no remaining-count
// timing oracle). Consumption is transactional on usedAt IS NULL.
import { randomInt } from "node:crypto";
import { prisma } from "../prisma";
import { hashPassword, verifyPassword } from "./password";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L ambiguity
const CODE_RE = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function randomCode(): string {
  const seg = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${seg()}-${seg()}-${seg()}`;
}

// Replace all of an admin's recovery codes with 10 fresh ones; return plaintext
// once (the caller shows them and never stores them).
export async function regenerateRecoveryCodes(adminUserId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, randomCode);
  await prisma.adminRecoveryCode.deleteMany({ where: { adminUserId } });
  for (const code of codes) {
    const codeHash = await hashPassword(code);
    await prisma.adminRecoveryCode.create({
      data: { adminUserId, lookupPrefix: code.slice(0, 4), codeHash },
    });
  }
  return codes;
}

// Verify + consume a recovery code. Returns true if it was valid and unused.
export async function consumeRecoveryCode(adminUserId: string, input: string): Promise<boolean> {
  const code = input.trim().toUpperCase();
  if (!CODE_RE.test(code)) return false;
  const row = await prisma.adminRecoveryCode.findFirst({
    where: { adminUserId, lookupPrefix: code.slice(0, 4), usedAt: null },
  });
  if (!row) return false;
  if (!(await verifyPassword(row.codeHash, code))) return false;
  const res = await prisma.adminRecoveryCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  return res.count === 1;
}
