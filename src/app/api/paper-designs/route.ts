import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer } from "@/lib/storage";
import { POSTCARD_WIDTH, POSTCARD_HEIGHT } from "@/lib/image";
import { grantMonthlyStamps, CUSTOM_PAPER_COST_STAMPS } from "@/lib/stamps";
import { v4 as uuidv4 } from "uuid";

export const runtime = "nodejs";

// Letter sheet is 2400x3200; postcards use the shared constants.
const LETTER_W = 2400;
const LETTER_H = 3200;

function serialize(d: { id: string; name: string; surface: string; isPublic: boolean; ownerId: string }) {
  return {
    id: d.id,
    name: d.name,
    surface: d.surface,
    isPublic: d.isPublic,
    ownerId: d.ownerId,
    imageUrl: `/api/media/paper/${d.id}`,
  };
}

// List the stationery this user can write on: their own + everyone's public ones.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const surface = new URL(request.url).searchParams.get("surface");
  const where: Record<string, unknown> = {
    OR: [{ ownerId: session.userId }, { isPublic: true }],
  };
  if (surface === "letter" || surface === "postcard") where.surface = surface;

  const designs = await prisma.paperDesign.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    designs: designs.map(serialize),
    costStamps: CUSTOM_PAPER_COST_STAMPS,
  });
}

// Make a new piece of stationery from an uploaded image. Charges stamps.
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const surface = formData.get("surface") === "postcard" ? "postcard" : "letter";
  const isPublic = formData.get("is_public") === "true";
  if (!image || image.size === 0) {
    return NextResponse.json({ error: "An image is required" }, { status: 400 });
  }
  if (!image.type.startsWith("image/")) {
    return NextResponse.json({ error: "That file isn't an image" }, { status: 400 });
  }

  const sharp = (await import("sharp")).default;
  const [w, h] = surface === "postcard" ? [POSTCARD_WIDTH, POSTCARD_HEIGHT] : [LETTER_W, LETTER_H];

  // Fit the artwork to the sheet shape. Soften slightly toward white so dark ink
  // stays readable on top (premium paper should never fight the handwriting).
  const fitted = await sharp(Buffer.from(await image.arrayBuffer()))
    .rotate()
    .resize(w, h, { fit: "cover", position: "attention" })
    .modulate({ brightness: 1.04 })
    .jpeg({ quality: 88 })
    .toBuffer();
  const imageUrl = await uploadBuffer(`paper-designs/${uuidv4()}.jpg`, fitted, "image/jpeg");

  // Auto-name (the app's ethos is no typing) and charge stamps atomically.
  const count = await prisma.paperDesign.count({ where: { ownerId: session.userId } });
  const name = `My stationery ${count + 1}`;

  try {
    const design = await prisma.$transaction(async (tx) => {
      await grantMonthlyStamps(tx, session.userId);
      const charged = await tx.user.updateMany({
        where: { id: session.userId, stampBalance: { gte: CUSTOM_PAPER_COST_STAMPS } },
        data: { stampBalance: { decrement: CUSTOM_PAPER_COST_STAMPS } },
      });
      if (charged.count === 0) {
        throw new Error("INSUFFICIENT_STAMPS");
      }
      return tx.paperDesign.create({
        data: { ownerId: session.userId, name, imageUrl, surface, isPublic },
      });
    });
    return NextResponse.json({ design: serialize(design) }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_STAMPS") {
      return NextResponse.json(
        { error: `You need ${CUSTOM_PAPER_COST_STAMPS} stamps to make stationery.` },
        { status: 402 }
      );
    }
    console.error("paper design create failed:", err);
    return NextResponse.json({ error: "Could not create your stationery" }, { status: 500 });
  }
}
