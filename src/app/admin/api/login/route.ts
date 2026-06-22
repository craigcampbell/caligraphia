import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, KdfBusyError } from "@/lib/admin/password";
import { accountLockedUntil, recordFailure, resetFailures } from "@/lib/admin/throttle";
import { rateLimitAdminLogin } from "@/lib/rate-limit";
import { getClientIp, writeAudit, assertSameOrigin, AdminAuthError } from "@/lib/admin/guard";
import { issueTypedToken } from "@/lib/admin/login";

export const runtime = "nodejs";

// Stage 1: username + password. Issues a short-lived typed cookie for the next
// stage (TOTP, or first-time enrollment). DoS-gate order: in-memory IP filter →
// per-account lock → real password hash.
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const ip = getClientIp(req);
  if (!rateLimitAdminLogin(ip).allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  let body: { username?: unknown; password?: unknown; enrollToken?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const enrollToken = typeof body.enrollToken === "string" ? body.enrollToken : "";
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
  }

  try {
    const admin = await prisma.adminUser.findUnique({ where: { username } });
    if (!admin || !admin.isActive) {
      // Burn comparable time so a missing user isn't distinguishable by timing.
      await hashPassword(password).catch(() => {});
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (await accountLockedUntil(admin.id)) {
      return NextResponse.json({ error: "Account temporarily locked. Try again later." }, { status: 429 });
    }

    if (!(await verifyPassword(admin.passwordHash, password))) {
      await recordFailure(admin.id);
      await writeAudit(null, "login_failure", {
        targetType: "admin",
        targetId: admin.id,
        ip,
        userAgent: req.headers.get("user-agent") || undefined,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    await resetFailures(admin.id);

    // Not yet enrolled in 2FA → require the one-time CLI enrollment token.
    if (!admin.totpEnabledAt) {
      if (!admin.enrollToken || !admin.enrollTokenExpires || admin.enrollTokenExpires.getTime() < Date.now()) {
        return NextResponse.json(
          { error: "An enrollment token is required. Generate one with `npm run admin:reset-2fa`." },
          { status: 403 }
        );
      }
      if (!(await verifyPassword(admin.enrollToken, enrollToken))) {
        return NextResponse.json({ error: "Invalid enrollment token" }, { status: 403 });
      }
      await issueTypedToken(admin.id, "enroll");
      return NextResponse.json({ next: "enroll" });
    }

    await issueTypedToken(admin.id, "totp_pending");
    return NextResponse.json({ next: "totp" });
  } catch (e) {
    if (e instanceof KdfBusyError) {
      return NextResponse.json({ error: "Server busy, please retry." }, { status: 503, headers: { "Retry-After": "2" } });
    }
    console.error("admin login error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
