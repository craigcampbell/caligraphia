// Fail-closed admin authorization. Every admin route runs requireAdmin via the
// withAdmin() wrapper; the DB AdminSession is the source of truth on EVERY
// request (so a revoked session dies within one request), Origin is enforced on
// all methods, and mutations require the CSRF double-submit.
import { NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "node:crypto";
import type { AdminAuditAction, AdminUser, AdminSession } from "@prisma/client";
import { prisma } from "../prisma";
import {
  verifyAdmin,
  signAdmin,
  setAdminCookie,
  clearAdminCookies,
  getAdminCookie,
  type AdminTyp,
  type AdminJwt,
} from "./session";

const IDLE_MS = 60 * 60 * 1000; // 1h sliding idle cap

export class AdminAuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

// Best-effort only — used for the audit log, NEVER as a security control.
export function getClientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function assertSameOrigin(req: Request): void {
  const base = process.env.BASE_URL;
  if (!base) throw new AdminAuthError(403, "Server misconfigured");
  const host = new URL(base).host;
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!origin) throw new AdminAuthError(403, "Missing origin");
  let oHost: string;
  try {
    oHost = new URL(origin).host;
  } catch {
    throw new AdminAuthError(403, "Bad origin");
  }
  if (oHost !== host) throw new AdminAuthError(403, "Cross-origin request rejected");
}

async function revokeSession(sid: string): Promise<void> {
  await prisma.adminSession
    .update({ where: { id: sid }, data: { revokedAt: new Date() } })
    .catch(() => {});
}

export async function revokeAdminSession(sid: string): Promise<void> {
  await revokeSession(sid);
}

export async function revokeOtherAdminSessions(adminId: string, keepSid?: string): Promise<void> {
  await prisma.adminSession.updateMany({
    where: { adminUserId: adminId, revokedAt: null, ...(keepSid ? { id: { not: keepSid } } : {}) },
    data: { revokedAt: new Date() },
  });
}

// Create a fresh DB session (2h absolute cap, own CSRF secret).
export async function createAdminSession(adminId: string, req: Request) {
  return prisma.adminSession.create({
    data: {
      adminUserId: adminId,
      absoluteExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      csrfSecret: randomBytes(24).toString("base64url"),
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent") || undefined,
    },
  });
}

export interface AdminAuth {
  admin: AdminUser;
  session?: AdminSession;
  claims: AdminJwt;
}

// For ROUTE HANDLERS (can write cookies). Slides + re-mints the session.
export async function requireAdmin(req: Request, opts?: { typ?: AdminTyp }): Promise<AdminAuth> {
  const expectTyp = opts?.typ ?? "session";
  // Origin enforcement only matters for state-changing requests, and that's the
  // only place the browser reliably sends an Origin header. We can't lean on
  // Referer here because /admin sets Referrer-Policy: no-referrer (so GET fetches
  // carry neither Origin nor Referer). Cross-site auth is already impossible —
  // both admin cookies are SameSite=Strict — so skipping the check on reads is
  // safe; mutations still get Origin + the double-submit CSRF token below.
  const method = req.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") assertSameOrigin(req);

  const token = await getAdminCookie();
  if (!token) throw new AdminAuthError(401, "No session");
  let claims: AdminJwt;
  try {
    claims = verifyAdmin(token);
  } catch {
    throw new AdminAuthError(401, "Invalid session");
  }
  if (claims.typ !== expectTyp) throw new AdminAuthError(401, "Wrong token type");

  const admin = await prisma.adminUser.findUnique({ where: { id: claims.sub } });
  if (!admin || !admin.isActive) throw new AdminAuthError(403, "Account disabled");

  // Pre-session typed tokens (totp_pending / enroll / must_change_pw) carry no sid.
  if (expectTyp !== "session") {
    return { admin, claims };
  }
  if (!claims.sid) throw new AdminAuthError(401, "Incomplete session");

  const session = await prisma.adminSession.findUnique({ where: { id: claims.sid } });
  if (!session || session.revokedAt) throw new AdminAuthError(401, "Session revoked");

  const now = Date.now();
  if (now > session.absoluteExpiresAt.getTime()) {
    await revokeSession(session.id);
    throw new AdminAuthError(401, "Session expired");
  }
  if (now - session.lastActivityAt.getTime() > IDLE_MS) {
    await revokeSession(session.id);
    await clearAdminCookies();
    throw new AdminAuthError(401, "Session idle");
  }
  if (admin.mustChangePassword) throw new AdminAuthError(409, "Password change required");

  if (req.method !== "GET" && req.method !== "HEAD") {
    const hdr = req.headers.get("x-admin-csrf") ?? "";
    if (!safeEqual(hdr, session.csrfSecret)) throw new AdminAuthError(403, "CSRF check failed");
  }

  // Slide (throttled writes) + re-mint the rolling 5-min cookie.
  if (now - session.lastActivityAt.getTime() > 30_000) {
    await prisma.adminSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });
  }
  await setAdminCookie(signAdmin({ sub: admin.id, sid: session.id, typ: "session" }, 300));
  return { admin, session, claims };
}

// READ-ONLY variant for Server Components (the /admin layout gate). Server
// components can't write cookies, so this verifies without sliding/clearing.
export async function getAdminSession(): Promise<{ admin: AdminUser; session: AdminSession } | null> {
  try {
    const token = await getAdminCookie();
    if (!token) return null;
    const claims = verifyAdmin(token);
    if (claims.typ !== "session" || !claims.sid) return null;
    const session = await prisma.adminSession.findUnique({
      where: { id: claims.sid },
      include: { admin: true },
    });
    if (!session || session.revokedAt || !session.admin.isActive) return null;
    const now = Date.now();
    if (now > session.absoluteExpiresAt.getTime()) return null;
    if (now - session.lastActivityAt.getTime() > IDLE_MS) return null;
    const { admin, ...rest } = session;
    return { admin, session: rest as AdminSession };
  } catch {
    return null;
  }
}

const REDACT = /(email|password|hash|secret|token|code)/i;

export async function writeAudit(
  adminId: string | null,
  action: AdminAuditAction,
  opts?: {
    targetType?: string;
    targetId?: string;
    detail?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }
): Promise<void> {
  let detail = opts?.detail;
  if (detail) {
    detail = Object.fromEntries(Object.entries(detail).filter(([k]) => !REDACT.test(k)));
  }
  await prisma.adminAudit
    .create({
      data: {
        adminId: adminId ?? undefined,
        action,
        targetType: opts?.targetType,
        targetId: opts?.targetId,
        detail: detail ? JSON.parse(JSON.stringify(detail)) : undefined,
        ip: opts?.ip,
        userAgent: opts?.userAgent,
      },
    })
    .catch(() => {});
}

type RouteCtx = { params?: Promise<Record<string, string>> };
type AdminHandler = (
  req: Request,
  ctx: { admin: AdminUser; session?: AdminSession; params: Record<string, string> }
) => Promise<Response>;

// Wrap every admin route handler: enforce requireAdmin, then run the handler.
export function withAdmin(handler: AdminHandler) {
  return async (req: Request, route: RouteCtx = {}): Promise<Response> => {
    try {
      const auth = await requireAdmin(req);
      const params = route.params ? await route.params : {};
      return await handler(req, { admin: auth.admin, session: auth.session, params });
    } catch (e) {
      if (e instanceof AdminAuthError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error("Admin route error:", e);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
