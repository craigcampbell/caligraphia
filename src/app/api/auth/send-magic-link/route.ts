import { NextResponse } from "next/server";
import { signMagicToken } from "@/lib/auth";
import { enforceNoTextInput } from "@/lib/no-text-input";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    enforceNoTextInput(body);

    const { email } = body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    const token = signMagicToken(email);
    const magicLink = `${process.env.BASE_URL || "http://localhost:3000"}/login?token=${token}`;

    return NextResponse.json({
      success: true,
      magicLink,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
