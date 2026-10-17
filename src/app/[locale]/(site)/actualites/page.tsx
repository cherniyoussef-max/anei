import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsletterForm } from "@/components/interactive/NewsletterForm";
import { Icon } from "@/components/ui/Icon";
import { newsItems as translations } from "@/lib/data";
import { formatDate, isLocale } from "@/lib/i18n";
import { getPublishedNews } from "@/server/queries/news";
import { publicDataOr } from "@/server/queries/public-fallback";
import "./news-page.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ar" ? "أخبار الأكاديمية" : locale === "fr" ? "Actualités de l’Académie" : "Academy news";
  const description = locale === "ar"
    ? "تابع أحدث دورات ANEI وفعالياتها ومواردها وشراكاتها المهنية."
    : locale === "fr"
      ? "Suivez les nouvelles formations, les événements, les ressources et les partenariats professionnels de l’ANEI."
      : "Follow ANEI courses, events, resources and professional partnerships.";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/actualites`,
      languages: { en: "/en/actualites", fr: "/fr/actualites", ar: "/ar/actualites", "x-default": "/en/actualites" },
    },
    openGraph: { title, description, type: "website", locale: locale === "ar" ? "ar_TN" : locale === "fr" ? "fr_FR" : "en_US" },
    twitter: { card: "summary", title, description },
  };
}

export default async function NewsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ar = locale === "ar";
  const en = locale === "en";
  const items = await publicDataOr("news", getPublishedNews, []);
  const localizedItems = items.map((item, index) => {
    const translated = translations[index];
    return {
      ...item,
      tag: ar ? item.tagAr : en ? translated?.tag.en ?? item.tagFr : item.tagFr,
      title: ar ? item.titleAr : en ? translated?.title.en ?? item.titleFr : item.titleFr,
      excerpt: ar ? item.excerptAr : en ? translated?.excerpt.en ?? item.excerptFr : item.excerptFr,
      date: item.publishedAt ?? item.createdAt,
    };
  });
  const [latest, ...updates] = localizedItems;

  const text = {
    eyebrow: ar ? "أخبار ANEI" : en ? "ANEI news" : "Actualités ANEI",
    title: ar ? "ما يستجد في الأكاديمية." : en ? "What is new at the Academy." : "Ce qui évolue à l’Académie.",
    intro: ar
      ? "دورات وفعاليات وموارد وشراكات تساعد على تحويل التربية الدامجة إلى ممارسة يومية."
      : en
        ? "Courses, events, resources and partnerships that make inclusive education practical every day."
        : "Formations, événements, ressources et partenariats qui rendent l’éducation inclusive concrète au quotidien.",
    alertsTitle: ar ? "استقبل آخر المستجدات" : en ? "Receive the latest updates" : "Recevez les prochaines actualités",
    alertsCopy: ar
      ? "رسالة موجزة عند نشر دورة أو فعالية أو مورد جديد."
      : en
        ? "One concise email when a new course, event or resource is published."
        : "Un message concis lorsqu’une formation, un événement ou une ressource est publié.",
    latest: ar ? "أحدث خبر" : en ? "Latest update" : "Dernière actualité",
    readLatest: ar ? "اقرأ الخبر" : en ? "Read the update" : "Lire l’actualité",
    all: ar ? "جميع الأخبار" : en ? "All updates" : "Toutes les actualités",
    allCopy: ar ? "تابع آخر أخبار التكوين والموارد والشراكات." : en ? "Browse recent learning, resource and partnership updates." : "Retrouvez les dernières informations sur les formations, les ressources et les partenariats.",
    emptyTitle: ar ? "لا توجد أخبار منشورة حاليًا" : en ? "No updates have been published yet" : "Aucune actualité publiée pour le moment",
    emptyCopy: ar ? "اشترك ليصلك إشعار عند نشر أول خبر." : en ? "Subscribe to be notified when the first update is published." : "Abonnez-vous pour être informé dès la première publication.",
  };

  return (
    <div className="news-v7">
      <section className="news-v7-hero" aria-labelledby="news-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 news-v7-hero-grid">
          <div className="news-v7-intro">
            <nav aria-label="Fil d'Ariane" className="subpage-hero-breadcrumbs mb-3.5">
              <ol className="flex items-center gap-2 text-xs text-slate-500">
                <li>
                  <Link href={`/${locale}`} className="hover:text-[#142B47] transition-colors">
                    {ar ? "الرئيسية" : "Accueil"}
                  </Link>
                </li>
                <li className="text-slate-300 text-[11px]" aria-hidden="true">/</li>
                <li className="text-[#142B47] font-semibold">
                  {ar ? "الأخبار" : "Actualités"}
                </li>
              </ol>
            </nav>
            <div className="inline-flex items-center gap-2.5 mb-2">
              <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">{text.eyebrow}</span>
            </div>
            <h1 id="news-title" className="text-4xl sm:text-5xl font-sans font-bold tracking-tight text-[#142B47] leading-[1.15] max-w-2xl mt-2">{text.title}</h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mt-4 font-normal">{text.intro}</p>
          </div>

          <aside className="news-v7-alerts" aria-labelledby="news-alerts-title">
            <div className="news-v7-alert-icon" aria-hidden="true"><Icon name="bell" size={22} /></div>
            <div className="news-v7-alert-copy">
              <h2 id="news-alerts-title" className="font-sans font-bold text-base text-[#142B47]">{text.alertsTitle}</h2>
              <p>{text.alertsCopy}</p>
            </div>
            <NewsletterForm locale={locale} idSuffix="news" variant="expanded" />
          </aside>
        </div>
      </section>

      <section className="news-v7-content" aria-labelledby="latest-news-title">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {latest ? (() => {
            const cleanLatestTitle = latest.title.replace(/\s*-\s*rentrée 2026/gi, " — Rentrée 2026").replace(/\s*–\s*automne 2026/gi, " — Automne 2026");
            return (
              <article className="news-v7-lead grid grid-cols-1 md:grid-cols-12 rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden bg-white">
                {/* Panneau gauche bleu marine structuré avec badge, filigrane et date */}
                <div className="md:col-span-4 relative bg-[#142B47] text-white p-7 sm:p-8 flex flex-col justify-between overflow-hidden min-h-[260px] sm:min-h-[300px]">
                  {/* Motif filigrane subtil du logo ANEI au centre (opacité 5%) */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-5" aria-hidden="true">
                    <Image
                      src="/brand/watermark-master-duo.webp"
                      alt=""
                      width={192}
                      height={192}
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                  {/* Badge pilule doré "À LA UNE" en haut */}
                  <div className="relative z-10">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.14em] bg-[#B58D3D]/25 text-[#E5C158] border border-[#B58D3D]/40 backdrop-blur-xs">
                      {ar ? "في الصدارة" : en ? "Featured" : "À la une"}
                    </span>
                  </div>
                  {/* Date formatée proprement en bas avec icône calendrier */}
                  <div className="relative z-10 flex items-center gap-2 text-slate-200 text-xs font-medium pt-8">
                    <Icon name="calendar" size={15} className="text-[#E5C158] shrink-0" />
                    <time dateTime={latest.date.toISOString()} className="font-sans">
                      {formatDate(latest.date, locale)}
                    </time>
                  </div>
                </div>

                {/* Colonne droite avec padding équilibré p-8 lg:p-10 */}
                <div className="md:col-span-8 p-8 lg:p-10 flex flex-col justify-center">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#B58D3D] mb-2">{latest.tag}</span>
                  <h2 id="latest-news-title" className="text-2xl sm:text-3xl font-sans font-bold text-[#142B47] leading-tight mb-3">
                    <Link href={`/${locale}/actualites/${latest.slug}`} className="hover:text-[#1E3F66] transition-colors">
                      {cleanLatestTitle}
                    </Link>
                  </h2>
                  <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed mb-6 max-w-2xl">{latest.excerpt}</p>
                  <Link className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#142B47] hover:bg-[#1E3F66] text-white text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] w-fit" href={`/${locale}/actualites/${latest.slug}`}>
                    <span>{text.readLatest}</span>
                    <Icon className="directional-icon" name="arrow" size={16} />
                  </Link>
                </div>
              </article>
            );
          })() : (
            <div className="news-v7-empty">
              <h2 id="latest-news-title">{text.emptyTitle}</h2>
              <p>{text.emptyCopy}</p>
            </div>
          )}

          {updates.length ? (
            <div className="news-v7-feed mt-16 sm:mt-20" aria-labelledby="all-news-title">
              <header className="mb-8">
                <div className="inline-flex items-center gap-2.5 mb-2">
                  <span className="w-6 h-[1.5px] bg-[#B58D3D] shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B58D3D]">{ar ? "المستجدات" : "Mises à jour"}</span>
                </div>
                <h2 id="all-news-title" className="text-2xl sm:text-3xl font-sans font-bold text-[#142B47]">{text.all}</h2>
                <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed max-w-xl mt-1.5">{text.allCopy}</p>
              </header>
              <div className="divide-y divide-slate-100">
                {updates.map((item) => {
                  const cleanItemTitle = item.title.replace(/\s*-\s*rentrée 2026/gi, " — Rentrée 2026").replace(/\s*–\s*automne 2026/gi, " — Automne 2026");
                  return (
                    <article key={item.id} className="py-2 first:pt-0">
                      <Link
                        href={`/${locale}/actualites/${item.slug}`}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl p-5 -mx-5 hover:bg-slate-50/80 transition-all text-inherit no-underline"
                        aria-label={ar ? `اقرأ: ${cleanItemTitle}` : en ? `Read: ${cleanItemTitle}` : `Lire : ${cleanItemTitle}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
                          {/* Colonne gauche fixe w-40 shrink-0 */}
                          <div className="w-40 shrink-0 flex flex-col gap-1">
                            <span className="text-xs font-semibold text-[#B58D3D] uppercase tracking-wide">
                              {item.tag}
                            </span>
                            <time dateTime={item.date.toISOString()} className="text-xs text-slate-500 font-medium">
                              {formatDate(item.date, locale)}
                            </time>
                          </div>

                          {/* Titre et extrait */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg sm:text-xl font-sans font-semibold text-[#142B47] leading-snug group-hover:text-[#1E3F66] transition-colors">
                              {cleanItemTitle}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed mt-1 line-clamp-2">
                              {item.excerpt}
                            </p>
                          </div>
                        </div>

                        {/* Bouton flèche à droite qui se remplit en bleu marine au survol */}
                        <div className="w-10 h-10 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-500 shrink-0 group-hover:bg-[#142B47] group-hover:border-[#142B47] group-hover:text-white transition-all shadow-2xs">
                          <Icon className="directional-icon" name="arrow" size={16} />
                        </div>
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
