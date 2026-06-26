import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage";
import { withAdmin, writeAudit, getClientIp } from "@/lib/admin/guard";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;

// Hard-purge a post's stored imagery from object storage (irreversible) and
// soft-delete the post so the now-imageless row can't render. For genuinely
// offensive material that shouldn't merely be hidden.
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

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      finalImageUrl: true,
      uploadedPhotoUrl: true,
      backImageUrl: true,
      voiceUrl: true,
      pages: { select: { id: true, imageUrl: true } },
    },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const keys = [
    post.finalImageUrl,
    post.uploadedPhotoUrl,
    post.backImageUrl,
    post.voiceUrl,
    ...post.pages.map((p) => p.imageUrl),
  ].filter((k): k is string => Boolean(k));

  // Best-effort delete each object; missing objects are not an error.
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (e) {
      console.error("image purge: failed to delete object", key, e);
    }
  }

  await prisma.$transaction([
    prisma.postPage.deleteMany({ where: { postId: id } }),
    prisma.post.update({
      where: { id },
      data: {
        finalImageUrl: null,
        uploadedPhotoUrl: null,
        backImageUrl: null,
        voiceUrl: null,
        voiceDurationMs: null,
        canvasStrokeData: Prisma.DbNull,
        pageCount: 1,
        deletedAt: new Date(),
      },
    }),
  ]);

  await writeAudit(admin.id, "image_delete", {
    targetType: "post",
    targetId: id,
    detail: { purgedObjects: keys.length, reason: reason ?? undefined },
    ip: getClientIp(req),
  });
  return NextResponse.json({ ok: true, purged: keys.length });
});
