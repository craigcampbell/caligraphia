import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit, getClientIp, AdminAuthError } from "@/lib/admin/guard";
import { verifyTotpStep } from "@/lib/admin/totp";
import { decryptSecret } from "@/lib/admin/crypto";
import { regenerateRecoveryCodes } from "@/lib/admin/recovery";
import { issueFullSession } from "@/lib/admin/login";

export const runtime = "nodejs";

// Confirm enrollment: verify a code against the pending secret, activate TOTP,
// burn the one-time enroll token, hand back the recovery codes once, log in.
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
  if (!admin.pendingTotpSecret) return NextResponse.json({ error: "Start enrollment first" }, { status: 400 });

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";

  const step = verifyTotpStep(code, decryptSecret(admin.pendingTotpSecret));
  if (step === null) return NextResponse.json({ error: "Invalid code" }, { status: 401 });

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: {
      totpSecret: admin.pendingTotpSecret,
      pendingTotpSecret: null,
      totpEnabledAt: new Date(),
      lastTotpStep: step,
      enrollToken: null,
      enrollTokenExpires: null,
      lastLoginAt: new Date(),
    },
  });
  const recoveryCodes = await regenerateRecoveryCodes(admin.id);
  await issueFullSession(admin.id, req);
  await writeAudit(admin.id, "admin_enroll_totp", { ip: getClientIp(req) });
  return NextResponse.json({ recoveryCodes, next: "/admin" }, { headers: { "Cache-Control": "no-store" } });
}
