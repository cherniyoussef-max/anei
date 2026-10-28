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
    const fallbackImage =
      item.category === "CERTIFICATION" || item.slug.includes("avs")
        ? "/media/domain-avs.jpg"
        : item.category === "FORMATION"
        ? "/media/domain-pedagogie.jpg"
        : item.category === "EVENEMENT"
        ? "/media/domain-webinaires.jpg"
        : "/media/alaune-classroom.jpg";

    return {
      ...item,
      coverImageUrl: item.coverImageUrl || fallbackImage,
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
            <article className="news-v7-lead group relative grid grid-cols-1 lg:grid-cols-12 rounded-3xl border border-[#dde9f8] shadow-[0_12px_40px_-10px_rgba(11,31,75,0.08)] hover:shadow-[0_24px_60px_-12px_rgba(11,31,75,0.15)] transition-all duration-500 overflow-hidden bg-white">
              {/* Panneau visuel : Photo haute résolution avec vignette et micro-détails */}
              <div className="lg:col-span-5 xl:col-span-6 relative min-h-[300px] sm:min-h-[380px] lg:min-h-[440px] overflow-hidden bg-slate-900">
                <Image
                  src={latest.coverImageUrl}
                  alt={latest.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                  className="object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
                />
                {/* Dégradé doux cinématographique */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0b1f4b]/85 via-transparent to-black/20 pointer-events-none" />

                {/* Badge supérieur "À la une ⭐" */}
                <div className="absolute top-5 start-5 z-10">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-bold uppercase tracking-[0.14em] bg-[#0b1f4b]/90 text-[#e3c776] border border-white/20 backdrop-blur-md shadow-sm">
                    <span className="text-[12px]">⭐</span>
                    <span>{ar ? "في الصدارة" : "À la une"}</span>
                  </span>
                </div>

                {/* Badge institutionnel inférieur intégré à la photo */}
                <div className="absolute bottom-5 start-5 end-5 z-10 flex items-center justify-between text-white/95">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/15 text-xs shadow-xs">
                    <AneiLogo locale={locale} variant="mark" withText={false} height={18} className="brightness-125" />
                    <span className="font-semibold text-[12px] tracking-wide text-white">
                      {ar ? "الأكاديمية الوطنية" : "Académie ANEI"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/90 font-medium bg-black/45 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/15 shadow-xs">
                    <Calendar size={13} className="text-[#e3c776] shrink-0" />
                    <time dateTime={latest.date.toISOString()} className="font-sans font-semibold">
                      {formatDate(latest.date, locale)}
                    </time>
                  </div>
                </div>
              </div>

              {/* Colonne de texte éditoriale fluide & prestigieuse */}
              <div className="lg:col-span-7 xl:col-span-6 p-7 sm:p-10 xl:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#b8923a]/12 text-[#b8923a] border border-[#b8923a]/30">
                    {latest.tag}
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {ar ? "إصدار رسمي معتمد" : "Publication officielle"}
                  </span>
                </div>

                <h2
                  id="latest-news-title"
                  className="text-2xl sm:text-3xl xl:text-[32px] font-sans font-bold text-[#0b1f4b] leading-[1.22] mb-4 group-hover:text-[#1b3a7a] transition-colors duration-200"
                >
                  <Link
                    href={`/${locale}/actualites/${latest.slug}`}
                    className="hover:underline decoration-[#b8923a]/40 underline-offset-4"
                  >
                    {latest.title}
                  </Link>
                </h2>

                <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8 font-normal line-clamp-3 sm:line-clamp-4">
                  {latest.excerpt}
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Link
                    href={`/${locale}/actualites/${latest.slug}`}
                    className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#0b1f4b] hover:bg-[#1b3a7a] text-white text-sm font-semibold transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 group/btn"
                  >
                    <span>{text.readLatest}</span>
                    <ArrowRight
                      size={16}
                      strokeWidth={2}
                      className="transition-transform duration-200 group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1 rtl:rotate-180"
                    />
                  </Link>

                  {latest.category === "CERTIFICATION" && (
                    <Link
                      href={`/${locale}/avs`}
                      className="inline-flex items-center gap-2 px-5 py-3 sm:py-3.5 rounded-full bg-[#f8faff] hover:bg-[#eef4fc] text-[#0b1f4b] border border-[#dde9f8] hover:border-[#b8923a]/40 text-sm font-semibold transition-all duration-200"
                    >
                      <span>{ar ? "دليل كفاءات AVS ←" : "Consulter le Référentiel AVS →"}</span>
                    </Link>
                  )}

                  {latest.category === "FORMATION" && (
                    <Link
                      href={`/${locale}/formations/${latest.slug.replace(/^formation-/, "")}`}
                      className="inline-flex items-center gap-2 px-5 py-3 sm:py-3.5 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-[#0b1f4b] border border-amber-600/30 text-sm font-semibold transition-all duration-200"
                    >
                      <span>{ar ? "اكتشف الدورة مباشرة ←" : "Découvrir la formation →"}</span>
                    </Link>
                  )}

                  {latest.category === "EVENEMENT" && (
                    <Link
                      href={`/${locale}/webinaires`}
                      className="inline-flex items-center gap-2 px-5 py-3 sm:py-3.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-[#0b1f4b] border border-sky-600/30 text-sm font-semibold transition-all duration-200"
                    >
                      <span>{ar ? "الانضمام للندوة مباشرة ←" : "Accéder aux webinaires →"}</span>
                    </Link>
                  )}
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
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? "bg-[#0b1f4b] text-white shadow-xs font-bold"
                        : "bg-white text-slate-600 hover:text-[#0b1f4b] hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300"
                    }`}
                  >
                    {ar ? cat.ar : cat.fr}
                  </Link>
                );
              })}
            </div>

            {/* Liste éditoriale des articles */}
            {updates.length ? (
              <div className="space-y-4">
                {updates.map((item) => (
                  <article key={item.id} className="rounded-2xl border border-slate-200/80 bg-white hover:border-[#b8923a]/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 overflow-hidden">
                    <Link
                      href={`/${locale}/actualites/${item.slug}`}
                      className="group flex flex-col md:flex-row md:items-center justify-between gap-5 p-5 sm:p-6 text-inherit no-underline"
                      aria-label={ar ? `اقرأ: ${item.title}` : `Lire : ${item.title}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5 flex-1 min-w-0">
                        <div className="relative w-full sm:w-52 h-36 sm:h-32 rounded-xl overflow-hidden shrink-0 bg-slate-100 shadow-2xs">
                          <Image
                            src={item.coverImageUrl}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, 208px"
                            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                          />
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#b8923a] uppercase tracking-wide bg-[#b8923a]/10 border border-[#b8923a]/25">
                              {item.tag}
                            </span>
                            <span className="text-slate-300 text-xs">•</span>
                            <time dateTime={item.date.toISOString()} className="text-xs text-slate-500 font-medium font-sans">
                              {formatDate(item.date, locale)}
                            </time>
                          </div>
                          <h3 className="text-lg sm:text-xl font-sans font-bold text-[#0b1f4b] leading-snug group-hover:text-[#1b3a7a] transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-sm text-slate-600 leading-relaxed mt-2 line-clamp-2 font-normal">
                            {item.excerpt}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0b1f4b] group-hover:text-[#1b3a7a] shrink-0 self-start md:self-center mt-2 md:mt-0 px-4 py-2 rounded-full bg-slate-50 group-hover:bg-[#eef4fc] transition-colors">
                        <span>{ar ? "اقرأ المقال" : "Lire l'article"}</span>
                        <ArrowRight
                          size={15}
                          strokeWidth={2}
                          className="transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 rtl:rotate-180"
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
