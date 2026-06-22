import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

// One-click DB maintenance. The table MUST come from this fixed allowlist — it is
// the only thing interpolated into the (un-parameterizable) DDL, so the allowlist
// IS the injection boundary. No "all tables" option: every run names one table.
const ALLOWED_TABLES = new Set([
  "users",
  "user_follows",
  "posts",
  "post_pages",
  "post_interactions",
  "scratches",
  "replies",
  "comments",
  "marginalia",
  "flags",
  "stamps",
  "guestbook_entries",
  "letter_requests",
  "invites",
  "reports",
  "warnings",
  "admin_audit",
  "admin_sessions",
]);
const OPS = new Set(["vacuum", "analyze", "reindex"]);

export const POST = withAdmin(async (req, { admin }) => {
  let body: { op?: unknown; table?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const op = typeof body.op === "string" ? body.op : "";
  const table = typeof body.table === "string" ? body.table : "";
  if (!OPS.has(op)) return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
  if (!ALLOWED_TABLES.has(table)) {
    return NextResponse.json({ error: "Unknown table" }, { status: 400 });
  }

  // table is allowlisted above; quote it as an identifier.
  const ident = `"${table}"`;
  let sql: string;
  if (op === "vacuum") sql = `VACUUM (ANALYZE) ${ident}`;
  else if (op === "analyze") sql = `ANALYZE ${ident}`;
  else sql = `REINDEX TABLE ${ident}`;

  const startedAt = Date.now();
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (e) {
    console.error("maintenance failed:", e);
    return NextResponse.json({ error: "Maintenance command failed" }, { status: 500 });
  }
  const ms = Date.now() - startedAt;

  await writeAudit(admin.id, "db_maintenance", {
    targetType: "table",
    targetId: table,
    detail: { op, ms },
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true, op, table, ms });
});
