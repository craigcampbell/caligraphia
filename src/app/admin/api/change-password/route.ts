import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, revokeOtherAdminSessions, AdminAuthError } from "@/lib/admin/guard";
import { hashPassword } from "@/lib/admin/password";
import { issueFullSession } from "@/lib/admin/login";

export const runtime = "nodejs";

// Forced password change (after admin:reset-pw). The must_change_pw token can
// reach nothing else until this completes.
export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireAdmin(req, { typ: "must_change_pw" });
  } catch (e) {
    if (e instanceof AdminAuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const admin = auth.admin;

  let body: { newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 16) {
    return NextResponse.json({ error: "Password must be at least 16 characters" }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, mustChangePassword: false },
  });
  await revokeOtherAdminSessions(admin.id);
  await issueFullSession(admin.id, req);
  return NextResponse.json({ ok: true, next: "/admin" });
}
