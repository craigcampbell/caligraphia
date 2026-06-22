import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderCanvasToPng, renderPostcardToPng, type StrokePoint } from "@/lib/image";
import { sendLetterArrivedEmail } from "@/lib/email";
import { extractOcrFromImage } from "@/lib/ocr";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { validateCanvasPost, validateNativeCanvasPost, validateMultiPageCanvasPost } from "@/lib/validation";
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
    try {
      if (typeof body === "object" && body && "native_drawing_data_base64" in body) {
        return await handleNativeCanvasPost(body as Record<string, unknown>, session);
      }
      return await handleCanvasPost(body as Record<string, unknown>, session);
    } catch (err) {
      // Validation failures (bad/blank pages, too many pages, text input, etc.)
      // surface as a clean 400 with the reason instead of an empty 500.
      const message = err instanceof Error ? err.message : "Could not save this letter";
      console.error("Post creation failed:", message);
      return NextResponse.json({ error: message }, { status: 400 });
    }
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
  const previewOnly = body.preview_only === true;

  // The envelope preview only shows the cover (page 0). Render just that and
  // skip the full multi-page validation — a 2-page letter's content can be
  // spread across pages, so page 0 alone need not clear the 15s total.
  if (previewOnly) {
    const p0 = Array.isArray(body.pages)
      ? (body.pages[0] as Record<string, unknown> | undefined)
      : body;
    const p0Strokes = p0?.canvas_stroke_data as StrokePoint[] | undefined;
    if (!Array.isArray(p0Strokes) || p0Strokes.length < 1) {
      return NextResponse.json({ error: "Nothing to preview yet" }, { status: 400 });
    }
    const p0Paper = (p0?.paper as string) || "blank";
    const p0Ink = (p0?.ink_style as string) || "standard";
    const sharpLib = (await import("sharp")).default;
    const png =
      format === "postcard"
        ? await renderPostcardToPng(p0Strokes, p0Paper, p0Ink)
        : await renderCanvasToPng(p0Strokes, p0Paper, p0Ink);
    const previewBuffer = await sharpLib(png)
      .resize({ width: 1000, withoutEnlargement: true })
      .png({ quality: 70 })
      .toBuffer();
    return NextResponse.json({ imageUrl: `data:image/png;base64,${previewBuffer.toString("base64")}` });
  }

  // Full submit: validate EVERY page server-side (authoritative — strips blank
  // tails, caps page count, re-checks per-page content). Page 0 is the cover.
  const pages = validateMultiPageCanvasPost(
    body,
    format === "postcard" ? POSTCARD_MIN_DRAW_MS : undefined
  );
  const page0 = pages[0];
  const strokeData = page0.strokes;
  const paper = page0.paper;
  const inkStyle = page0.inkStyle;
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

  const sharp = (await import("sharp")).default;

  // Page 0 (the cover): becomes post.finalImageUrl and the OCR source.
  const page0Png =
    format === "postcard"
      ? await renderPostcardToPng(strokeData, paper, inkStyle)
      : await renderCanvasToPng(strokeData, paper, inkStyle);
  const page0Compressed = await sharp(page0Png).png({ quality: 85 }).toBuffer();
  const imageUrl = await uploadBuffer(`posts/${uuidv4()}.png`, page0Compressed, "image/png");

  // Extra pages 1..N-1 (letters only; postcards are single-page). Render and
  // upload in parallel — each writes a distinct key, so this is safe.
  const extraPageUrls = await Promise.all(
    pages.slice(1).map(async (pg) => {
      const png = await renderCanvasToPng(pg.strokes, pg.paper, pg.inkStyle);
      const compressed = await sharp(png).png({ quality: 85 }).toBuffer();
      return uploadBuffer(`post-pages/${uuidv4()}.png`, compressed, "image/png");
    })
  );

  // OCR the cover only (Tesseract is the slow step; tags live on page 1).
  const { text, hashtags } = await extractOcrFromImage(page0Png);

  // Create the post and its extra pages atomically.
  const post = await prisma.$transaction(async (tx) => {
    const created = await tx.post.create({
      data: {
        userId: session.userId,
        postType: "canvas",
        canvasStrokeData: strokeData as unknown as object,
        paperType: paper,
        inkStyle: inkStyle,
        finalImageUrl: imageUrl,
        pageCount: pages.length,
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
    for (let i = 0; i < extraPageUrls.length; i++) {
      await tx.postPage.create({
        data: {
          postId: created.id,
          position: i + 1,
          strokeData: pages[i + 1].strokes as unknown as object,
          inkStyle: pages[i + 1].inkStyle,
          paperType: pages[i + 1].paper,
          imageUrl: extraPageUrls[i],
        },
      });
    }
    return created;
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
