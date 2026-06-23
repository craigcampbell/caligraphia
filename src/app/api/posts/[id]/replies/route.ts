import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import {
  renderCanvasToPng,
  renderReplyOnSheet,
  type StrokePoint,
} from "@/lib/image";
import { validateCanvasPost } from "@/lib/validation";
import { canViewPost } from "@/lib/post-access";
import { serializePost } from "@/lib/post-dto";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// Minimum ink time for a reply — lower than a full letter, since a write-back can
// be a quick annotation.
const REPLY_MIN_DRAW_MS = 1500;

// List the write-backs (replies) on a letter, newest first.
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parent = await prisma.post.findUnique({ where: { id: params.id } });
  if (!parent || !canViewPost(parent, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const replies = await loadReplies(params.id, session.userId);
  return NextResponse.json({ replies });
}

// Write back to a letter: either on the original sheet (annotated) or on a fresh
// threaded page. Both create a child Post linked by a Reply row.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const mode = body.mode === "on_sheet" ? "on_sheet" : "fresh";

  try {
    validateCanvasPost(body, REPLY_MIN_DRAW_MS);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid drawing" },
      { status: 400 }
    );
  }

  const parent = await prisma.post.findUnique({ where: { id: params.id } });
  if (!parent || parent.deletedAt || !canViewPost(parent, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const strokes = body.canvas_stroke_data as StrokePoint[];
  const paper = typeof body.paper === "string" ? body.paper : "blank";
  const inkStyle = typeof body.ink_style === "string" ? body.ink_style : "standard";

  const baseImageUrl = parent.finalImageUrl || parent.uploadedPhotoUrl;
  if (mode === "on_sheet" && !baseImageUrl) {
    return NextResponse.json(
      { error: "This letter has no page to write on." },
      { status: 400 }
    );
  }

  const sharp = (await import("sharp")).default;
  const png =
    mode === "on_sheet" && baseImageUrl
      ? await renderReplyOnSheet(baseImageUrl, strokes, inkStyle)
      : await renderCanvasToPng(strokes, paper, inkStyle);
  const compressed = await sharp(png).png({ quality: 85 }).toBuffer();
  const imageUrl = await uploadBuffer(`replies/${uuidv4()}.png`, compressed, "image/png");

  // Privacy inheritance: a write-back to a private correspondence stays private
  // between the two people; a write-back to a public letter is part of the public
  // thread.
  const parentIsPrivate =
    parent.isPrivate || parent.recipientId != null || parent.isDeadLetter;
  let childRecipientId: string | undefined;
  let childPrivate = false;
  if (parentIsPrivate) {
    childPrivate = true;
    const other = parent.userId === session.userId ? parent.recipientId : parent.userId;
    childRecipientId = other ?? undefined;
  }

  const { childPost } = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        userId: session.userId,
        postType: "canvas",
        canvasStrokeData: strokes as unknown as object,
        paperType: mode === "on_sheet" ? "onsheet" : paper,
        inkStyle,
        finalImageUrl: imageUrl,
        pageCount: 1,
        recipientId: childRecipientId,
        isPrivate: childPrivate,
        format: "letter",
      },
      include: { user: { select: { id: true, username: true, nomDePlume: true } } },
    });
    await tx.reply.create({
      data: {
        parentPostId: parent.id,
        childPostId: created.id,
        onSheet: mode === "on_sheet",
      },
    });
    return { childPost: created };
  });

  return NextResponse.json(
    { reply: { id: childPost.id, onSheet: mode === "on_sheet", childPost: serializePost(childPost) } },
    { status: 201 }
  );
}

// Shared loader: direct replies whose child post the viewer is allowed to see.
async function loadReplies(parentId: string, viewerId: string) {
  const rows = await prisma.reply.findMany({
    where: { parentPostId: parentId },
    orderBy: { createdAt: "asc" },
    include: {
      childPost: {
        include: { user: { select: { id: true, username: true, nomDePlume: true } } },
      },
    },
  });
  return rows
    .filter((r) => r.childPost && canViewPost(r.childPost, viewerId))
    .map((r) => ({
      id: r.id,
      onSheet: r.onSheet,
      createdAt: r.createdAt.toISOString(),
      childPost: serializePost(r.childPost),
    }));
}
