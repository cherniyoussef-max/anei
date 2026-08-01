import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const routes = ["", "/about", "/formations", "/webinaires", "/bibliotheque", "/avs", "/actualites", "/contact"];
  return (["fr", "ar"] as const).flatMap((locale) => routes.map((route) => ({
    url: `${base}/${locale}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" as const : "daily" as const,
    priority: route === "" ? 1 : 0.7,
  })));
}
