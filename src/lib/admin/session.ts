// Admin JWT + cookies. Algorithm is pinned and tokens carry an explicit, mutually
// exclusive `typ` plus aud/iss so a token minted for one stage can't be replayed
// at another, and a user-session token can never be confused for an admin one.
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { ADMIN_JWT_SECRET } from "./env";

export const ADMIN_COOKIE = "calig_admin";
export const CSRF_COOKIE = "calig_admin_csrf";
// Scopes the cookies to /admin and /admin/* (RFC 6265 boundary check keeps it
// off /admin-anything-else) without the trailing-slash gap that would skip the
// /admin dashboard itself.
export const ADMIN_PATH = "/admin";

// All admin JWTs are short-lived (5 min); the DB AdminSession carries the real
// 1h-idle / 2h-absolute lifetime.
export const ADMIN_TOKEN_TTL = 300;

export type AdminTyp = "session" | "totp_pending" | "enroll" | "must_change_pw";
export interface AdminJwt {
  sub: string;
  sid?: string;
  typ: AdminTyp;
}

const AUD = "calig-admin";
const ISS = "caligraphia";

export function signAdmin(payload: AdminJwt, ttlSeconds: number): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, {
    algorithm: "HS256",
    audience: AUD,
    issuer: ISS,
    expiresIn: ttlSeconds,
  });
}

export function verifyAdmin(token: string): AdminJwt {
  return jwt.verify(token, ADMIN_JWT_SECRET, {
    algorithms: ["HS256"],
    audience: AUD,
    issuer: ISS,
  }) as AdminJwt;
}

const secure = process.env.NODE_ENV === "production";
const COOKIE_MAX_AGE = 2 * 60 * 60; // 2h absolute cap

export async function setAdminCookie(token: string): Promise<void> {
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: ADMIN_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function setCsrfCookie(secret: string): Promise<void> {
  // Readable by JS so the admin client can mirror it into the x-admin-csrf header.
  (await cookies()).set(CSRF_COOKIE, secret, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: ADMIN_PATH,
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookies(): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, "", { httpOnly: true, secure, sameSite: "strict", path: ADMIN_PATH, maxAge: 0 });
  store.set(CSRF_COOKIE, "", { httpOnly: false, secure, sameSite: "strict", path: ADMIN_PATH, maxAge: 0 });
}

export async function getAdminCookie(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_COOKIE)?.value;
}
