import { NextResponse } from "next/server";
import type { ReportReason } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewPost } from "@/lib/post-access";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const UUID = /^[0-9a-f-]{36}$/i;
const REASONS = new Set(["slop", "automated", "hateful", "harassment", "spam", "other"]);
// Strip C0 controls + DEL without embedding raw control bytes in source.
const CONTROL = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

// A signed-in user reports a post or another user. Validation is strictly bound
// to targetType and returns a uniform 404 (no existence oracle for posts the
// reporter can't see). The note is text-exempt but capped + control-stripped.
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = rateLimit(`report:${session.userId}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many reports. Try again in ${rl.retryAfter}s` }, { status: 429 });
  }

  let body: { targetType?: unknown; targetId?: unknown; reason?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const targetType = body.targetType;
  const targetId = typeof body.targetId === "string" ? body.targetId : "";
  const reason = typeof body.reason === "string" ? body.reason : "";
  let note: string | null = typeof body.note === "string" ? body.note : null;

  if ((targetType !== "post" && targetType !== "user") || !UUID.test(targetId) || !REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  if (note) {
    note = note.replace(CONTROL, "").slice(0, 240).trim();
    if (!note) note = null;
  }

  let postId: string | undefined;
  if (targetType === "post") {
    const post = await prisma.post.findUnique({ where: { id: targetId } });
    if (!post || !canViewPost(post, session.userId)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (post.userId === session.userId) {
      return NextResponse.json({ error: "You can't report your own letter" }, { status: 400 });
    }
    postId = post.id;
  } else {
    const user = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.id === session.userId) {
      return NextResponse.json({ error: "You can't report yourself" }, { status: 400 });
    }
  }

  // One open report per (reporter, target) — quietly succeed on a duplicate.
  const dupe = await prisma.report.findFirst({
    where: { reporterId: session.userId, targetType, targetId, status: "open" },
    select: { id: true },
  });
  if (dupe) return NextResponse.json({ ok: true, already: true });

  await prisma.report.create({
    data: {
      reporterId: session.userId,
      targetType,
      targetId,
      postId,
      reason: reason as ReportReason,
      note: note ?? undefined,
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
