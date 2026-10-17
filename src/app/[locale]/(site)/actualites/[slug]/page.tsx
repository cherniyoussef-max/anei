import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ArrowLeft, BookOpen } from "lucide-react";
import { isLocale, formatDate } from "@/lib/i18n";
import { getPublishedNewsBySlug, getOtherRecentNews } from "@/server/queries/news";
import { publicDataOr } from "@/server/queries/public-fallback";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = await getPublishedNewsBySlug(slug);
  if (!post) return { title: "Actualité non trouvée | ANEI" };

  const ar = locale === "ar";
  const title = ar ? post.titleAr : post.titleFr;
  const description = ar ? post.excerptAr : post.excerptFr;

  return {
    title: `${title} | ANEI`,
    description,
    alternates: {
      canonical: `/${locale}/actualites/${slug}`,
      languages: {
        fr: `/fr/actualites/${slug}`,
        ar: `/ar/actualites/${slug}`,
        en: `/en/actualites/${slug}`,
        "x-default": `/en/actualites/${slug}`,
      },
    },
    openGraph: {
      title,
      description,
      type: "article",
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : undefined,
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const post = await publicDataOr(`news-article-${slug}`, () => getPublishedNewsBySlug(slug), null);
  if (!post) notFound();

  const otherNews = await publicDataOr(`news-recent-other-${slug}`, () => getOtherRecentNews(slug, 3), []);

  const ar = locale === "ar";
  const title = ar ? post.titleAr : post.titleFr;
  const excerpt = ar ? post.excerptAr : post.excerptFr;
  const content = ar ? post.contentAr : post.contentFr;
  const tag = ar ? post.tagAr : post.tagFr;
  const date = post.publishedAt ?? post.createdAt;

  // Split content by line breaks for clean paragraph rendering
  const paragraphs = content
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="min-h-screen bg-[#FDFDFE] pt-8 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Navigation retour */}
        <div className="mb-8">
          <Link
            href={`/${locale}/actualites`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#0056D2] transition-colors group"
          >
            <ArrowLeft
              size={16}
              className="transition-transform group-hover:-translate-x-1 rtl:group-hover:translate-x-1 rtl:rotate-180"
            />
            <span>{ar ? "العودة إلى جميع الأخبار" : "Retour aux actualités"}</span>
          </Link>
        </div>

        {/* En-tête de l'article */}
        <header className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-[#B58D3D] border border-slate-200/80">
              {tag}
            </span>
            <span className="text-slate-300 text-xs">•</span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium font-sans">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <time dateTime={date.toISOString()}>{formatDate(date, locale)}</time>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-sans font-bold text-[#0A192F] tracking-tight leading-[1.18] rtl:leading-[1.3] text-balance">
            {title}
          </h1>

          {excerpt && (
            <p className="mt-5 text-lg sm:text-xl text-slate-600 leading-relaxed font-normal italic border-s-2 border-[#B58D3D] ps-4">
              {excerpt}
            </p>
          )}
        </header>

        {/* Image de couverture principale si disponible */}
        {post.coverImageUrl && (
          <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden shadow-sm bg-slate-100 my-8">
            <Image
              src={post.coverImageUrl}
              alt={title}
              fill
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="object-cover object-center"
            />
          </div>
        )}

        {/* Corps de l'article bien typographié 100% Sans-Serif */}
        <div className="py-6 border-y border-slate-100 my-8">
          <div className="text-base sm:text-lg text-slate-700 leading-[1.8] rtl:leading-[2.0] font-normal space-y-6">
            {paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
        </div>

        {/* Partage / Retour bas de page */}
        <div className="flex items-center justify-between py-6">
          <Link
            href={`/${locale}/actualites`}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-2.5 text-xs sm:text-sm font-semibold transition-colors"
          >
            <ArrowLeft size={16} className="rtl:rotate-180" />
            <span>{ar ? "عرض جميع الأخبار" : "Voir toutes les actualités"}</span>
          </Link>

          <Link
            href={`/${locale}/formations`}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#0056D2] hover:underline"
          >
            <BookOpen size={16} />
            <span>{ar ? "اكتشف برامج التكوين" : "Découvrir nos formations"}</span>
          </Link>
        </div>

        {/* Bloc "Autres actualités récentes" */}
        {otherNews.length > 0 && (
          <aside className="mt-16 pt-12 border-t border-slate-200/80">
            <div className="flex items-center gap-2.5 mb-6">
              <span className="w-5 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
              <h2 className="text-xl font-bold font-sans text-[#0A192F]">
                {ar ? "أخبار ومستجدات حديثة أخرى" : "Autres actualités récentes"}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {otherNews.map((item) => (
                <Link
                  key={item.id}
                  href={`/${locale}/actualites/${item.slug}`}
                  className="group flex flex-col rounded-2xl border border-slate-200/70 p-5 bg-white hover:border-[#0056D2]/40 hover:shadow-xs transition-all"
                >
                  {item.coverImageUrl && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3.5 bg-slate-100">
                      <Image
                        src={item.coverImageUrl}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 280px"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#B58D3D] mb-1.5 uppercase">
                    <span>{ar ? item.tagAr : item.tagFr}</span>
                  </div>
                  <h3 className="font-bold text-sm text-[#0A192F] group-hover:text-[#0056D2] transition-colors leading-snug line-clamp-2">
                    {ar ? item.titleAr : item.titleFr}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium font-sans mt-3">
                    <time dateTime={(item.publishedAt ?? item.createdAt).toISOString()}>
                      {formatDate(item.publishedAt ?? item.createdAt, locale)}
                    </time>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}
