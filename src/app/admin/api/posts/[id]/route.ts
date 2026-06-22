import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Admin view of a single post — bypasses canViewPost (oversight), includes
// deleted/private state and the author.
export const GET = withAdmin(async (_req, { params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      postType: true,
      format: true,
      paperType: true,
      inkStyle: true,
      pageCount: true,
      recipientId: true,
      isPrivate: true,
      isDeadLetter: true,
      needsReview: true,
      deliverAt: true,
      ocrText: true,
      createdAt: true,
      deletedAt: true,
      finalImageUrl: true,
      uploadedPhotoUrl: true,
      user: { select: { id: true, username: true, nomDePlume: true, bannedAt: true } },
      _count: { select: { reports: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Don't leak storage keys to the client; expose only whether media exists.
  const { finalImageUrl, uploadedPhotoUrl, ...rest } = post;
  return NextResponse.json({
    ...rest,
    hasImage: Boolean(finalImageUrl || uploadedPhotoUrl),
  });
});

// Soft-delete a post (hides it everywhere via canViewPost). Reversible.
export const DELETE = withAdmin(async (req, { admin, params }) => {
  const id = params.id;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { reason?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }
  const reason =
    typeof body.reason === "string" ? body.reason.slice(0, 500).trim() || null : null;

  const post = await prisma.post.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.deletedAt) return NextResponse.json({ ok: true, already: true });

  await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit(admin.id, "post_delete", {
    targetType: "post",
    targetId: id,
    detail: reason ? { reason } : undefined,
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true });
});
