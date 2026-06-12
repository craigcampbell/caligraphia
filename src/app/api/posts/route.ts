import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderCanvasToPng, type StrokePoint } from "@/lib/image";
import { extractOcrFromImage } from "@/lib/ocr";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { validateCanvasPost } from "@/lib/validation";
import { rateLimitPostCreation } from "@/lib/rate-limit";
import { groupHashtagLiterals } from "@/lib/tags";
import { attachLetterToExchange } from "@/lib/exchange";
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
    // Only show public, reviewed posts in the main feed
    isPrivate: false,
    needsReview: false,
  };

  if (userId) {
    where.userId = userId;
  }

  if (groupId) {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    where.ocrHashtags = { hasSome: groupHashtagLiterals(group.tagPattern) };
  }

  const posts = await prisma.post.findMany({
    where,
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
      _count: { select: { scratches: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].id : null;

  return NextResponse.json({ posts, nextCursor });
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

  if (recipientId) {
    await attachLetterToExchange(session.userId, recipientId, post.id);
  }

  // Reward the user with a collectible stamp for posting
  await giveStampReward(session.userId);

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

  // Light handwriting gate: a public photo that OCR can't find any writing in
  // gets held for review instead of landing in the feed. Private letters are
  // between sender and recipient, so they skip the gate.
  const letterChars = text.replace(/[^a-zA-Z]/g, "").length;
  const looksHandwritten = letterChars >= 10 || hashtags.length > 0;
  const needsReview = !isPrivate && !looksHandwritten;

  const post = await prisma.post.create({
    data: {
      userId: session.userId,
      postType: "photo",
      uploadedPhotoUrl: photoUrl,
      recipientId: recipientId || undefined,
      isPrivate: isPrivate,
      needsReview,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  if (recipientId) {
    await attachLetterToExchange(session.userId, recipientId, post.id);
  }

  // Reward stamps for photo posts too
  await giveStampReward(session.userId);

  return NextResponse.json(
    {
      post,
      ...(needsReview
        ? {
            notice:
              "We couldn't find handwriting in this photo, so it's held for review before appearing in the public feed.",
          }
        : {}),
    },
    { status: 201 }
  );
}

// Reward a user with a collectible stamp (and +1 spendable) for creating a post
async function giveStampReward(userId: string) {
  await prisma.$transaction(async (tx) => {
    let design = await tx.stampDesign.findFirst({
      where: { tier: "Common", name: "Standard Postage" },
    });

    if (!design) {
      design = await tx.stampDesign.create({
        data: {
          name: "Standard Postage",
          imageUrl: "/stamps/common.png",
          tier: "Common",
          totalMinted: 999999,
          currentlyMinted: 0,
        },
      });
    }

    const updatedDesign = await tx.stampDesign.update({
      where: { id: design.id },
      data: { currentlyMinted: { increment: 1 } },
    });

    await tx.stamp.create({
      data: {
        ownerId: userId,
        designId: design.id,
        tier: "Common",
        issueNumber: updatedDesign.currentlyMinted,
        series: "Standard Issue",
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        stampBalance: { increment: 1 },
        totalStampsEarned: { increment: 1 },
      },
    });
  });
}
