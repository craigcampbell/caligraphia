/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "@napi-rs/canvas",
      "sharp",
      "tesseract.js",
      // Native module — must stay external so it isn't bundled and silently
      // falls back. Keep the base image glibc (node:20-slim), never musl/alpine.
      "@node-rs/argon2",
    ],
  },
  async headers() {
    // The admin panel is a juicy target: a readable CSRF cookie + a text note
    // field mean a same-origin XSS would be full takeover, so frame denial +
    // strict referrer/nosniff are load-bearing here. The Content-Security-Policy
    // itself is set per-request (with a nonce) in middleware.ts — it can't live
    // here because App Router needs a fresh nonce on every response.
    return [
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        // Baseline hardening for the rest of the app.
        source: "/:path*",
        headers: [{ key: "X-Content-Type-Options", value: "nosniff" }],
      },
    ];
  },
};

module.exports = nextConfig;
