import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderCommentToPng, type StrokePoint } from "@/lib/image";
import { validateCommentStrokes } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { canViewPost } from "@/lib/post-access";
import { serializeComment, serializeComments } from "@/lib/post-dto";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!canViewPost(post, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId: params.id, deletedAt: null },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments: serializeComments(comments) });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`comment:${session.userId}`, 4, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.retryAfter}s` },
      { status: 429 }
    );
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!canViewPost(post, session.userId)) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    validateCommentStrokes(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid comment" },
      { status: 400 }
    );
  }

  const strokeData = body.canvas_stroke_data as StrokePoint[];
  const inkStyle = (body.ink_style as string) || "standard";

  const pngBuffer = await renderCommentToPng(strokeData, inkStyle);
  const sharp = (await import("sharp")).default;
  const compressedBuffer = await sharp(pngBuffer).png({ quality: 80 }).toBuffer();
  const imageUrl = await uploadBuffer(
    `comments/${params.id}/${Date.now()}.png`,
    compressedBuffer,
    "image/png"
  );

  const comment = await prisma.comment.create({
    data: {
      postId: params.id,
      userId: session.userId,
      strokeData: strokeData as unknown as object,
      inkStyle,
      imageUrl,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 });
}
