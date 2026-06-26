import type { Metadata } from "next";
import Link from "next/link";
import { PublicGallery } from "@/components/PublicGallery";

export const dynamic = "force-dynamic";

const base = process.env.BASE_URL || "https://caligraphia.com";

export const metadata: Metadata = {
  title: "Explore handwritten letters · Caligraphia",
  description:
    "A public gallery of letters written entirely by hand — doodles, notes, and real mail from Caligraphia, a slow, keyboard-free corner of the internet.",
  openGraph: {
    title: "Explore handwritten letters · Caligraphia",
    description: "Letters written entirely by hand. No keyboards. Come wander.",
    url: `${base}/explore`,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Explore handwritten letters · Caligraphia" },
};

export default function ExplorePage() {
  return (
    <div>
      <header className="ex-top">
        <Link href="/" className="ex-brand">Caligraphia</Link>
        <Link href="/login" className="ex-signin">Sign in &rarr;</Link>
      </header>
      <div className="ex-hero">
        <h1>Letters, by hand</h1>
        <p>Every one written with a real hand — no keyboards. Wander the public ones below.</p>
      </div>
      <PublicGallery />
      <style>{`
        .ex-top { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; }
        .ex-brand { font-weight: 700; font-size: 19px; color: #2c2416; text-decoration: none; }
        .ex-signin { color: #8a5a2b; text-decoration: none; font-size: 14px; }
        .ex-hero { text-align: center; padding: 18px 20px 28px; }
        .ex-hero h1 { font-size: 30px; color: #2c2416; margin: 0 0 6px; }
        .ex-hero p { color: #6b5640; margin: 0; }
      `}</style>
    </div>
  );
}
