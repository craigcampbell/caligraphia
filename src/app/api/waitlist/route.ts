import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public, no auth: a visitor on the invite-only landing leaves their email so an
// admin can bring them in later. Always responds the same way regardless of
// whether the address is new, already waiting, or already a member — no
// enumeration. Upsert keeps it idempotent so re-submits never error or dupe.
export async function POST(request: Request) {
  let body: { email?: unknown; note?: unknown; source?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 280) || null : null;
  const source =
    typeof body.source === "string" ? body.source.trim().slice(0, 40) || null : "landing";

  try {
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, note, source },
      // Don't clobber an existing note/source or reset their place in line.
      update: {},
    });
  } catch (err) {
    console.error("waitlist upsert error:", err);
    return NextResponse.json({ error: "Something went wrong. Try again later." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
