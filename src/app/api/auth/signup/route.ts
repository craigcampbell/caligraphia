import { NextResponse } from "next/server";
import { verifyMagicToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer, getPublicUrl } from "@/lib/storage";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { DAILY_STAMP_ALLOWANCE } from "@/lib/stamps";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const signupToken = formData.get("signupToken") as string;
    const username = formData.get("username") as string;
    const inviteToken = formData.get("invite") as string | null;
    const nomDePlumeFile = formData.get("nomDePlume") as File | null;

    const bodyObj: Record<string, unknown> = { signupToken, username };
    enforceNoTextInput(bodyObj);

    if (!signupToken || !username) {
      return NextResponse.json(
        { error: "signupToken and username are required" },
        { status: 400 }
      );
    }

    let payload;
    try {
      payload = verifyMagicToken(signupToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired signup token" },
        { status: 401 }
      );
    }

    const usernameTrimmed = username.trim();
    if (usernameTrimmed.length < 2 || usernameTrimmed.length > 30) {
      return NextResponse.json(
        { error: "Username must be between 2 and 30 characters" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(usernameTrimmed)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, hyphens, and underscores" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { username: usernameTrimmed },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    let nomDePlumeUrl: string | null = null;

    if (nomDePlumeFile && nomDePlumeFile.size > 0) {
      const buffer = Buffer.from(await nomDePlumeFile.arrayBuffer());
      const ext = nomDePlumeFile.name.split(".").pop() || "png";
      const key = `nom-de-plume/${uuidv4()}.${ext}`;
      await uploadBuffer(key, buffer, nomDePlumeFile.type || "image/png");
      nomDePlumeUrl = getPublicUrl(key);
    }

    const user = await prisma.user.create({
      data: {
        username: usernameTrimmed,
        email: payload.email,
        nomDePlume: nomDePlumeUrl,
        stampBalance: DAILY_STAMP_ALLOWANCE,
      },
    });

    // If they arrived through a friend invitation, connect inviter and new
    // member as mutual friends and close out the invite. The invite's email
    // must match the verified signup email so the token can't link a stranger.
    if (inviteToken) {
      try {
        const invite = await prisma.invite.findUnique({
          where: { token: inviteToken },
        });
        if (
          invite &&
          invite.status === "pending" &&
          invite.email === payload.email &&
          invite.inviterId !== user.id
        ) {
          await prisma.$transaction([
            prisma.userFollow.upsert({
              where: {
                followerId_followingId: {
                  followerId: invite.inviterId,
                  followingId: user.id,
                },
              },
              update: {},
              create: { followerId: invite.inviterId, followingId: user.id },
            }),
            prisma.userFollow.upsert({
              where: {
                followerId_followingId: {
                  followerId: user.id,
                  followingId: invite.inviterId,
                },
              },
              update: {},
              create: { followerId: user.id, followingId: invite.inviterId },
            }),
            prisma.invite.update({
              where: { id: invite.id },
              data: {
                status: "accepted",
                acceptedAt: new Date(),
                acceptedUserId: user.id,
              },
            }),
          ]);
        }
      } catch (err) {
        // A linking hiccup shouldn't block the account from being created.
        console.error("Invite linking failed:", err);
      }
    }

    await setSessionCookie({
      userId: user.id,
      username: user.username,
      epoch: user.sessionEpoch,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        nomDePlume: user.nomDePlume,
        createdAt: user.createdAt,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
