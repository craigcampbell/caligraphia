// Helpers for issuing the staged admin tokens and the final session.
import { signAdmin, setAdminCookie, setCsrfCookie, ADMIN_TOKEN_TTL } from "./session";
import { createAdminSession } from "./guard";

export async function issueTypedToken(
  adminId: string,
  typ: "totp_pending" | "enroll" | "must_change_pw"
): Promise<void> {
  await setAdminCookie(signAdmin({ sub: adminId, typ }, ADMIN_TOKEN_TTL));
}

export async function issueFullSession(adminId: string, req: Request) {
  const session = await createAdminSession(adminId, req);
  await setAdminCookie(signAdmin({ sub: adminId, sid: session.id, typ: "session" }, ADMIN_TOKEN_TTL));
  await setCsrfCookie(session.csrfSecret);
  return session;
}
