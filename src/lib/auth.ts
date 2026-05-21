import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const MAGIC_LINK_SECRET =
  process.env.MAGIC_LINK_SECRET || "magic-link-dev-secret";
const SESSION_COOKIE = "caligraphia_session";
const MAGIC_LINK_EXPIRY = "10m";
const SESSION_EXPIRY = "7d";

export interface SessionPayload {
  userId: string;
  username: string;
}

export interface MagicLinkPayload {
  email: string;
}

export function signMagicToken(email: string): string {
  return jwt.sign({ email }, MAGIC_LINK_SECRET, { expiresIn: MAGIC_LINK_EXPIRY });
}

export function verifyMagicToken(token: string): MagicLinkPayload {
  return jwt.verify(token, MAGIC_LINK_SECRET) as MagicLinkPayload;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_EXPIRY });
}

export function verifySessionToken(token: string): SessionPayload {
  return jwt.verify(token, JWT_SECRET) as SessionPayload;
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
    return { userId: user.id, username: user.username };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
