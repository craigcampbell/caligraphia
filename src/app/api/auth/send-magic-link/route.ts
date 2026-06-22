import { NextResponse } from "next/server";
import { signMagicToken } from "@/lib/auth";
import { emailIsConfigured, sendMagicLinkEmail } from "@/lib/email";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { rateLimit } from "@/lib/rate-limit";

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

    const normalized = email.trim().toLowerCase();
    const rl = rateLimit(`magic-link:${normalized}`, 6, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${rl.retryAfter}s` },
        { status: 429 }
      );
    }

    const token = signMagicToken(normalized);
    const magicLink = `${process.env.BASE_URL || "http://localhost:3000"}/login?token=${token}`;

    if (emailIsConfigured()) {
      await sendMagicLinkEmail(normalized, magicLink);
      return NextResponse.json({ success: true });
    }

    if (process.env.NODE_ENV === "production") {
      console.error("RESEND_API_KEY is not set; magic links cannot be sent");
      return NextResponse.json(
        { error: "Email delivery is not configured. Contact the postmaster." },
        { status: 503 }
      );
    }

    // Dev only: no mail provider, so hand the link back for local testing.
    console.log(`[dev] magic link for ${normalized}: ${magicLink}`);
    return NextResponse.json({ success: true, devMagicLink: magicLink });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    const status = message.includes("not allowed") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
