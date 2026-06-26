import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer, deleteObject } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024; // ~6MB
const MAX_DURATION_MS = 95_000;

// Attach a self-recorded voice postscript to your own letter (record-only — no
// uploaded music, to stay clear of copyright).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, deletedAt: true } });
  if (!post || post.deletedAt || post.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  const durationMs = Math.min(Math.max(Number(form.get("duration_ms")) || 0, 0), MAX_DURATION_MS);

  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "No recording" }, { status: 400 });
  }
  if (!audio.type.startsWith("audio/")) {
    return NextResponse.json({ error: "That isn't audio" }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: "That recording is too long." }, { status: 400 });
  }

  const buf = Buffer.from(await audio.arrayBuffer());
  const ext = audio.type.includes("mp4") || audio.type.includes("m4a")
    ? "m4a"
    : audio.type.includes("ogg")
      ? "ogg"
      : audio.type.includes("mpeg")
        ? "mp3"
        : "webm";
  const url = await uploadBuffer(`voice/${uuidv4()}.${ext}`, buf, audio.type || "audio/webm");

  await prisma.post.update({
    where: { id },
    data: { voiceUrl: url, voiceDurationMs: durationMs || null },
  });
  return NextResponse.json({ ok: true });
}

// Remove your voice postscript.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const post = await prisma.post.findUnique({ where: { id }, select: { userId: true, voiceUrl: true } });
  if (!post || post.userId !== session.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (post.voiceUrl) {
    try {
      await deleteObject(post.voiceUrl);
    } catch {
      /* best effort */
    }
  }
  await prisma.post.update({ where: { id }, data: { voiceUrl: null, voiceDurationMs: null } });
  return NextResponse.json({ ok: true });
}
