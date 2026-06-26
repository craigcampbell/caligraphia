import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const base = process.env.BASE_URL || "https://caligraphia.com";

// Only showcased (opt-in public) letters + the public editorial pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let showcased: { id: string; createdAt: Date; user: { username: string } }[] = [];
  try {
    showcased = await prisma.post.findMany({
      where: {
        isShowcased: true,
        deletedAt: null,
        isPrivate: false,
        isDeadLetter: false,
        needsReview: false,
        recipientId: null,
      },
      select: { id: true, createdAt: true, user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
  } catch {
    /* sitemap should never hard-fail the build/runtime */
  }

  // One profile entry per writer who has at least one showcased letter.
  const profiles = new Map<string, Date>();
  for (const p of showcased) {
    if (!profiles.has(p.user.username)) profiles.set(p.user.username, p.createdAt);
  }

  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/explore`, changeFrequency: "daily", priority: 0.9 },
    ...[...profiles.entries()].map(([username, lastModified]) => ({
      url: `${base}/u/${username}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...showcased.map((p) => ({
      url: `${base}/l/${p.id}`,
      lastModified: p.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
