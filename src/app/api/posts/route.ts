import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderCanvasToPng, renderPostcardToPng, type StrokePoint } from "@/lib/image";
import { sendLetterArrivedEmail } from "@/lib/email";
import { extractOcrFromImage } from "@/lib/ocr";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { validateCanvasPost, validateNativeCanvasPost } from "@/lib/validation";
import { rateLimitPostCreation } from "@/lib/rate-limit";
import { groupHashtagLiterals } from "@/lib/tags";
import { attachLetterToExchange } from "@/lib/exchange";
import { serializePost, serializePosts } from "@/lib/post-dto";
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
    OR: [{ deliverAt: null }, { deliverAt: { lte: new Date() } }],
    // Handwritten asks live on the Request Board, not in the feed
    requestAsk: null,
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
      _count: { select: { scratches: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const nextCursor =
    posts.length === limit ? posts[posts.length - 1].id : null;

  return NextResponse.json({ posts: serializePosts(posts), nextCursor });
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
    const body = await request.json();
    if (typeof body === "object" && body && "native_drawing_data_base64" in body) {
      return handleNativeCanvasPost(body as Record<string, unknown>, session);
    }
    return handleCanvasPost(body as Record<string, unknown>, session);
  } else if (contentType.includes("multipart/form-data")) {
    return handlePhotoPost(request, session);
  }

  return NextResponse.json(
    { error: "Invalid content type" },
    { status: 400 }
  );
}

// Postcards are a quicker format than a proper letter
const POSTCARD_MIN_DRAW_MS = 8_000;

async function handleCanvasPost(body: Record<string, unknown>, session: { userId: string; username: string }) {
  enforceNoTextInput(body);

  const format = body.format === "postcard" ? "postcard" : "letter";
  validateCanvasPost(body, format === "postcard" ? POSTCARD_MIN_DRAW_MS : undefined);

  const strokeData = body.canvas_stroke_data as StrokePoint[];
  const paper = (body.paper as string) || "blank";
  const inkStyle = (body.ink_style as string) || "standard";
  const previewOnly = body.preview_only === true;
  const envelopeData = body.envelope_data || null;
  const signatureData = body.signature_data || null;
  const recipientId = (body.recipient_id as string) || null;
  const isDeadLetter = body.is_dead_letter === true;
  const isPrivate = isTruthy(body.is_private) || !!recipientId || isDeadLetter;
  // Slow post: the letter travels overnight and arrives at 8 the next morning
  const slowPost = body.delivery === "slow" && !!recipientId;
  let deliverAt: Date | null = null;
  if (slowPost) {
    deliverAt = new Date();
    deliverAt.setDate(deliverAt.getDate() + 1);
    deliverAt.setHours(8, 0, 0, 0);
  }
  const requestOf = (body.request_of as string) || null;
  const fulfillsRequestId = (body.fulfills_request_id as string) || null;

  // Validate request-board linkage before creating anything
  if (requestOf) {
    if (requestOf === session.userId) {
      return NextResponse.json({ error: "You can't request a letter from yourself" }, { status: 400 });
    }
    const requestee = await prisma.user.findUnique({ where: { id: requestOf } });
    if (!requestee) {
      return NextResponse.json({ error: "Requestee not found" }, { status: 404 });
    }
  }

  let fulfillingRequest = null;
  if (fulfillsRequestId) {
    fulfillingRequest = await prisma.letterRequest.findUnique({ where: { id: fulfillsRequestId } });
    if (!fulfillingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }
    if (fulfillingRequest.requesteeId !== session.userId) {
      return NextResponse.json({ error: "This request was addressed to someone else" }, { status: 403 });
    }
    if (fulfillingRequest.status !== "open") {
      return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });
    }
  }

  // Render the letter (or postcard) to PNG
  const sharp = (await import("sharp")).default;
  const pngBuffer =
    format === "postcard"
      ? await renderPostcardToPng(strokeData, paper, inkStyle)
      : await renderCanvasToPng(strokeData, paper, inkStyle);

  if (previewOnly) {
    // Hand the rendered preview straight back as a data URL. The browser can't
    // reach MinIO directly (it's internal-only behind the tunnel), so an internal
    // storage URL renders as a broken image. The final send re-renders from the
    // strokes anyway, so there's nothing worth storing here.
    const compressedBuffer = await sharp(pngBuffer).png({ quality: 80 }).toBuffer();
    const dataUrl = `data:image/png;base64,${compressedBuffer.toString("base64")}`;
    return NextResponse.json({ imageUrl: dataUrl });
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
      recipientId: isDeadLetter ? undefined : recipientId || undefined,
      isPrivate: isPrivate,
      format,
      deliverAt: deliverAt || undefined,
      isDeadLetter,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  if (recipientId && !isDeadLetter) {
    await attachLetterToExchange(session.userId, recipientId, post.id);
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    if (recipient) {
      await sendLetterArrivedEmail(recipient.email, session.username, { slow: slowPost });
    }
  }

  // Pin the ask to the Request Board
  if (requestOf) {
    await prisma.letterRequest.create({
      data: {
        requesterId: session.userId,
        requesteeId: requestOf,
        requestPostId: post.id,
      },
    });
  }

  // Answer an open request; guard the status so two racing answers can't both win
  if (fulfillingRequest) {
    const updated = await prisma.letterRequest.updateMany({
      where: { id: fulfillingRequest.id, status: "open" },
      data: {
        fulfillmentPostId: post.id,
        status: "fulfilled",
        fulfilledAt: new Date(),
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "This request is no longer open" }, { status: 409 });
    }
  }

  // Reward the user with a collectible stamp for posting
  await giveStampReward(session.userId);

  return NextResponse.json({ post: serializePost(post) }, { status: 201 });
}

async function handleNativeCanvasPost(body: Record<string, unknown>, session: { userId: string; username: string }) {
  enforceNoTextInput(body);

  const format = body.format === "postcard" ? "postcard" : "letter";
  const { drawingData, renderedImageData } = validateNativeCanvasPost(
    body,
    format === "postcard" ? POSTCARD_MIN_DRAW_MS : undefined
  );

  const paper = (body.paper as string) || "blank";
  const inkStyle = (body.ink_style as string) || "standard";
  const envelopeData = body.envelope_data || null;
  const signatureData = body.signature_data || null;
  const recipientId = (body.recipient_id as string) || null;
  const isDeadLetter = body.is_dead_letter === true;
  const isPrivate = isTruthy(body.is_private) || !!recipientId || isDeadLetter;
  const slowPost = body.delivery === "slow" && !!recipientId;
  let deliverAt: Date | null = null;
  if (slowPost) {
    deliverAt = new Date();
    deliverAt.setDate(deliverAt.getDate() + 1);
    deliverAt.setHours(8, 0, 0, 0);
  }

  const drawingKey = `native-drawings/${uuidv4()}.pkdrawing`;
  const drawingDataUrl = await uploadBuffer(
    drawingKey,
    drawingData,
    "application/octet-stream"
  );

  const sharp = (await import("sharp")).default;
  const compressedBuffer = await sharp(renderedImageData).png({ quality: 85 }).toBuffer();
  const imageKey = `posts/${uuidv4()}.png`;
  const imageUrl = await uploadBuffer(imageKey, compressedBuffer, "image/png");

  const { text, hashtags } = await extractOcrFromImage(compressedBuffer);

  const post = await prisma.post.create({
    data: {
      userId: session.userId,
      postType: "canvas",
      canvasStrokeData: {
        format: "pencilkit-v1",
        source: "ios",
        drawingDataUrl,
        paper,
        inkStyle,
      },
      paperType: paper,
      inkStyle,
      finalImageUrl: imageUrl,
      envelopeData: envelopeData ? (envelopeData as object) : undefined,
      signatureData: signatureData ? (signatureData as object) : undefined,
      recipientId: isDeadLetter ? undefined : recipientId || undefined,
      isPrivate,
      format,
      deliverAt: deliverAt || undefined,
      isDeadLetter,
      ocrText: text,
      ocrHashtags: hashtags,
    },
    include: {
      user: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  if (recipientId && !isDeadLetter) {
    await attachLetterToExchange(session.userId, recipientId, post.id);
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    if (recipient) {
      await sendLetterArrivedEmail(recipient.email, session.username, { slow: slowPost });
    }
  }

  await giveStampReward(session.userId);

  return NextResponse.json({ post: serializePost(post) }, { status: 201 });
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
  const isPrivate = isTruthy(bodyObj.is_private) || !!recipientId;

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
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      select: { email: true },
    });
    if (recipient) {
      await sendLetterArrivedEmail(recipient.email, session.username);
    }
  }

  // Reward stamps for photo posts too
  await giveStampReward(session.userId);

  return NextResponse.json(
    {
      post: serializePost(post),
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

function isTruthy(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "on";
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
