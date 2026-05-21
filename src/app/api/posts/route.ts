import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer, getPublicUrl } from "@/lib/storage";
import { renderCanvasToPng, type StrokePoint } from "@/lib/image";
import { extractOcrFromImage } from "@/lib/ocr";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { validateCanvasPost } from "@/lib/validation";
import { rateLimitPostCreation } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const groupId = searchParams.get("groupId");
  const userId = searchParams.get("userId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (userId) {
    where.userId = userId;
  }

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (group) {
      const posts = await prisma.post.findMany({
        where: {
          deletedAt: null,
          ocrHashtags: { hasSome: [] },
        },
        include: {
          user: { select: { id: true, username: true, nomDePlume: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      let pattern: RegExp;
      try {
        pattern = new RegExp(group.tagPattern, "i");
      } catch {
        pattern = new RegExp(".*", "i");
      }

      const filtered = posts.filter(
        (p) => p.ocrHashtags.some((h) => pattern.test(h))
      );

      const nextCursor =
        filtered.length === limit ? filtered[filtered.length - 1].id : null;
      return NextResponse.json({ posts: filtered, nextCursor });
    }
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
      _count: {
        select: {
          interactions: { where: { interactionType: "like" } },
          scratches: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].id : null;

  const enriched = await Promise.all(
    posts.map(async (post) => {
      const dislikes = await prisma.postInteraction.count({
        where: { postId: post.id, interactionType: "dislike" },
      });
      return { ...post, dislikeCount: dislikes };
    })
  );

  return NextResponse.json({ posts: enriched, nextCursor });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimitPostCreation(session.userId);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.retryAfter}s` },
      { status: 429 }
    );
  }

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return handleCanvasPost(request, session);
  } else if (contentType.includes("multipart/form-data")) {
    return handlePhotoPost(request, session);
  }

  return NextResponse.json(
    { error: "Invalid content type" },
    { status: 400 }
  );
}

async function handleCanvasPost(request: Request, session: { userId: string; username: string }) {
  const body = await request.json();
  enforceNoTextInput(body);
  validateCanvasPost(body);

  const strokeData = body.canvas_stroke_data as StrokePoint[];

  const sharp = (await import("sharp")).default;
  const pngBuffer = await renderCanvasToPng(strokeData);
  const compressedBuffer = await sharp(pngBuffer).png({ quality: 85 }).toBuffer();

  const imageKey = `posts/${uuidv4()}.png`;
  const imageUrl = await uploadBuffer(imageKey, compressedBuffer, "image/png");

  const { text, hashtags } = await extractOcrFromImage(pngBuffer);

  const post = await prisma.post.create({
    data: {
      userId: session.userId,
      postType: "canvas",
      canvasStrokeData: strokeData as unknown as object,
      finalImageUrl: imageUrl,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}

async function handlePhotoPost(request: Request, session: { userId: string; username: string }) {
  const formData = await request.formData();
  const photoFile = formData.get("photo") as File | null;

  const bodyObj: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") bodyObj[key] = value;
  });
  enforceNoTextInput(bodyObj);

  if (!photoFile || photoFile.size === 0) {
    return NextResponse.json({ error: "Photo is required" }, { status: 400 });
  }

  const arrayBuffer = await photoFile.arrayBuffer();
  const photoBuffer = Buffer.from(arrayBuffer);

  const ext = photoFile.name.split(".").pop() || "jpg";
  const photoKey = `photos/${uuidv4()}.${ext}`;
  const photoUrl = await uploadBuffer(
    photoKey,
    photoBuffer,
    photoFile.type || "image/jpeg"
  );

  const { text, hashtags } = await extractOcrFromImage(photoBuffer);

  const post = await prisma.post.create({
    data: {
      userId: session.userId,
      postType: "photo",
      uploadedPhotoUrl: photoUrl,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  return NextResponse.json({ post }, { status: 201 });
}
