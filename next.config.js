/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "sharp", "tesseract.js"],
  },
};

module.exports = nextConfig;
