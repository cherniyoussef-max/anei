import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: [
      { userAgent: "*", allow: ["/en/", "/ar/", "/fr/"], disallow: ["/en/admin", "/ar/admin", "/fr/admin", "/en/dashboard", "/ar/dashboard", "/fr/dashboard", "/en/apprendre", "/ar/apprendre", "/fr/apprendre", "/api/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
