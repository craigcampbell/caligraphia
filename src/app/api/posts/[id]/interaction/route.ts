import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await prisma.postInteraction.delete({
      where: {
        postId_userId: {
          postId: params.id,
          userId: session.userId,
        },
      },
    });
  } catch {
    return NextResponse.json(
      { error: "No interaction to remove" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
