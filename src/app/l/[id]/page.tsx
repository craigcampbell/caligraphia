import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isPubliclyVisible } from "@/lib/post-access";
import { ShareButtons } from "@/components/ShareButtons";

export const dynamic = "force-dynamic";

const SELECT = {
  id: true,
  createdAt: true,
  stampCount: true,
  ocrText: true,
  ocrHashtags: true,
  finalImageUrl: true,
  uploadedPhotoUrl: true,
  isShowcased: true,
  isPrivate: true,
  isDeadLetter: true,
  needsReview: true,
  recipientId: true,
  deliverAt: true,
  deletedAt: true,
  user: { select: { username: true } },
} as const;

async function getPublicLetter(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const post = await prisma.post.findUnique({ where: { id }, select: SELECT });
  return isPubliclyVisible(post) ? post : null;
}

// Open Graph / Twitter card: when someone shares /l/<id> on X, Facebook, iMessage
// etc., it renders the letter image as a rich preview. Only ever for public letters.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPublicLetter(id);
  if (!post) {
    return { title: "Caligraphia", robots: { index: false } };
  }
  const base = process.env.BASE_URL || "https://caligraphia.com";
  const img = `${base}/api/public/image/${post.id}`;
  const title = `A handwritten letter by ${post.user.username} · Caligraphia`;
  const description =
    "A letter written entirely by hand on Caligraphia — a quiet corner of the internet for handwriting, doodles, and real mail.";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${base}/l/${post.id}`,
      images: [{ url: img, width: 1200, height: 1600 }],
      type: "article",
    },
    twitter: { card: "summary_large_image", title, description, images: [img] },
  };
}

export default async function PublicLetterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPublicLetter(id);

  if (!post) {
    return (
      <div className="pl-wrap">
        <div className="pl-card pl-missing">
          <div className="pl-mark">&#9993;</div>
          <h1>This letter isn&apos;t public</h1>
          <p>It may be private, returned, or no longer here.</p>
          <Link href="/explore" className="pl-cta">See public letters &rarr;</Link>
        </div>
        <PublicLetterStyles />
      </div>
    );
  }

  const hasImage = post.finalImageUrl || post.uploadedPhotoUrl;
  const base = process.env.BASE_URL || "https://caligraphia.com";

  return (
    <div className="pl-wrap">
      <header className="pl-top">
        <Link href="/" className="pl-brand">Caligraphia</Link>
        <Link href="/login" className="pl-signin">Sign in</Link>
      </header>

      <main className="pl-card">
        <div className="pl-by">
          A letter by <strong>{post.user.username}</strong>
        </div>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pl-img" src={`/api/public/image/${post.id}`} alt={`Handwritten letter by ${post.user.username}`} />
        ) : (
          <div className="pl-noimg">No image</div>
        )}
        {post.ocrHashtags?.length > 0 && (
          <div className="pl-tags">
            {post.ocrHashtags.map((t) => (
              <span key={t} className="pl-tag">{t}</span>
            ))}
          </div>
        )}
        <ShareButtons url={`${base}/l/${post.id}`} text={`A handwritten letter by ${post.user.username} · Caligraphia`} />
      </main>

      <section className="pl-pitch">
        <h2>Written by hand. No keyboards.</h2>
        <p>
          Caligraphia is a small, slow place for handwritten letters, doodles, and real mail.
          Every word here was actually written by hand.
        </p>
        <div className="pl-actions">
          <Link href="/explore" className="pl-cta">Wander the public letters</Link>
          <Link href="/login" className="pl-cta pl-cta-ghost">Get in &rarr;</Link>
        </div>
      </section>

      <PublicLetterStyles />
    </div>
  );
}

function PublicLetterStyles() {
  return (
    <style>{`
      .pl-wrap { max-width: 720px; margin: 0 auto; padding: 16px; color: #3a2e22; }
      .pl-top { display: flex; align-items: center; justify-content: space-between; padding: 8px 4px 18px; }
      .pl-brand { font-weight: 700; font-size: 18px; color: #2c2416; text-decoration: none; letter-spacing: 0.3px; }
      .pl-signin { color: #8a5a2b; text-decoration: none; font-size: 14px; }
      .pl-card { background: #fffdf8; border: 1px solid #e6dcc6; border-radius: 14px; padding: 18px; box-shadow: 0 8px 30px rgba(0,0,0,0.06); }
      .pl-by { color: #6b5640; font-size: 14px; margin-bottom: 12px; }
      .pl-img { width: 100%; height: auto; border-radius: 8px; display: block; background: #fff; }
      .pl-noimg { padding: 60px; text-align: center; color: #b3a78f; }
      .pl-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .pl-tag { font-size: 12px; color: #8a7656; background: #f1e8d8; border-radius: 999px; padding: 2px 10px; }
      .pl-pitch { text-align: center; padding: 34px 16px 50px; }
      .pl-pitch h2 { font-size: 22px; color: #2c2416; margin: 0 0 8px; }
      .pl-pitch p { color: #6b5640; max-width: 480px; margin: 0 auto 18px; line-height: 1.6; }
      .pl-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
      .pl-cta { background: #6b5640; color: #faf7f0; text-decoration: none; padding: 11px 20px; border-radius: 10px; font-weight: 600; }
      .pl-cta-ghost { background: transparent; color: #6b5640; border: 1px solid #c9b8a0; }
      .pl-missing { text-align: center; padding: 50px 24px; }
      .pl-mark { font-size: 44px; color: #c2b393; }
      .pl-missing h1 { font-size: 20px; margin: 8px 0; }
      .pl-missing p { color: #8a7656; margin-bottom: 18px; }
    `}</style>
  );
}
