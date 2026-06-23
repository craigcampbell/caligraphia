import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

// Validated lazily (not at module load) so `next build` can import routes;
// any real sign/verify in production with a missing secret still fails fast.
function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value !== devFallback) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `${name} must be set to a real secret in production (got ${value ? "the dev fallback" : "nothing"})`
    );
  }
  return value || devFallback;
}

const jwtSecret = () =>
  requireSecret("JWT_SECRET", "dev-secret-change-in-production");
const magicLinkSecret = () =>
  requireSecret("MAGIC_LINK_SECRET", "magic-link-dev-secret");
const SESSION_COOKIE = "croquis_session";
// 30 minutes: emails can take a few minutes to arrive and people don't always
// click right away. Short enough to stay a reasonable bearer-token window.
const MAGIC_LINK_EXPIRY = "30m";
const SESSION_EXPIRY = "7d";

export interface SessionPayload {
  userId: string;
  username: string;
  // Bumped on ban/unban to invalidate a user's existing sessions immediately.
  epoch?: number;
}

export interface MagicLinkPayload {
  email: string;
}

export function signMagicToken(email: string): string {
  return jwt.sign({ email }, magicLinkSecret(), { expiresIn: MAGIC_LINK_EXPIRY });
}

export function verifyMagicToken(token: string): MagicLinkPayload {
  return jwt.verify(token, magicLinkSecret(), { algorithms: ["HS256"] }) as MagicLinkPayload;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, jwtSecret(), { expiresIn: SESSION_EXPIRY });
}

export function verifySessionToken(token: string): SessionPayload {
  return jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as SessionPayload;
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = signSessionToken(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const payload = verifySessionToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) return null;
    // Banned users are locked out, and a session-epoch mismatch (set by a
    // ban/unban) invalidates older tokens. `?? 0` keeps pre-migration tokens
    // valid so a deploy doesn't log everyone out.
    if (user.bannedAt) return null;
    if ((payload.epoch ?? 0) !== user.sessionEpoch) return null;
    return { userId: user.id, username: user.username, epoch: user.sessionEpoch };
  } catch {
    return null;
  }
}

// Lightweight session state for the /banned page (status only, no secrets).
export async function getSessionState(): Promise<
  { status: "anon" } | { status: "banned"; banReason: string | null } | { status: "ok"; userId: string }
> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return { status: "anon" };
  try {
    const payload = verifySessionToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) return { status: "anon" };
    if (user.bannedAt) return { status: "banned", banReason: user.banReason };
    return { status: "ok", userId: user.id };
  } catch {
    return { status: "anon" };
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
