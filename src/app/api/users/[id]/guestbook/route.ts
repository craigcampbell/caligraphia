import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderCommentToPng, type StrokePoint } from "@/lib/image";
import { validateCommentStrokes } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { serializeGuestbookEntries, serializeGuestbookEntry } from "@/lib/post-dto";

// Guestbook entries are the same medium as postscripts (handwritten strips),
// so both endpoints speak the same { comments } shape and share the UI.

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const entries = await prisma.guestbookEntry.findMany({
    where: { ownerId: params.id, deletedAt: null },
    include: {
      author: { select: { id: true, username: true, nomDePlume: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const comments = entries.map(({ author, ...entry }) => ({
    ...entry,
    user: author,
  }));

  return NextResponse.json({
    comments: serializeGuestbookEntries(comments),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (params.id === session.userId) {
    return NextResponse.json(
      { error: "You can't sign your own guestbook" },
      { status: 400 }
    );
  }

  const rl = rateLimit(`guestbook:${session.userId}`, 12, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${rl.retryAfter}s` },
      { status: 429 }
    );
  }

  const owner = await prisma.user.findUnique({ where: { id: params.id } });
  if (!owner) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    validateCommentStrokes(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid entry" },
      { status: 400 }
    );
  }

  const strokeData = body.canvas_stroke_data as StrokePoint[];
  const inkStyle = (body.ink_style as string) || "standard";

  const pngBuffer = await renderCommentToPng(strokeData, inkStyle);
  const sharp = (await import("sharp")).default;
  const compressedBuffer = await sharp(pngBuffer).png({ quality: 80 }).toBuffer();
  const imageUrl = await uploadBuffer(
    `guestbooks/${params.id}/${Date.now()}.png`,
    compressedBuffer,
    "image/png"
  );

  const entry = await prisma.guestbookEntry.create({
    data: {
      ownerId: params.id,
      authorId: session.userId,
      strokeData: strokeData as unknown as object,
      inkStyle,
      imageUrl,
    },
    include: {
      author: { select: { id: true, username: true, nomDePlume: true } },
    },
  });

  const { author, ...rest } = entry;
  return NextResponse.json(
    { comment: serializeGuestbookEntry({ ...rest, user: author }) },
    { status: 201 }
  );
}
