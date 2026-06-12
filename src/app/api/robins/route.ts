import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import {
  renderRobinSectionToPng,
  cropRobinPeek,
  ROBIN_SIZE,
  type StrokePoint,
} from "@/lib/image";
import { validateCanvasPost } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";
import { v4 as uuidv4 } from "uuid";

const SECTION_MIN_DRAW_MS = 8_000;

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const robins = await prisma.roundRobin.findMany({
    orderBy: { createdAt: "desc" },
    take: 40,
    include: {
      sections: {
        orderBy: { position: "asc" },
        select: {
          position: true,
          peekUrl: true,
          userId: true,
          user: { select: { id: true, username: true } },
        },
      },
      finalPost: { select: { id: true, finalImageUrl: true } },
    },
  });

  // Open robins reveal only the last section's bottom sliver — never the art
  const sanitized = robins.map((r) => {
    const last = r.sections[r.sections.length - 1];
    return {
      id: r.id,
      size: r.size,
      status: r.status,
      createdAt: r.createdAt,
      sectionCount: r.sections.length,
      contributors: r.sections.map((s) => s.user.username),
      alreadyJoined: r.sections.some((s) => s.userId === session.userId),
      peekUrl: r.status === "open" ? last?.peekUrl ?? null : null,
      finalPost: r.status === "done" ? r.finalPost : null,
    };
  });

  return NextResponse.json({ robins: sanitized });
}

// Start a new robin by writing its first band
export async function POST(request: Request) {
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

  const png = await renderRobinSectionToPng(strokeData, inkStyle);
  const peek = await cropRobinPeek(png);
  const key = uuidv4();
  const [imageUrl, peekUrl] = await Promise.all([
    uploadBuffer(`robins/${key}-0.png`, png, "image/png"),
    uploadBuffer(`robins/${key}-0-peek.png`, peek, "image/png"),
  ]);

  const robin = await prisma.roundRobin.create({
    data: {
      size: ROBIN_SIZE,
      sections: {
        create: {
          userId: session.userId,
          position: 0,
          strokeData: strokeData as unknown as object,
          inkStyle,
          imageUrl,
          peekUrl,
        },
      },
    },
  });

  return NextResponse.json({ robin: { id: robin.id } }, { status: 201 });
}
