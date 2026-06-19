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

/**
 * Tells someone a letter is waiting (or on its way, for slow post). No
 * preview, no sender's words — the unsealing happens in the app. Never
 * throws: a failed notification must not fail the letter itself.
 */
export async function sendLetterArrivedEmail(
  to: string,
  senderUsername: string,
  options: { slow?: boolean } = {}
): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return; // dev without mail — silently skip

    const from = process.env.EMAIL_FROM || "Caligraphia <post@caligraphia.app>";
    const inboxUrl = `${process.env.BASE_URL || "http://localhost:3000"}/inbox`;
    const subject = options.slow
      ? "A letter is on its way to you"
      : "A letter is waiting for you";
    const line = options.slow
      ? `${senderUsername} has posted you a letter by evening post. It will arrive tomorrow morning.`
      : `${senderUsername} has left a letter in your box.`;

    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: `${line}\n\nOpen your inbox: ${inboxUrl}`,
        html: `
          <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #2c2416;">
            <h1 style="font-size: 24px; margin-bottom: 8px;">&#9993; Caligraphia</h1>
            <p style="color: #6b5c40;">${line}</p>
            <p style="margin: 28px 0;">
              <a href="${inboxUrl}" style="background: #1a1a1a; color: #fff; padding: 13px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open your inbox</a>
            </p>
          </div>
        `,
      }),
    });
    if (!res.ok) {
      console.error(`Letter notification failed (${res.status})`);
    }
  } catch (err) {
    console.error("Letter notification failed:", err);
  }
}

/**
 * Sends a friend invitation: a handwritten postcard, arriving like a piece of
 * 18th-century mail. The postcard image is served from a public, token-gated
 * endpoint so it loads for a recipient who isn't signed in. Throws on failure so
 * the caller can avoid spending the inviter's weekly allowance on a dead send.
 */
export async function sendInviteEmail(
  to: string,
  options: { inviterName: string; postcardImageUrl: string; acceptUrl: string }
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set; cannot send email");
  }

  const from = process.env.EMAIL_FROM || "Caligraphia <post@caligraphia.app>";
  const { inviterName, postcardImageUrl, acceptUrl } = options;
  const subject = `${inviterName} sent you a postcard from Caligraphia`;

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text:
        `${inviterName} has sent you a handwritten postcard and an invitation to Caligraphia — ` +
        `a place where handwriting lives. There are no keyboards here.\n\n` +
        `Open your invitation: ${acceptUrl}`,
      html: `
        <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 540px; margin: 0 auto; padding: 32px 24px; color: #2c2416; background: #faf4ec;">
          <h1 style="font-size: 24px; margin: 0 0 4px;">&#9998; Caligraphia</h1>
          <p style="color: #6b5c40; margin: 0 0 24px; font-style: italic;">A postcard arrived for you.</p>
          <div style="background: #fffef9; border: 1px solid #e0d5c0; border-radius: 8px; padding: 14px; box-shadow: 0 4px 18px rgba(80,40,20,0.08);">
            <img src="${postcardImageUrl}" alt="A handwritten postcard" width="100%" style="display: block; width: 100%; border-radius: 4px;" />
          </div>
          <p style="color: #4a3f2e; margin: 24px 0 0;">
            <strong>${inviterName}</strong> has invited you to Caligraphia — a small place where people
            write to each other by hand. No keyboards, no copy-paste, no bots.
          </p>
          <p style="margin: 28px 0 8px;">
            <a href="${acceptUrl}" style="background: #1a1a1a; color: #fff; padding: 13px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">Open your invitation</a>
          </p>
          <p style="font-size: 12px; color: #a09080; margin-top: 20px;">If you weren't expecting this, you can simply ignore it.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Failed to send invite email (${res.status}): ${detail}`);
  }
}
