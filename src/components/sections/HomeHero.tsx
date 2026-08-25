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
  note: string;
  imageAlt: string;
  missionTitle: string;
  missionBody: string;
  pillarsLabel: string;
  pillars: Array<{ icon: IconName; title: string; body: string }>;
};

const heroContent: Record<Locale, HeroContent> = {
  en: {
    kicker: "SUPPORT • TRAIN • INCLUDE • TOGETHER",
    title: "Together, for stronger inclusive education.",
    body: "ANEI supports professionals and families in turning knowledge into precise, inclusive and humane practice.",
    primary: "Discover our courses",
    secondary: "Learn more",
    note: "Bilingual professional learning grounded in practice.",
    imageAlt: "Education professionals taking part in an ANEI training session",
    missionTitle: "Our mission",
    missionBody: "Make inclusive education applicable every day.",
    pillarsLabel: "ANEI commitments",
    pillars: [
      { icon: "users", title: "Support", body: "Stand alongside every person involved in inclusion." },
      { icon: "book", title: "Train", body: "Share concrete and reliable methods." },
      { icon: "spark", title: "Inspire", body: "Give people the confidence to act." },
      { icon: "shield", title: "Include", body: "Build accessible, lasting practices." },
    ],
  },
  fr: {
    kicker: "ACCOMPAGNER • FORMER • INCLURE • ENSEMBLE",
    title: "Ensemble, pour une éducation inclusive plus forte.",
    body: "ANEI accompagne les professionnels et les familles pour transformer les connaissances en pratiques inclusives, précises et humaines.",
    primary: "Découvrir nos parcours",
    secondary: "En savoir plus",
    note: "Une formation professionnelle bilingue, ancrée dans la pratique.",
    imageAlt: "Équipe éducative participant à une session de formation ANEI",
    missionTitle: "Notre mission",
    missionBody: "Rendre l’éducation inclusive applicable, chaque jour.",
    pillarsLabel: "Engagements ANEI",
    pillars: [
      { icon: "users", title: "Accompagner", body: "Être aux côtés de chaque acteur de l’inclusion." },
      { icon: "book", title: "Former", body: "Transmettre des méthodes concrètes et fiables." },
      { icon: "spark", title: "Inspirer", body: "Donner les clés pour agir avec confiance." },
      { icon: "shield", title: "Inclure", body: "Construire des pratiques accessibles et durables." },
    ],
  },
  ar: {
    kicker: "نرافق • نكوّن • ندمج • معًا",
    title: "معًا، من أجل تربية دامجة أكثر قوة.",
    body: "ترافق ANEI المهنيين والأسر لتحويل المعارف إلى ممارسات دامجة دقيقة وإنسانية.",
    primary: "اكتشف مساراتنا",
    secondary: "تعرّف علينا",
    note: "تكوين مهني ثنائي اللغة، مرتبط بالممارسة.",
    imageAlt: "مهنيات في التربية يشاركن في جلسة تكوين لدى ANEI",
    missionTitle: "مهمتنا",
    missionBody: "جعل التربية الدامجة قابلة للتطبيق كل يوم.",
    pillarsLabel: "التزامات ANEI",
    pillars: [
      { icon: "users", title: "نرافق", body: "نقف إلى جانب كل فاعل في مجال الدمج." },
      { icon: "book", title: "نكوّن", body: "ننقل أساليب عملية وموثوقة." },
      { icon: "spark", title: "نُلهم", body: "نمنح الأدوات اللازمة للعمل بثقة." },
      { icon: "shield", title: "ندمج", body: "نبني ممارسات متاحة ومستدامة." },
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
          <div className="hero-actions public-hero-actions">
            <Link className="btn btn-primary btn-lg" href={`/${locale}/formations`}>
              {content.primary}<Icon className="directional-icon" name="arrow" size={19} />
            </Link>
            <Link className="btn btn-ghost btn-lg" href={`/${locale}/about`}>{content.secondary}</Link>
          </div>
          <p className="reference-hero-note"><Icon name="shield" size={18} />{content.note}</p>
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
