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
    // Only show public posts in the main feed
    isPrivate: false,
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
  const paper = (body.paper as string) || "blank";
  const inkStyle = (body.ink_style as string) || "standard";
  const previewOnly = body.preview_only === true;
  const envelopeData = body.envelope_data || null;
  const signatureData = body.signature_data || null;
  const recipientId = body.recipient_id || null;
  const isPrivate = body.is_private === true;

  // Render the letter to PNG
  const sharp = (await import("sharp")).default;
  const pngBuffer = await renderCanvasToPng(strokeData, paper, inkStyle);

  if (previewOnly) {
    // For preview: save as a temp image, return URL but don't create DB record
    const imageKey = `previews/${uuidv4()}.png`;
    const compressedBuffer = await sharp(pngBuffer).png({ quality: 80 }).toBuffer();
    const imageUrl = await uploadBuffer(imageKey, compressedBuffer, "image/png");
    return NextResponse.json({ imageUrl });
  }

  // Full post: compress and store the final image
  const compressedBuffer = await sharp(pngBuffer).png({ quality: 85 }).toBuffer();
  const imageKey = `posts/${uuidv4()}.png`;
  const imageUrl = await uploadBuffer(imageKey, compressedBuffer, "image/png");

  // Run OCR
  const { text, hashtags } = await extractOcrFromImage(pngBuffer);

  // Create the post
  const post = await prisma.post.create({
    data: {
      userId: session.userId,
      postType: "canvas",
      canvasStrokeData: strokeData as unknown as object,
      paperType: paper,
      inkStyle: inkStyle,
      finalImageUrl: imageUrl,
      envelopeData: envelopeData ? (envelopeData as unknown as object) : undefined,
      signatureData: signatureData ? (signatureData as unknown as object) : undefined,
      recipientId: recipientId || undefined,
      isPrivate: isPrivate,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  // Reward the user with stamps for posting
  await giveStampReward(session.userId, post.id);

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

  const recipientId = bodyObj.recipient_id as string || null;
  const isPrivate = bodyObj.is_private === true || !!recipientId;

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
      recipientId: recipientId || undefined,
      isPrivate: isPrivate,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  // Reward stamps for photo posts too
  await giveStampReward(session.userId, post.id);

  return NextResponse.json({ post }, { status: 201 });
}

// Reward a user with stamps for creating a post
async function giveStampReward(userId: string, postId: string) {
  // Generate or find a default common stamp design
  let design = await prisma.stampDesign.findFirst({
    where: { tier: "Common", name: "Standard Postage" },
  });

  if (!design) {
    design = await prisma.stampDesign.create({
      data: {
        name: "Standard Postage",
        imageUrl: "/stamps/common.png",
        tier: "Common",
        totalMinted: 999999,
        currentlyMinted: 0,
      },
    });
  }

  // Create the stamp
  const currentCount = await prisma.stamp.count();
  await prisma.stamp.create({
    data: {
      ownerId: userId,
      designId: design.id,
      tier: "Common",
      issueNumber: currentCount + 1,
      series: "Standard Issue",
    },
  });

  // Update user's stamp balance
  await prisma.user.update({
    where: { id: userId },
    data: {
      stampBalance: { increment: 1 },
      totalStampsEarned: { increment: 1 },
    },
  });

  // Update design mint count
  await prisma.stampDesign.update({
    where: { id: design.id },
    data: { currentlyMinted: { increment: 1 } },
  });
}
