import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible } from "@/lib/post-access";

export const dynamic = "force-dynamic";

const base = process.env.BASE_URL || "https://caligraphia.com";
const USERNAME = /^[a-zA-Z0-9_-]{1,40}$/;

const PUBLIC_FIELDS = {
  isShowcased: true,
  isPrivate: true,
  isDeadLetter: true,
  needsReview: true,
  recipientId: true,
  deliverAt: true,
  deletedAt: true,
} as const;

async function getProfile(username: string) {
  if (!USERNAME.test(username)) return null;
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, nomDePlume: true },
  });
  if (!user) return null;
  const rows = await prisma.post.findMany({
    where: {
      userId: user.id,
      isShowcased: true,
      deletedAt: null,
      isPrivate: false,
      isDeadLetter: false,
      needsReview: false,
      recipientId: null,
    },
    select: { id: true, stampCount: true, finalImageUrl: true, uploadedPhotoUrl: true, ...PUBLIC_FIELDS },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const letters = rows
    .filter((p) => isPubliclyVisible(p))
    .map((p) => ({ id: p.id, stampCount: p.stampCount, hasImage: !!(p.finalImageUrl || p.uploadedPhotoUrl) }));
  return { user, letters };
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: "Caligraphia", robots: { index: false } };
  const title = `${profile.user.username}'s handwritten letters · Caligraphia`;
  const description = `Letters written entirely by hand by ${profile.user.username} on Caligraphia.`;
  const first = profile.letters.find((l) => l.hasImage);
  const images = first ? [`${base}/api/public/image/${first.id}`] : [];
  return {
    title,
    description,
    robots: profile.letters.length ? undefined : { index: false },
    openGraph: { title, description, url: `${base}/u/${profile.user.username}`, images, type: "profile" },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return (
      <div className="up-wrap">
        <header className="up-top"><Link href="/" className="up-brand">Caligraphia</Link><Link href="/login" className="up-signin">Sign in</Link></header>
        <div className="up-empty"><h1>No such writer</h1><Link href="/explore" className="up-cta">Explore public letters &rarr;</Link></div>
        <ProfileStyles />
      </div>
    );
  }

  const { user, letters } = profile;

  return (
    <div className="up-wrap">
      <header className="up-top">
        <Link href="/" className="up-brand">Caligraphia</Link>
        <Link href="/login" className="up-signin">Sign in</Link>
      </header>
      <div className="up-hero">
        <div className="up-avatar">
          <span>{user.username[0]?.toUpperCase()}</span>
        </div>
        <h1 className="up-name">{user.username}</h1>
        {user.nomDePlume ? (
          <p className="up-pen">writing as {user.nomDePlume}</p>
        ) : null}
        <p className="up-tag">handwritten letters on Caligraphia</p>
      </div>

      {letters.length === 0 ? (
        <p className="up-none">{user.username} hasn&apos;t showcased any letters yet.</p>
      ) : (
        <div className="up-grid">
          {letters.map((l) => (
            <Link key={l.id} href={`/l/${l.id}`} className="up-card">
              {l.hasImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/public/image/${l.id}`} alt={`Letter by ${user.username}`} loading="lazy" />
              ) : (
                <div className="up-noimg">&#9993;</div>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="up-foot">
        <Link href="/login" className="up-cta">Join Caligraphia &rarr;</Link>
      </div>
      <ProfileStyles />
    </div>
  );
}

function ProfileStyles() {
  return (
    <style>{`
      .up-wrap { max-width: 1000px; margin: 0 auto; padding: 0 16px 60px; color: #3a2e22; }
      .up-top { display: flex; align-items: center; justify-content: space-between; padding: 14px 4px; }
      .up-brand { font-weight: 700; font-size: 18px; color: #2c2416; text-decoration: none; }
      .up-signin { color: #8a5a2b; text-decoration: none; font-size: 14px; }
      .up-hero { text-align: center; padding: 18px 0 26px; }
      .up-avatar { width: 76px; height: 76px; border-radius: 50%; margin: 0 auto 10px; overflow: hidden;
        background: #ece0cc; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 700; color: #8b6914; }
      .up-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .up-name { font-size: 26px; color: #2c2416; margin: 0; }
      .up-pen { color: #6b5640; margin: 4px 0 0; }
      .up-tag { color: #8c7a60; font-style: italic; margin: 4px 0 0; }
      .up-grid { columns: 4 220px; column-gap: 14px; }
      .up-card { display: inline-block; width: 100%; margin: 0 0 14px; break-inside: avoid; border-radius: 10px; overflow: hidden;
        border: 1px solid #e6dcc6; background: #fffdf8; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      .up-card img { width: 100%; display: block; }
      .up-noimg { height: 150px; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #c2b393; }
      .up-none { text-align: center; color: #9b8a6e; padding: 40px; font-style: italic; }
      .up-foot { text-align: center; padding: 30px 0; }
      .up-cta { background: #6b5640; color: #faf7f0; text-decoration: none; padding: 11px 22px; border-radius: 10px; font-weight: 600; }
      .up-empty { text-align: center; padding: 60px 20px; }
      @media (max-width: 520px) { .up-grid { columns: 2 150px; } }
    `}</style>
  );
}
