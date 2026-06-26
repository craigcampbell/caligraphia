import type { MetadataRoute } from "next";

const base = process.env.BASE_URL || "https://caligraphia.com";

// Let crawlers see the public shop window; keep the private house out of search.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/explore", "/l/", "/login"],
        disallow: [
          "/api/",
          "/admin",
          "/inbox",
          "/post/",
          "/post/new",
          "/stamps",
          "/board",
          "/dead-letters",
          "/gallery",
          "/groups",
          "/users",
          "/robins",
          "/requests",
          "/signup",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
