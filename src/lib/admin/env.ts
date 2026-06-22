// Admin secrets — validated at module import, with NO dev fallback (the lenient
// requireSecret in src/lib/auth.ts is never reused here). Fail fast and loud.

function requireAdminSecret(name: string, minBytes = 32): string {
  const v = process.env[name];
  if (!v || Buffer.byteLength(v, "utf8") < minBytes) {
    throw new Error(`${name} must be set and at least ${minBytes} bytes`);
  }
  return v;
}

export const ADMIN_JWT_SECRET = requireAdminSecret("ADMIN_JWT_SECRET");
// 32 raw bytes, base64-encoded => 44 chars.
export const ADMIN_TOTP_ENC_KEY_B64 = requireAdminSecret("ADMIN_TOTP_ENC_KEY", 44);

if (ADMIN_JWT_SECRET === process.env.JWT_SECRET) {
  throw new Error("ADMIN_JWT_SECRET must differ from JWT_SECRET");
}
