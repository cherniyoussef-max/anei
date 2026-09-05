import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AcademyHome } from "@/components/sections/AcademyHome";
import { isLocale } from "@/lib/i18n";
import { listHomeAvs, listHomeCourses, listHomeWebinars } from "@/server/queries/catalog";
import { logger } from "@/server/security/logger";
import "./academy-home.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ar" ? "معًا، من أجل تربية دامجة أكثر قوة" : locale === "fr" ? "Ensemble, pour une éducation inclusive plus forte" : "Together, for stronger inclusive education";
  const description = locale === "ar" ? "ترافق ANEI المهنيين والأسر لتحويل المعارف إلى ممارسات دامجة دقيقة وإنسانية." : locale === "fr" ? "ANEI accompagne les professionnels et les familles pour transformer les connaissances en pratiques inclusives, précises et humaines." : "ANEI supports professionals and families in turning knowledge into precise, inclusive and humane practice.";
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", ar: "/ar", fr: "/fr", "x-default": "/en" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "ar" ? "ar_TN" : locale === "fr" ? "fr_FR" : "en_US",
      images: [{ url: "/media/anei-hero-learning.webp", width: 1200, height: 900, alt: "ANEI professional learning" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/media/anei-hero-learning.webp"] },
  };
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sources = ["courses", "webinars", "avs"] as const;
  const results = await Promise.allSettled([listHomeCourses(), listHomeWebinars(), listHomeAvs()]);
  const unavailable = results.flatMap((result, index) => (result.status === "rejected" ? [sources[index]] : []));
  if (unavailable.length) logger.warn("homepage.content_degraded", { sources: unavailable });
  const [courseResult, webinarResult, avsResult] = results;
  const courses = courseResult.status === "fulfilled" ? courseResult.value : [];
  const webinars = webinarResult.status === "fulfilled" ? webinarResult.value : [];
  const avsProfiles = avsResult.status === "fulfilled" ? avsResult.value : [];
  return <AcademyHome locale={locale} courses={courses} webinars={webinars} avsProfiles={avsProfiles} />;
}
