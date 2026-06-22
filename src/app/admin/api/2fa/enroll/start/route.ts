import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, AdminAuthError } from "@/lib/admin/guard";
import { generateTotpSecret, totpUri, totpQrDataUrl } from "@/lib/admin/totp";
import { encryptSecret } from "@/lib/admin/crypto";

export const runtime = "nodejs";

// First-time TOTP enrollment: returns the otpauth URI + QR. Requires an "enroll"
// token (proven via the CLI enroll token at login).
export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireAdmin(req, { typ: "enroll" });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const admin = auth.admin;
  if (admin.totpEnabledAt) return NextResponse.json({ error: "Already enrolled" }, { status: 409 });

  const secret = generateTotpSecret();
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { pendingTotpSecret: encryptSecret(secret) },
  });
  const uri = totpUri(admin.username, secret);
  const qrDataUrl = await totpQrDataUrl(uri);
  return NextResponse.json({ uri, qrDataUrl }, { headers: { "Cache-Control": "no-store" } });
}
