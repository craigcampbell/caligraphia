import { NextResponse } from "next/server";
import { verifyMagicToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer, getPublicUrl } from "@/lib/storage";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { SIGNUP_GRANT_STAMPS } from "@/lib/stamps";
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

    if ((!signupToken && !inviteToken) || !username) {
      return NextResponse.json(
        { error: "A sign-up link (or invitation) and a username are required" },
        { status: 400 }
      );
    }

    // Resolve the verified email address. A fresh magic/signup token proves the
    // person owns the inbox; if that short-lived token has expired, a still-valid
    // invitation to this very sign-up proves the same thing — it was emailed to
    // that address and is good for ~14 days. So an invited friend can finish
    // signing up without racing a 30-minute link.
    let email: string | null = null;
    if (signupToken) {
      try {
        email = verifyMagicToken(signupToken).email;
      } catch {
        /* fall through to the invitation below */
      }
    }
    if (!email && inviteToken) {
      const inv = await prisma.invite.findUnique({ where: { token: inviteToken } });
      if (inv && inv.status === "pending" && inv.expiresAt > new Date()) {
        email = inv.email;
      }
    }
    if (!email) {
      return NextResponse.json(
        {
          error:
            "Your sign-up link has expired. Open your invitation email again and tap Accept — that link stays good for days.",
        },
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
        email,
        nomDePlume: nomDePlumeUrl,
        stampBalance: SIGNUP_GRANT_STAMPS,
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
          invite.email === email &&
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
