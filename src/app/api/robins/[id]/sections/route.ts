import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import {
  renderRobinSectionToPng,
  cropRobinPeek,
  compositeRobin,
  type StrokePoint,
} from "@/lib/image";
import { extractOcrFromImage } from "@/lib/ocr";
import { validateCanvasPost } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

const SECTION_MIN_DRAW_MS = 8_000;

// Add the next band to an open robin; the final hand publishes the whole letter
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`robin:${session.userId}`, 3, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.retryAfter}s` },
      { status: 429 }
    );
  }

  const robin = await prisma.roundRobin.findUnique({
    where: { id: params.id },
    include: { sections: { orderBy: { position: "asc" } } },
  });
  if (!robin) {
    return NextResponse.json({ error: "Robin not found" }, { status: 404 });
  }
  if (robin.status !== "open" || robin.sections.length >= robin.size) {
    return NextResponse.json({ error: "This letter is already complete" }, { status: 409 });
  }
  if (robin.sections.some((s) => s.userId === session.userId)) {
    return NextResponse.json(
      { error: "You've already written a part of this letter" },
      { status: 409 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    validateCanvasPost(body, SECTION_MIN_DRAW_MS);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid section" },
      { status: 400 }
    );
  }

  const strokeData = body.canvas_stroke_data as StrokePoint[];
  const inkStyle = (body.ink_style as string) || "standard";
  const position = robin.sections.length;

  const png = await renderRobinSectionToPng(strokeData, inkStyle);
  const peek = await cropRobinPeek(png);
  const key = uuidv4();
  const [imageUrl, peekUrl] = await Promise.all([
    uploadBuffer(`robins/${key}-${position}.png`, png, "image/png"),
    uploadBuffer(`robins/${key}-${position}-peek.png`, peek, "image/png"),
  ]);

  try {
    await prisma.roundRobinSection.create({
      data: {
        robinId: robin.id,
        userId: session.userId,
        position,
        strokeData: strokeData as unknown as object,
        inkStyle,
        imageUrl,
        peekUrl,
      },
    });
  } catch {
    // Unique (robinId, position) lost to a concurrent writer
    return NextResponse.json(
      { error: "Someone else just added their part. Try another letter." },
      { status: 409 }
    );
  }

  // Last hand: stitch the bands together and publish
  if (position + 1 >= robin.size) {
    const sections = await prisma.roundRobinSection.findMany({
      where: { robinId: robin.id },
      orderBy: { position: "asc" },
    });
    const buffers = await Promise.all(
      sections.map(async (s) => {
        const res = await fetch(s.imageUrl);
        return Buffer.from(await res.arrayBuffer());
      })
    );
    const finalPng = await compositeRobin(buffers);
    const finalUrl = await uploadBuffer(`robins/${key}-final.png`, finalPng, "image/png");
    const { text, hashtags } = await extractOcrFromImage(finalPng);

    const finalPost = await prisma.post.create({
      data: {
        userId: sections[0].userId, // credited to whoever started the chain
        postType: "canvas",
        finalImageUrl: finalUrl,
        isPrivate: false,
        ocrText: text,
        ocrHashtags: hashtags,
      },
    });
    await prisma.roundRobin.update({
      where: { id: robin.id },
      data: { status: "done", finalPostId: finalPost.id, finishedAt: new Date() },
    });
    return NextResponse.json({ done: true, postId: finalPost.id }, { status: 201 });
  }

  return NextResponse.json({ done: false }, { status: 201 });
}
