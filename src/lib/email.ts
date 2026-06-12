const RESEND_API_URL = "https://api.resend.com/emails";

export function emailIsConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/**
 * Sends the magic link via Resend. Throws if sending fails so callers can
 * surface a real error instead of pretending the mail went out.
 */
export async function sendMagicLinkEmail(
  to: string,
  magicLink: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set; cannot send email");
  }

  const from = process.env.EMAIL_FROM || "Caligraphia <login@caligraphia.app>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Caligraphia sign-in link",
      text: `Open this link to sign in to Caligraphia (valid for 10 minutes):\n\n${magicLink}\n\nIf you didn't request this, ignore this email.`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2c2416;">
          <h1 style="font-size: 24px; margin-bottom: 8px;">&#9998; Caligraphia</h1>
          <p style="color: #6b5c40;">A letter arrived for you. Open it within 10 minutes:</p>
          <p style="margin: 28px 0;">
            <a href="${magicLink}" style="background: #1a1a1a; color: #fff; padding: 13px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Sign in to Caligraphia</a>
          </p>
          <p style="font-size: 12px; color: #a09080;">If you didn't request this, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to send email (${res.status}): ${detail}`);
  }
}
