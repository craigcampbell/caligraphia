// AES-256-GCM for encrypting the TOTP secret at rest. Format: iv:tag:ciphertext
// (all base64).
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ADMIN_TOTP_ENC_KEY_B64 } from "./env";

const KEY = Buffer.from(ADMIN_TOTP_ENC_KEY_B64, "base64");
if (KEY.length !== 32) {
  throw new Error("ADMIN_TOTP_ENC_KEY must decode to exactly 32 bytes");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(enc: string): string {
  const [ivB, tagB, ctB] = enc.split(":");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
