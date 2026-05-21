import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enforceNoTextInput } from "@/lib/no-text-input";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    include: {
      creator: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ groups });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  enforceNoTextInput(body);

  const { name, tag_pattern } = body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (
    !tag_pattern ||
    typeof tag_pattern !== "string" ||
    tag_pattern.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "tag_pattern is required" },
      { status: 400 }
    );
  }

  try {
    new RegExp(tag_pattern);
  } catch {
    return NextResponse.json(
      { error: "tag_pattern must be a valid regex" },
      { status: 400 }
    );
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      creatorId: session.userId,
      tagPattern: tag_pattern.trim(),
    },
    include: {
      creator: { select: { id: true, username: true } },
    },
  });

  return NextResponse.json({ group }, { status: 201 });
}
