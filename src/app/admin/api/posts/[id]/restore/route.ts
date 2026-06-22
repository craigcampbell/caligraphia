import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Undo a soft-delete.
export const POST = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!post.deletedAt) return NextResponse.json({ ok: true, already: true });

  await prisma.post.update({ where: { id }, data: { deletedAt: null } });
  await writeAudit(admin.id, "post_restore", {
    targetType: "post",
    targetId: id,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
