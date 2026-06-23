import { NextResponse } from "next/server";
import { verifyMagicToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceNoTextInput } from "@/lib/no-text-input";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    enforceNoTextInput(body);

    const { token } = body;
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    let payload;
    try {
      payload = verifyMagicToken(token);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired magic link" },
        { status: 401 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (existingUser) {
      await setSessionCookie({
        userId: existingUser.id,
        username: existingUser.username,
        epoch: existingUser.sessionEpoch,
      });

      return NextResponse.json({
        needsSignup: false,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          nomDePlume: existingUser.nomDePlume,
        },
      });
    }

    // If this address was invited, thread the invitation through to signup so it
    // can serve as long-lived proof (and link the friendship) even if they
    // deleted the invite email and just typed their address here.
    const pendingInvite = await prisma.invite.findFirst({
      where: { email: payload.email, status: "pending", expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { token: true },
    });

    return NextResponse.json({
      needsSignup: true,
      signupToken: token,
      email: payload.email,
      inviteToken: pendingInvite?.token,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
