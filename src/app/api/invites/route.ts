import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { renderPostcardToPng, type StrokePoint } from "@/lib/image";
import { validateCommentStrokes } from "@/lib/validation";
import { sendInviteEmail } from "@/lib/email";

const WEEKLY_LIMIT = 2;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function weekAgo(): Date {
  return new Date(Date.now() - WEEK_MS);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [recent, invites] = await Promise.all([
    prisma.invite.count({
      where: { inviterId: session.userId, createdAt: { gte: weekAgo() } },
    }),
    prisma.invite.findMany({
      where: { inviterId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    remainingThisWeek: Math.max(0, WEEKLY_LIMIT - recent),
    weeklyLimit: WEEKLY_LIMIT,
    invites,
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    // Validates the handwritten strokes and rejects any forbidden typed text.
    // `email`/`ink_style`/`paper` are allow-listed fields, so they pass through.
    validateCommentStrokes(body);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid invitation" },
      { status: 400 }
    );
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (email === session.username.toLowerCase()) {
    // Defensive: usernames aren't emails, but guard against self-invites anyway.
    return NextResponse.json(
      { error: "You can't invite yourself." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      {
        error:
          "That person is already on Caligraphia — find them and follow them instead.",
      },
      { status: 409 }
    );
  }

  const dupe = await prisma.invite.findFirst({
    where: { inviterId: session.userId, email, status: "pending" },
  });
  if (dupe) {
    return NextResponse.json(
      {
        error:
          "You've already sent a postcard to that address — it's still waiting to be opened.",
      },
      { status: 409 }
    );
  }

  // Weekly limit: at most WEEKLY_LIMIT invites in any rolling 7-day window.
  const recent = await prisma.invite.findMany({
    where: { inviterId: session.userId, createdAt: { gte: weekAgo() } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= WEEKLY_LIMIT) {
    const freesAt = new Date(recent[0].createdAt.getTime() + WEEK_MS);
    return NextResponse.json(
      {
        error: `You've used both invitations this week. Your next one is ready ${freesAt.toLocaleDateString()}.`,
        freesAt,
      },
      { status: 429 }
    );
  }

  const strokeData = body.canvas_stroke_data as StrokePoint[];
  const inkStyle = (body.ink_style as string) || "standard";
  const paper = (body.paper as string) || "blank";
  const token = randomUUID();

  // Render the handwritten note as a postmarked postcard, then store it.
  const pngBuffer = await renderPostcardToPng(strokeData, paper, inkStyle);
  const sharp = (await import("sharp")).default;
  const compressed = await sharp(pngBuffer).png({ quality: 80 }).toBuffer();
  const imageUrl = await uploadBuffer(
    `invites/${token}.png`,
    compressed,
    "image/png"
  );

  const invite = await prisma.invite.create({
    data: {
      inviterId: session.userId,
      email,
      token,
      strokeData: strokeData as unknown as object,
      inkStyle,
      paperType: paper,
      imageUrl,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const base = process.env.BASE_URL || "http://localhost:3000";
  try {
    await sendInviteEmail(email, {
      inviterName: session.username,
      postcardImageUrl: `${base}/api/invites/${token}/image`,
      acceptUrl: `${base}/invite/${token}`,
    });
  } catch (err) {
    // A failed send shouldn't burn one of the inviter's weekly invitations.
    await prisma.invite.delete({ where: { id: invite.id } }).catch(() => {});
    console.error("Invite email failed:", err);
    return NextResponse.json(
      { error: "We couldn't deliver the postcard. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { success: true, invite: { id: invite.id, email, status: invite.status } },
    { status: 201 }
  );
}
