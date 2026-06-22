import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, writeAudit, getClientIp, AdminAuthError } from "@/lib/admin/guard";
import { verifyTotpStep } from "@/lib/admin/totp";
import { decryptSecret } from "@/lib/admin/crypto";
import { consumeRecoveryCode } from "@/lib/admin/recovery";
import { accountLockedUntil, recordFailure, resetFailures } from "@/lib/admin/throttle";
import { issueTypedToken, issueFullSession } from "@/lib/admin/login";

export const runtime = "nodejs";

// Stage 2: 6-digit TOTP, or a recovery code (explicit toggle). On success,
// mints the real session (or routes to a forced password change).
export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireAdmin(req, { typ: "totp_pending" });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const admin = auth.admin;
  const ip = getClientIp(req);

  let body: { code?: unknown; recovery?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  const useRecovery = body.recovery === true;

  try {
    if (await accountLockedUntil(admin.id)) {
      return NextResponse.json({ error: "Account temporarily locked. Try again later." }, { status: 429 });
    }

    let passed = false;
    if (useRecovery) {
      passed = await consumeRecoveryCode(admin.id, code);
      if (passed) await writeAudit(admin.id, "admin_recovery_used", { ip });
    } else if (admin.totpSecret) {
      const step = verifyTotpStep(code, decryptSecret(admin.totpSecret));
      if (step !== null && (admin.lastTotpStep === null || step > admin.lastTotpStep)) {
        passed = true;
        await prisma.adminUser.update({ where: { id: admin.id }, data: { lastTotpStep: step } });
      }
    }

    if (!passed) {
      await recordFailure(admin.id);
      await writeAudit(null, "login_failure", { targetType: "admin", targetId: admin.id, ip });
      return NextResponse.json({ error: "Invalid code" }, { status: 401 });
    }

    await resetFailures(admin.id);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    if (admin.mustChangePassword) {
      await issueTypedToken(admin.id, "must_change_pw");
      await writeAudit(admin.id, "login_success", { ip });
      return NextResponse.json({ next: "change_password" });
    }

    await issueFullSession(admin.id, req);
    await writeAudit(admin.id, "login_success", { ip });
    return NextResponse.json({ ok: true, next: "/admin" });
  } catch (e) {
    console.error("admin totp error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
