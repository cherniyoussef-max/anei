import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";

type HeroContent = {
  kicker: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchAction: string;
  imageAlt: string;
  productPreviewAlt: string;
  missionTitle: string;
  missionBody: string;
  pillarsLabel: string;
  pillars: Array<{ icon: IconName; title: string; body: string }>;
};

const heroContent: Record<Locale, HeroContent> = {
  en: {
    kicker: "INCLUSIVE EDUCATION IN PRACTICE",
    title: "Together, for stronger inclusive education.",
    body: "Bilingual learning, practical resources and human support for everyone involved in inclusion.",
    primary: "Discover our courses",
    secondary: "Understand ANEI",
    searchLabel: "Search ANEI courses",
    searchPlaceholder: "What skill do you want to develop?",
    searchAction: "Search",
    imageAlt: "Education professionals taking part in an ANEI training session",
    productPreviewAlt: "Preview of the ANEI course catalog",
    missionTitle: "Our mission",
    missionBody: "Make inclusive education applicable every day.",
    pillarsLabel: "ANEI commitments",
    pillars: [
      { icon: "book", title: "Structured learning", body: "Clear pathways for every professional role." },
      { icon: "spark", title: "Useful resources", body: "Methods and tools connected to field practice." },
      { icon: "users", title: "Human support", body: "Webinars, specialists and a certified AVS network." },
    ],
  },
  fr: {
    kicker: "L’ÉDUCATION INCLUSIVE, EN PRATIQUE",
    title: "Ensemble, pour une éducation inclusive plus forte.",
    body: "Formations bilingues, ressources concrètes et accompagnement humain pour chaque acteur de l’inclusion.",
    primary: "Découvrir nos parcours",
    secondary: "Comprendre ANEI",
    searchLabel: "Rechercher dans les formations ANEI",
    searchPlaceholder: "Quelle compétence souhaitez-vous développer ?",
    searchAction: "Rechercher",
    imageAlt: "Équipe éducative participant à une session de formation ANEI",
    productPreviewAlt: "Aperçu du catalogue de formations ANEI",
    missionTitle: "Notre mission",
    missionBody: "Rendre l’éducation inclusive applicable, chaque jour.",
    pillarsLabel: "Engagements ANEI",
    pillars: [
      { icon: "book", title: "Parcours structurés", body: "Des apprentissages lisibles pour chaque rôle." },
      { icon: "spark", title: "Ressources utiles", body: "Des méthodes et outils reliés au terrain." },
      { icon: "users", title: "Accompagnement humain", body: "Webinaires, spécialistes et réseau AVS certifié." },
    ],
  },
  ar: {
    kicker: "التربية الدامجة في الممارسة",
    title: "معًا، من أجل تربية دامجة أكثر قوة.",
    body: "تكوين ثنائي اللغة وموارد عملية ومرافقة إنسانية لكل فاعل في مجال الدمج.",
    primary: "اكتشف مساراتنا",
    secondary: "تعرّف على ANEI",
    searchLabel: "البحث في دورات ANEI",
    searchPlaceholder: "ما المهارة التي تريد تطويرها؟",
    searchAction: "بحث",
    imageAlt: "مهنيات في التربية يشاركن في جلسة تكوين لدى ANEI",
    productPreviewAlt: "لقطة من كتالوج دورات ANEI",
    missionTitle: "مهمتنا",
    missionBody: "جعل التربية الدامجة قابلة للتطبيق كل يوم.",
    pillarsLabel: "التزامات ANEI",
    pillars: [
      { icon: "book", title: "مسارات منظمة", body: "تعلم واضح يناسب كل دور مهني." },
      { icon: "spark", title: "موارد عملية", body: "أساليب وأدوات مرتبطة بالميدان." },
      { icon: "users", title: "مرافقة إنسانية", body: "ندوات ومختصون وشبكة AVS معتمدة." },
    ],
  },
};

export function HomeHero({ locale }: { locale: Locale }) {
  const content = heroContent[locale];

  return (
    <section className="public-hero" aria-labelledby="public-hero-title">
      <div className="container public-hero-grid">
        <div className="hero-copy">
          <span className="reference-hero-kicker">{content.kicker}</span>
          <h1 id="public-hero-title">{content.title}</h1>
          <p>{content.body}</p>
          <form className="home-course-search" action={`/${locale}/formations`} method="get" role="search">
            <label className="sr-only" htmlFor="home-course-search">{content.searchLabel}</label>
            <Icon name="search" size={20} />
            <input id="home-course-search" name="q" maxLength={100} autoComplete="off" placeholder={content.searchPlaceholder} />
            <button type="submit">{content.searchAction}<Icon className="directional-icon" name="arrow" size={17} /></button>
          </form>
          <div className="hero-actions public-hero-actions">
            <Link className="btn btn-primary btn-lg" href={`/${locale}/formations`}>
              {content.primary}<Icon className="directional-icon" name="arrow" size={19} />
            </Link>
            <Link className="btn btn-ghost btn-lg" href={`/${locale}/about`}>{content.secondary}</Link>
          </div>
        </div>

        <figure className="public-hero-figure">
          <div className="public-hero-photo">
            <Image
              src="/media/anei-hero-learning.webp"
              alt={content.imageAlt}
              width={1200}
              height={900}
              priority
              loading="eager"
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 48vw, 640px"
            />
            <figcaption className="reference-mission-card">
              <span><Icon name="spark" size={23} /></span>
              <div><strong>{content.missionTitle}</strong><p>{content.missionBody}</p></div>
            </figcaption>
            <div className="reference-product-preview">
              <div className="reference-product-preview-bar" aria-hidden="true"><span /><span /><span /></div>
              <Image
                src="/media/anei-product-preview.webp"
                alt={content.productPreviewAlt}
                width={960}
                height={472}
                sizes="272px"
              />
            </div>
          </div>
        </figure>
      </div>

      <div className="container reference-pillars" aria-label={content.pillarsLabel}>
        {content.pillars.map((pillar) => (
          <article key={pillar.title}>
            <span><Icon name={pillar.icon} size={27} /></span>
            <div><strong>{pillar.title}</strong><p>{pillar.body}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
