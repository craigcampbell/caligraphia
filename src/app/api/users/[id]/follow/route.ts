import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (session.userId === params.id) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const follow = await prisma.userFollow.upsert({
    where: {
      followerId_followingId: {
        followerId: session.userId,
        followingId: params.id,
      },
    },
    update: {},
    create: {
      followerId: session.userId,
      followingId: params.id,
    },
  });

  return NextResponse.json({ follow });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    await prisma.userFollow.delete({
      where: {
        followerId_followingId: {
          followerId: session.userId,
          followingId: params.id,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Not following" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
