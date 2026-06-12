import type { Metadata, Viewport } from "next";
import { IBM_Plex_Serif } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const plexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-plex-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Caligraphia",
  description: "A gathering place for people who love handwriting, doodling, and letters made by hand",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#faf7f0",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={plexSerif.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
