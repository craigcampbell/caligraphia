import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signMagicToken, setSessionCookie } from "@/lib/auth";

// Public, no auth: possession of the token (delivered to the recipient's inbox)
// proves email access, the same trust model as a magic link.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) {
    return NextResponse.json(
      { error: "This invitation could not be found." },
      { status: 404 }
    );
  }
  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: "This invitation has already been used." },
      { status: 410 }
    );
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await prisma.invite
      .update({ where: { id: invite.id }, data: { status: "expired" } })
      .catch(() => {});
    return NextResponse.json(
      { error: "This invitation has expired." },
      { status: 410 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: invite.email },
  });

  if (existing) {
    // Already a member: connect the two as mutual friends, close the invite,
    // and log them in.
    await prisma.$transaction([
      prisma.userFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: invite.inviterId,
            followingId: existing.id,
          },
        },
        update: {},
        create: { followerId: invite.inviterId, followingId: existing.id },
      }),
      prisma.userFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: existing.id,
            followingId: invite.inviterId,
          },
        },
        update: {},
        create: { followerId: existing.id, followingId: invite.inviterId },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: {
          status: "accepted",
          acceptedAt: new Date(),
          acceptedUserId: existing.id,
        },
      }),
    ]);
    await setSessionCookie({
      userId: existing.id,
      username: existing.username,
      epoch: existing.sessionEpoch,
    });
    return NextResponse.json({ redirect: "/" });
  }

  // New person: hand off to the existing signup flow, carrying the invite token
  // so the friendship is linked once their account is created.
  const signupToken = signMagicToken(invite.email);
  return NextResponse.json({
    redirect: `/signup?signupToken=${encodeURIComponent(
      signupToken
    )}&invite=${encodeURIComponent(token)}`,
  });
}
