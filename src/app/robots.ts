import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: ["/fr/", "/ar/"], disallow: ["/fr/admin", "/ar/admin", "/fr/dashboard", "/ar/dashboard", "/fr/apprendre", "/ar/apprendre", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
