import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { newsItems as translations } from "@/lib/data";
import { formatDate, isLocale } from "@/lib/i18n";
import { getPublishedNewsBySlug } from "@/server/queries/news";
import "../news-page.css";

export const dynamic = "force-dynamic";

function translationForSlug(slug: string) {
  const match = slug.match(/(\d+)$/);
  return match ? translations[Number(match[1]) - 1] : undefined;
}

function publicParagraphs(content: string) {
  return content
    .split("\n")
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .filter((paragraph) => {
      const normalized = paragraph.toLocaleLowerCase();
      return !normalized.includes("actualité de démonstration")
        && !normalized.includes("back-office anei")
        && !normalized.includes("هذا الخبر التجريبي")
        && !normalized.includes("لوحة تحكم anei");
    });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }): Promise<Metadata> {
  const { locale, id } = await params;
  const item = await getPublishedNewsBySlug(id);
  if (!item) return {};
  const translated = translationForSlug(id);
  const title = locale === "ar" ? item.titleAr : locale === "en" ? translated?.title.en ?? item.titleFr : item.titleFr;
  const description = locale === "ar" ? item.excerptAr : locale === "en" ? translated?.excerpt.en ?? item.excerptFr : item.excerptFr;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/actualites/${id}`,
      languages: {
        en: `/en/actualites/${id}`,
        fr: `/fr/actualites/${id}`,
        ar: `/ar/actualites/${id}`,
        "x-default": `/en/actualites/${id}`,
      },
    },
    openGraph: { title, description, type: "article", locale: locale === "ar" ? "ar_TN" : locale === "fr" ? "fr_FR" : "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export default async function NewsDetail({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const item = await getPublishedNewsBySlug(id);
  if (!item) notFound();

  const ar = locale === "ar";
  const en = locale === "en";
  const translated = translationForSlug(id);
  const tag = ar ? item.tagAr : en ? translated?.tag.en ?? item.tagFr : item.tagFr;
  const title = ar ? item.titleAr : en ? translated?.title.en ?? item.titleFr : item.titleFr;
  const excerpt = ar ? item.excerptAr : en ? translated?.excerpt.en ?? item.excerptFr : item.excerptFr;
  const content = en ? excerpt : ar ? item.contentAr : item.contentFr;
  const paragraphs = publicParagraphs(content);
  const date = item.publishedAt ?? item.createdAt;

  return (
    <article className="news-v7 news-v7-article">
      <header className="news-v7-article-header">
        <div className="v5-container news-v7-article-heading">
          <Link className="news-v7-back" href={`/${locale}/actualites`}>
            <Icon className="news-v7-back-icon" name="arrow" size={18} />
            <span>{ar ? "كل الأخبار" : en ? "All updates" : "Toutes les actualités"}</span>
          </Link>
          <div className="news-v7-article-meta">
            <span>{tag}</span>
            <time dateTime={date.toISOString()}>{formatDate(date, locale)}</time>
          </div>
          <h1>{title}</h1>
          <p>{excerpt}</p>
        </div>
      </header>

      <div className="v5-container news-v7-article-layout">
        <div className="news-v7-article-body">
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
        <aside className="news-v7-article-aside" aria-label={ar ? "العودة إلى الأخبار" : en ? "Back to news" : "Retour aux actualités"}>
          <span>{ar ? "تابع مستجدات الأكاديمية" : en ? "Keep up with the Academy" : "Suivez les actualités de l’Académie"}</span>
          <Link href={`/${locale}/actualites`}>
            <span>{ar ? "جميع الأخبار" : en ? "All updates" : "Toutes les actualités"}</span>
            <Icon className="directional-icon" name="arrow" size={18} />
          </Link>
        </aside>
      </div>
    </article>
  );
}
