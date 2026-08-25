import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsletterForm } from "@/components/interactive/NewsletterForm";
import { Icon } from "@/components/ui/Icon";
import { newsItems as translations } from "@/lib/data";
import { formatDate, isLocale } from "@/lib/i18n";
import { getPublishedNews } from "@/server/queries/news";
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
  const items = await getPublishedNews();
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
        <div className="v5-container news-v7-hero-grid">
          <div className="news-v7-intro">
            <span className="news-v7-eyebrow">{text.eyebrow}</span>
            <h1 id="news-title">{text.title}</h1>
            <p>{text.intro}</p>
          </div>

          <aside className="news-v7-alerts" aria-labelledby="news-alerts-title">
            <div className="news-v7-alert-icon" aria-hidden="true"><Icon name="bell" size={22} /></div>
            <div className="news-v7-alert-copy">
              <h2 id="news-alerts-title">{text.alertsTitle}</h2>
              <p>{text.alertsCopy}</p>
            </div>
            <NewsletterForm locale={locale} idSuffix="news" variant="expanded" />
          </aside>
        </div>
      </section>

      <section className="news-v7-content" aria-labelledby="latest-news-title">
        <div className="v5-container">
          {latest ? (
            <article className="news-v7-lead">
              <div className="news-v7-lead-meta">
                <span>{text.latest}</span>
                <time dateTime={latest.date.toISOString()}>{formatDate(latest.date, locale)}</time>
              </div>
              <div className="news-v7-lead-copy">
                <span className="news-v7-category">{latest.tag}</span>
                <h2 id="latest-news-title"><Link href={`/${locale}/actualites/${latest.slug}`}>{latest.title}</Link></h2>
                <p>{latest.excerpt}</p>
                <Link className="news-v7-read-link" href={`/${locale}/actualites/${latest.slug}`}>
                  <span>{text.readLatest}</span>
                  <Icon className="directional-icon" name="arrow" size={18} />
                </Link>
              </div>
            </article>
          ) : (
            <div className="news-v7-empty">
              <h2 id="latest-news-title">{text.emptyTitle}</h2>
              <p>{text.emptyCopy}</p>
            </div>
          )}

          {updates.length ? (
            <div className="news-v7-feed" aria-labelledby="all-news-title">
              <header>
                <h2 id="all-news-title">{text.all}</h2>
                <p>{text.allCopy}</p>
              </header>
              <div className="news-v7-list">
                {updates.map((item) => (
                  <article className="news-v7-item" key={item.id}>
                    <div className="news-v7-item-meta">
                      <span>{item.tag}</span>
                      <time dateTime={item.date.toISOString()}>{formatDate(item.date, locale)}</time>
                    </div>
                    <div className="news-v7-item-copy">
                      <h3><Link href={`/${locale}/actualites/${item.slug}`}>{item.title}</Link></h3>
                      <p>{item.excerpt}</p>
                    </div>
                    <Link className="news-v7-item-action" href={`/${locale}/actualites/${item.slug}`} aria-label={ar ? `اقرأ: ${item.title}` : en ? `Read: ${item.title}` : `Lire : ${item.title}`}>
                      <Icon className="directional-icon" name="arrow" size={19} />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
