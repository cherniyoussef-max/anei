import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ArrowRight, Bell } from "lucide-react";
import { NewsletterForm } from "@/components/interactive/NewsletterForm";
import { AneiLogo } from "@/components/brand/AneiLogo";
import { formatDate, isLocale } from "@/lib/i18n";
import { getPublishedNews } from "@/server/queries/news";
import { publicDataOr } from "@/server/queries/public-fallback";
import "./news-page.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title =
    locale === "ar"
      ? "أخبار ومستجدات الأكاديمية"
      : locale === "fr"
      ? "Actualités & Dossiers de l’Académie"
      : "Academy News & Articles";
  const description =
    locale === "ar"
      ? "تابع أحدث دورات ANEI وفعالياتها ومواردها وشراكاتها المهنية من أجل تربية دامجة وعادلة."
      : locale === "fr"
      ? "Suivez les nouvelles formations, les événements, les ressources et les partenariats professionnels de l’ANEI."
      : "Follow ANEI courses, events, resources and professional partnerships.";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/actualites`,
      languages: {
        en: "/en/actualites",
        fr: "/fr/actualites",
        ar: "/ar/actualites",
        "x-default": "/en/actualites",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "ar" ? "ar_TN" : locale === "fr" ? "fr_FR" : "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const CATEGORIES = [
  { id: "ALL", fr: "Toutes", ar: "جميع الأخبار" },
  { id: "FORMATION", fr: "Formation", ar: "تكوين" },
  { id: "CERTIFICATION", fr: "Certification", ar: "مصادقة" },
  { id: "PARTENARIAT", fr: "Partenariat", ar: "شراكة" },
  { id: "EVENEMENT", fr: "Événement", ar: "فعاليات" },
  { id: "COMMUNIQUE", fr: "Communiqué", ar: "بلاغ" },
];

export default async function NewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const query = await searchParams;
  const selectedCategory = typeof query.category === "string" ? query.category.toUpperCase() : "ALL";

  const ar = locale === "ar";

  const items = await publicDataOr(
    `news-${selectedCategory}`,
    () => getPublishedNews(selectedCategory),
    []
  );

  const localizedItems = items.map((item) => {
    return {
      ...item,
      tag: ar ? item.tagAr : item.tagFr,
      title: ar ? item.titleAr : item.titleFr,
      excerpt: ar ? item.excerptAr : item.excerptFr,
      date: item.publishedAt ?? item.createdAt,
    };
  });

  const [latest, ...updates] = localizedItems;

  const text = {
    eyebrow: ar ? "المركز الإعلامي" : "Actualités ANEI",
    title: ar ? "ما يستجد في الأكاديمية." : "Ce qui évolue à l’Académie.",
    intro: ar
      ? "دورات وفعاليات وموارد وشراكات ميدانية تجعل من التربية الدامجة ممارسة يومية واقعية."
      : "Formations, événements, ressources et partenariats qui rendent l’éducation inclusive concrète au quotidien.",
    alertsTitle: ar ? "ابقَ على اطلاع دائم" : "Recevez les prochaines actualités",
    alertsCopy: ar
      ? "رسالة موجزة عند نشر دورة تدريبية أو مورد جديد أو شراكة استراتيجية."
      : "Un message concis lorsqu’une formation, un événement ou une ressource est publié.",
    latest: ar ? "في الصدارة" : "À la une",
    readLatest: ar ? "اقرأ المقال الكامل" : "Lire l’article complet",
    all: ar ? "جميع الأخبار والمستجدات" : "Toutes les actualités",
    allCopy: ar
      ? "تصفح مستجدات البرامج التكوينية والموارد البيداغوجية والفعاليات الميدانية."
      : "Retrouvez les dernières informations sur les formations, les ressources et les partenariats.",
    emptyTitle: ar ? "لا توجد مقالات منشورة حاليًا في هذا القسم" : "Aucune actualité publiée dans cette catégorie",
    emptyCopy: ar
      ? "اختر فئة أخرى أو اشترك ليصلك إشعار فور نشر أي جديد."
      : "Sélectionnez une autre catégorie ou abonnez-vous pour être informé dès la prochaine publication.",
  };

  return (
    <div className="news-v7">
      {/* Hero Header */}
      <section className="news-v7-hero" aria-labelledby="news-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 news-v7-hero-grid">
          <div className="news-v7-intro">
            <nav aria-label="Fil d'Ariane" className="subpage-hero-breadcrumbs mb-3.5">
              <ol className="flex items-center gap-2 text-xs text-slate-500">
                <li>
                  <Link href={`/${locale}`} className="hover:text-[#0A192F] transition-colors">
                    {ar ? "الرئيسية" : "Accueil"}
                  </Link>
                </li>
                <li className="text-slate-300 text-[11px]" aria-hidden="true">/</li>
                <li className="text-[#0A192F] font-semibold">
                  {ar ? "الأخبار" : "Actualités"}
                </li>
              </ol>
            </nav>
            <div className="inline-flex items-center gap-2.5 mb-2">
              <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">
                {text.eyebrow}
              </span>
            </div>
            <h1
              id="news-title"
              className="text-4xl sm:text-5xl font-sans font-bold tracking-tight text-[#0A192F] leading-[1.15] max-w-2xl mt-2"
            >
              {text.title}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mt-4 font-normal">
              {text.intro}
            </p>
          </div>

          <aside className="news-v7-alerts" aria-labelledby="news-alerts-title">
            <div className="news-v7-alert-icon" aria-hidden="true">
              <Bell size={22} className="text-[#0A192F]" />
            </div>
            <div className="news-v7-alert-copy">
              <h2 id="news-alerts-title" className="font-sans font-bold text-base text-[#0A192F]">
                {text.alertsTitle}
              </h2>
              <p>{text.alertsCopy}</p>
            </div>
            <NewsletterForm locale={locale} idSuffix="news" variant="expanded" />
          </aside>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="news-v7-content pb-20" aria-labelledby="latest-news-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 1. CARTE "À LA UNE" EDITORIALE */}
          {latest ? (
            <article className="news-v7-lead grid grid-cols-1 md:grid-cols-12 rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden bg-white">
              {/* Panneau visuel : Photo nette OU médaillon épuré contrasté avec emblème ANEI */}
              {latest.coverImageUrl ? (
                <div className="md:col-span-5 relative min-h-[260px] sm:min-h-[340px] overflow-hidden bg-slate-100">
                  <Image
                    src={latest.coverImageUrl}
                    alt={latest.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 42vw"
                    priority
                    className="object-cover object-center"
                  />
                  <div className="absolute top-4 start-4 z-10">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] bg-[#0A192F]/80 text-[#E5C158] border border-white/10 backdrop-blur-xs">
                      {ar ? "في الصدارة ⭐" : "À la une ⭐"}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="md:col-span-5 relative bg-gradient-to-br from-[#0A192F] to-[#142B47] text-white p-8 flex flex-col justify-between overflow-hidden min-h-[260px] sm:min-h-[340px]">
                  <div className="flex items-center justify-between z-10">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] bg-[#B58D3D]/25 text-[#E5C158] border border-[#B58D3D]/40 backdrop-blur-xs">
                      {ar ? "في الصدارة ⭐" : "À la une ⭐"}
                    </span>
                  </div>

                  <div className="z-10 my-6 flex items-center gap-3.5">
                    <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white p-2 shadow-md">
                      <AneiLogo locale={locale} variant="mark" withText={false} height={32} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm sm:text-[15px] leading-snug font-sans">
                        {ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}
                      </span>
                      <span className="text-[11px] font-semibold text-[#C5A059] uppercase tracking-wider mt-0.5">
                        {latest.tag}
                      </span>
                    </div>
                  </div>

                  <div className="z-10 flex items-center gap-2 text-slate-300 text-xs font-medium">
                    <Calendar size={15} className="text-[#E5C158] shrink-0" />
                    <time dateTime={latest.date.toISOString()} className="font-sans">
                      {formatDate(latest.date, locale)}
                    </time>
                  </div>
                </div>
              )}

              {/* Colonne de texte éditoriale */}
              <div className="md:col-span-7 p-8 sm:p-10 lg:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#B58D3D]">
                    {latest.tag}
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <time dateTime={latest.date.toISOString()} className="text-xs text-slate-500 font-medium font-sans">
                    {formatDate(latest.date, locale)}
                  </time>
                </div>

                <h2
                  id="latest-news-title"
                  className="text-2xl sm:text-3xl font-sans font-bold text-[#0A192F] leading-tight mb-4"
                >
                  <Link
                    href={`/${locale}/actualites/${latest.slug}`}
                    className="hover:text-[#0056D2] transition-colors"
                  >
                    {latest.title}
                  </Link>
                </h2>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8 max-w-2xl font-normal">
                  {latest.excerpt}
                </p>

                <div>
                  <Link
                    href={`/${locale}/actualites/${latest.slug}`}
                    className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#0A192F] hover:bg-[#0056D2] text-white text-sm font-semibold transition-all shadow-xs group"
                  >
                    <span>{text.readLatest}</span>
                    <ArrowRight
                      size={16}
                      strokeWidth={2}
                      className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
                    />
                  </Link>
                </div>
              </div>
            </article>
          ) : (
            <div className="news-v7-empty bg-slate-50 border border-slate-200 rounded-3xl p-12 text-center my-8">
              <h2 id="latest-news-title" className="text-xl font-bold text-slate-900 mb-2">
                {text.emptyTitle}
              </h2>
              <p className="text-slate-600 text-sm max-w-md mx-auto">{text.emptyCopy}</p>
            </div>
          )}

          {/* 2. FILTRE PAR CATÉGORIE & TOUTES LES ACTUALITÉS */}
          <div className="mt-16 sm:mt-20">
            <header className="mb-6">
              <div className="inline-flex items-center gap-2.5 mb-2">
                <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">
                  {ar ? "تصفح حسب الموضوع" : "Rubriques & Thématiques"}
                </span>
              </div>
              <h2 id="all-news-title" className="text-2xl sm:text-3xl font-sans font-bold text-[#0A192F]">
                {text.all}
              </h2>
              <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-xl mt-1.5 font-normal">
                {text.allCopy}
              </p>
            </header>

            {/* Filtres de catégorie horizontaux */}
            <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-slate-200/80">
              {CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                const filterHref =
                  cat.id === "ALL"
                    ? `/${locale}/actualites`
                    : `/${locale}/actualites?category=${cat.id.toLowerCase()}`;

                return (
                  <Link
                    key={cat.id}
                    href={filterHref}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#0A192F] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {ar ? cat.ar : cat.fr}
                  </Link>
                );
              })}
            </div>

            {/* Liste éditoriale des articles */}
            {updates.length ? (
              <div className="divide-y divide-slate-100">
                {updates.map((item) => (
                  <article key={item.id} className="py-5 first:pt-2 border-b border-slate-100 last:border-b-0">
                    <Link
                      href={`/${locale}/actualites/${item.slug}`}
                      className="group flex flex-col md:flex-row md:items-center justify-between gap-5 rounded-2xl p-4 sm:p-5 -mx-4 sm:-mx-5 hover:bg-slate-50/90 transition-all text-inherit no-underline"
                      aria-label={ar ? `اقرأ: ${item.title}` : `Lire : ${item.title}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start gap-5 flex-1 min-w-0">
                        {item.coverImageUrl && (
                          <div className="relative w-full sm:w-44 h-32 sm:h-28 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                            <Image
                              src={item.coverImageUrl}
                              alt=""
                              fill
                              sizes="176px"
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-3 mb-1.5">
                            <span className="text-xs font-bold text-[#B58D3D] uppercase tracking-wide">
                              {item.tag}
                            </span>
                            <span className="text-slate-300 text-xs">•</span>
                            <time dateTime={item.date.toISOString()} className="text-xs text-slate-500 font-medium font-sans">
                              {formatDate(item.date, locale)}
                            </time>
                          </div>
                          <h3 className="text-lg sm:text-xl font-sans font-semibold text-[#0A192F] leading-snug group-hover:text-[#0056D2] transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed mt-1.5 line-clamp-2 font-normal">
                            {item.excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0056D2] group-hover:text-[#00419e] shrink-0 self-start md:self-center mt-2 md:mt-0">
                        <span>{ar ? "اقرأ المقال" : "Lire l'article"}</span>
                        <ArrowRight
                          size={15}
                          strokeWidth={2}
                          className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
                        />
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            ) : !latest ? null : (
              <p className="text-xs text-slate-500 py-6">
                {ar ? "لا توجد مقالات أخرى في هذا التصنيف حاليًا." : "Pas d'autres articles dans cette catégorie pour le moment."}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
