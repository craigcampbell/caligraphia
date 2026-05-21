import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadBuffer, getPublicUrl } from "@/lib/storage";
import { compositeScratchOverlay } from "@/lib/image";
import { enforceNoTextInput } from "@/lib/no-text-input";
import { v4 as uuidv4 } from "uuid";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  enforceNoTextInput(body);

  const { scratch_svg_data } = body;
  if (!scratch_svg_data || typeof scratch_svg_data !== "string") {
    return NextResponse.json(
      { error: "scratch_svg_data is required" },
      { status: 400 }
    );
  }

  const post = await prisma.post.findUnique({ where: { id: params.id } });
  if (!post || post.deletedAt) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const scratch = await prisma.scratch.create({
    data: {
      parentPostId: params.id,
      userId: session.userId,
      scratchSvgData: scratch_svg_data,
    },
    include: {
      user: { select: { id: true, username: true } },
    },
  });

  const baseUrl = post.finalImageUrl || post.uploadedPhotoUrl;
  if (baseUrl) {
    try {
      const compositeBuffer = await compositeScratchOverlay(
        baseUrl,
        scratch_svg_data
      );
      const key = `scratches/${scratch.id}.png`;
      const compositeUrl = await uploadBuffer(
        key,
        compositeBuffer,
        "image/png"
      );

      await prisma.scratch.update({
        where: { id: scratch.id },
        data: { compositeImageUrl: compositeUrl },
      });

      scratch.compositeImageUrl = compositeUrl;
    } catch (err) {
      console.error("Failed to composite scratch overlay:", err);
    }
  }

  return NextResponse.json({ scratch }, { status: 201 });
}
