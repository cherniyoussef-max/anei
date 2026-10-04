import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { isLocale } from "@/lib/i18n";
import { env } from "@/server/env";
import { YoutubePlayer } from "@/components/learning/YoutubePlayer";
import "./about-page.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const title = locale === "ar"
    ? "عن الأكاديمية"
    : locale === "fr"
      ? "À propos de l’Académie"
      : "About the Academy";
  const description = locale === "ar"
    ? "تعرّف على منهجية ANEI في تحويل مبادئ التربية الدامجة إلى تكوين وموارد وممارسات مهنية قابلة للتطبيق."
    : locale === "fr"
      ? "Découvrez comment ANEI transforme les principes de l’éducation inclusive en formations, ressources et pratiques professionnelles applicables."
      : "See how ANEI turns inclusive education principles into practical professional learning, resources and support.";

  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}/about`,
      languages: { en: "/en/about", ar: "/ar/about", fr: "/fr/about", "x-default": "/en/about" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "ar" ? "ar_TN" : locale === "fr" ? "fr_FR" : "en_US",
      images: [{
        url: "/media/about-field-scene.webp",
        width: 1200,
        height: 900,
        alt: locale === "ar" ? "تكوين مهني دامج من ANEI" : locale === "fr" ? "Formation professionnelle inclusive avec ANEI" : "Inclusive professional learning with ANEI",
      }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/media/about-field-scene.webp"] },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ar = locale === "ar";
  const en = locale === "en";
  const t = (english: string, french: string, arabic: string) => (ar ? arabic : en ? english : french);

  const heroCopy = {
    kicker: t("About the Academy", "À propos de l’Académie", "عن الأكاديمية"),
    title: t("Inclusion, in practice.", "L’inclusion, en pratique.", "التربية الدامجة، في الممارسة."),
    lead: t(
      "ANEI trains, equips and connects professionals and families supporting diverse learning journeys every day.",
      "ANEI forme, outille et relie les professionnels et les familles qui accompagnent chaque jour des parcours éducatifs singuliers.",
      "تكوّن ANEI المهنيين والأسر وتزوّدهم بالأدوات وتربط بينهم لمرافقة مسارات تعليمية متنوعة كل يوم.",
    ),
    primaryCta: t("Explore courses", "Découvrir les formations", "اكتشف الدورات"),
    secondaryCta: t("Contact ANEI", "Contacter ANEI", "تواصل مع ANEI"),
    imageAlt: t(
      "Inclusive education care team collaborating with children around a work table",
      "Équipe éducative inclusive pluridisciplinaire collaborant autour d’une table avec deux enfants",
      "فريق تربوي دامج متعدد التخصصات يتعاون حول طاولة عمل مع طفلين",
    ),
  };

  const methodHeader = {
    kicker: t("Our Approach", "Notre Démarche", "منهجيتنا"),
    title: t(
      "From knowledge to action, with people at the centre.",
      "Du savoir à l’action, avec l’humain au centre.",
      "من المعرفة إلى الفعل، والإنسان في المركز.",
    ),
    lead: t(
      "ANEI brings together continuous learning, professional resources and human support so inclusive practice can take root in everyday work.",
      "ANEI réunit formation continue, ressources professionnelles et accompagnement humain pour ancrer les pratiques inclusives dans le travail quotidien.",
      "تجمع ANEI بين التكوين المستمر والموارد المهنية والمرافقة الإنسانية لترسيخ الممارسات الدامجة في العمل اليومي.",
    ),
    pathwayBadge: t(
      "3-step progressive learning pathway",
      "Parcours progressif en 3 étapes",
      "مسار تعليمي متدرج من 3 مراحل",
    ),
  };

  const method = [
    {
      step: "01",
      icon: "eye" as const,
      title: t("Understand", "Comprendre", "الفهم"),
      text: t(
        "Build a shared understanding of needs, roles and inclusive practice.",
        "Construire une compréhension commune des besoins, des rôles et des pratiques inclusives.",
        "بناء فهم مشترك للاحتياجات والأدوار والممارسات الدامجة.",
      ),
    },
    {
      step: "02",
      icon: "book" as const,
      title: t("Put it into practice", "Mettre en œuvre", "التطبيق"),
      text: t(
        "Use clear methods and resources in real educational situations.",
        "Mobiliser des méthodes claires et des ressources utiles dans les situations éducatives réelles.",
        "استخدام أساليب واضحة وموارد عملية في المواقف التربوية الحقيقية.",
      ),
    },
    {
      step: "03",
      icon: "chart" as const,
      title: t("Progress together", "Progresser ensemble", "التقدم معًا"),
      text: t(
        "Observe, exchange and improve practice with the people involved.",
        "Observer, échanger et améliorer les pratiques avec les personnes concernées.",
        "الملاحظة وتبادل الخبرات وتحسين الممارسات مع جميع الأطراف المعنية.",
      ),
    },
  ];

  const fieldCopy = {
    kicker: t("Field-proven", "Ancrage Professionnel", "ترسيخ مهني"),
    title: t(
      "A method built for real situations.",
      "Une méthode pensée pour le terrain.",
      "منهجية مصممة للواقع الميداني.",
    ),
    lead: t(
      "The challenge is not only to know what inclusion means. It is to decide, coordinate and act with confidence when situations are complex.",
      "L’enjeu n’est pas seulement de connaître les principes de l’inclusion. Il faut pouvoir décider, coordonner et agir avec justesse lorsque les situations sont complexes.",
      "لا يكفي فهم مبادئ الدمج. الأهم هو القدرة على اتخاذ القرار والتنسيق والعمل بثقة عندما تكون المواقف معقدة.",
    ),
    sceneAlt: t(
      "3D educators collaborating around inclusive tactile and digital learning tools",
      "Éducateurs en 3D collaborant autour d’outils pédagogiques inclusifs tactiles et numériques",
      "تربويون بتقنية 3D يتعاونون حول وسائل تعليمية دامجة لمسية ورقمية",
    ),
    points: [
      {
        icon: "graduation" as const,
        strong: t("Professional learning", "Formation professionnelle", "تكوين مهني"),
        span: t(
          "Structured pathways that connect concepts to practice.",
          "Des parcours structurés qui relient concepts et pratique.",
          "مسارات منظمة تربط المفاهيم بالممارسة.",
        ),
      },
      {
        icon: "book" as const,
        strong: t("Practical resources", "Ressources concrètes", "موارد عملية"),
        span: t(
          "Clear tools to prepare, observe and adapt.",
          "Des outils clairs pour préparer, observer et adapter.",
          "أدوات واضحة للتحضير والملاحظة والتكييف.",
        ),
      },
      {
        icon: "users" as const,
        strong: t("Shared professional language", "Langage professionnel partagé", "لغة مهنية مشتركة"),
        span: t(
          "Common reference points for better collaboration.",
          "Des repères communs pour mieux coopérer.",
          "مرجعيات مشتركة لتحسين التعاون.",
        ),
      },
    ],
  };

  const commitmentsHeader = {
    kicker: t("Core Values", "Engagements Éthiques", "التزامات أخلاقية"),
    title: t(
      "What guides every ANEI experience.",
      "Ce qui guide chaque expérience ANEI.",
      "ما يوجّه كل تجربة في ANEI.",
    ),
    lead: t(
      "Four commitments shape our courses, resources and professional support.",
      "Quatre engagements structurent nos formations, nos ressources et notre accompagnement professionnel.",
      "أربعة التزامات تنظّم دوراتنا ومواردنا ومرافقتنا المهنية.",
    ),
  };

  const commitments = [
    {
      num: "01",
      icon: "shield" as const,
      title: t("Dignity first", "La dignité avant tout", "الكرامة أولًا"),
      text: t(
        "Every educational decision begins with the person, their voice and their right to participate.",
        "Chaque décision éducative part de la personne, de sa parole et de son droit à participer.",
        "ينطلق كل قرار تربوي من الشخص وصوته وحقه في المشاركة.",
      ),
    },
    {
      num: "02",
      icon: "users" as const,
      title: t("Structured collaboration", "Une coopération structurée", "تعاون منظم"),
      text: t(
        "Families, schools and specialists work from clear roles and shared objectives.",
        "Familles, établissements et spécialistes avancent avec des rôles clairs et des objectifs partagés.",
        "تعمل الأسر والمؤسسات والمختصون ضمن أدوار واضحة وأهداف مشتركة.",
      ),
    },
    {
      num: "03",
      icon: "award" as const,
      title: t("Tools that can be used", "Des outils applicables", "أدوات قابلة للتطبيق"),
      text: t(
        "Knowledge becomes practical guidance that can support everyday professional decisions.",
        "Les connaissances deviennent des repères concrets pour guider les décisions professionnelles au quotidien.",
        "تتحول المعرفة إلى مرجع عملي يوجّه القرارات المهنية اليومية.",
      ),
    },
    {
      num: "04",
      icon: "check" as const,
      title: t("Educational rigour", "Une exigence pédagogique", "جودة تربوية"),
      text: t(
        "Content is organised to support understanding, application and continuous improvement.",
        "Les contenus sont structurés pour soutenir la compréhension, l’application et l’amélioration continue.",
        "يُنظّم المحتوى لدعم الفهم والتطبيق والتحسين المستمر.",
      ),
    },
  ];

  const ctaCopy = {
    title: t(
      "Start with the path that matches your role.",
      "Commencez par le parcours adapté à votre rôle.",
      "ابدأ بالمسار الأنسب لدورك.",
    ),
    lead: t(
      "Explore ANEI courses or speak with the team about your professional learning needs.",
      "Découvrez les formations ANEI ou échangez avec l’équipe sur vos besoins de développement professionnel.",
      "اكتشف دورات ANEI أو تحدّث مع الفريق حول احتياجاتك في التطوير المهني.",
    ),
    primary: t("Explore courses", "Découvrir les formations", "اكتشف الدورات"),
    secondary: t("Contact ANEI", "Contacter ANEI", "تواصل مع ANEI"),
  };

  return (
    <div className="about-academy">
      {/* ====================================================================
          1. Hero Section (Editorial Care Team Panel)
         ==================================================================== */}
      <section className="ah-about-hero" aria-labelledby="about-hero-heading">
        <div className="ah-container">
          <div className="ah-hero-grid">
            <div className="ah-hero-copy">
              <span className="ah-kicker">{heroCopy.kicker}</span>
              <h1 className="ah-hero-title" id="about-hero-heading">
                {heroCopy.title}
              </h1>
              <p className="ah-hero-lead">{heroCopy.lead}</p>
              <div className="ah-hero-actions">
                <Link href={`/${locale}/formations`} className="ah-btn ah-btn-primary">
                  <span>{heroCopy.primaryCta}</span>
                  <Icon name="arrow" size={16} className="directional-icon" />
                </Link>
                <Link href={`/${locale}/contact`} className="ah-btn ah-btn-outline">
                  {heroCopy.secondaryCta}
                </Link>
              </div>
            </div>

            <div className="ah-visual-col">
              <figure className="ah-editorial-stage">
                <div className="ah-editorial-frame">
                  <Image
                    src="/media/about-hero-team.webp"
                    alt={heroCopy.imageAlt}
                    width={1200}
                    height={900}
                    priority
                    sizes="(max-width: 900px) calc(100vw - 32px), 620px"
                    className="ah-editorial-img"
                    style={{ width: "100%", height: "auto", display: "block" }}
                  />
                  <span className="ah-editorial-gold-rule" aria-hidden="true" />
                </div>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. Method Section (From Knowledge to Action — Balanced)
         ==================================================================== */}
      <section className="ah-section" aria-labelledby="about-method-heading">
        <div className="ah-container">
          <div className="ah-section-header ah-method-header">
            <div className="ah-method-intro">
              <span className="ah-kicker">{methodHeader.kicker}</span>
              <h2 className="ah-section-title" id="about-method-heading">
                {methodHeader.title}
              </h2>
              <p className="ah-section-lead">{methodHeader.lead}</p>
            </div>
            <div className="ah-method-track-badge" aria-label={methodHeader.pathwayBadge}>
              <span className="ah-method-track-index" aria-hidden="true">01 · 02 · 03</span>
              <span className="ah-method-track-text">{methodHeader.pathwayBadge}</span>
            </div>
          </div>

          <div className="ah-method-grid">
            {method.map((item) => (
              <article key={item.step} className="ah-method-card">
                <div className="ah-method-card-head">
                  <span className="ah-method-step">{item.step}</span>
                  <span className="ah-method-icon">
                    <Icon name={item.icon} size={22} />
                  </span>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ====================================================================
          3. Field Section (3D Collaboration Scene + Structured Points)
         ==================================================================== */}
      <section className="ah-section is-tinted" aria-labelledby="about-field-heading">
        <div className="ah-container">
          <div className="ah-field-grid">
            <div className="ah-field-visual-col">
              <figure
                className="ah-field-stage"
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "580px",
                  aspectRatio: "4 / 3",
                  overflow: "hidden",
                  borderRadius: "20px",
                }}
              >
                <Image
                  src="/media/about-field-scene.webp"
                  alt={fieldCopy.sceneAlt}
                  width={1200}
                  height={900}
                  sizes="(max-width: 900px) calc(100vw - 32px), 580px"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </figure>
            </div>

            <div className="ah-field-copy">
              <div>
                <span className="ah-kicker">{fieldCopy.kicker}</span>
                <h2 className="ah-section-title" id="about-field-heading">
                  {fieldCopy.title}
                </h2>
                <p className="ah-section-lead">{fieldCopy.lead}</p>
              </div>

              <div className="ah-field-points">
                {fieldCopy.points.map((pt) => (
                  <div key={pt.strong} className="ah-field-item">
                    <span className="ah-field-item-icon">
                      <Icon name={pt.icon} size={20} />
                    </span>
                    <div className="ah-field-item-text">
                      <strong>{pt.strong}</strong>
                      <span>{pt.span}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. Commitments Section (What Guides Every Experience)
         ==================================================================== */}
      <section className="ah-section" aria-labelledby="about-commitments-heading">
        <div className="ah-container">
          <div className="ah-section-header">
            <span className="ah-kicker">{commitmentsHeader.kicker}</span>
            <h2 className="ah-section-title" id="about-commitments-heading">
              {commitmentsHeader.title}
            </h2>
            <p className="ah-section-lead">{commitmentsHeader.lead}</p>
          </div>

          <div className="ah-commitments-grid">
            {commitments.map((item) => (
              <article key={item.num} className="ah-commitment-card">
                <div className="ah-commitment-card-head">
                  <span className="ah-commitment-num">{item.num}</span>
                  <span className="ah-commitment-icon">
                    <Icon name={item.icon} size={20} />
                  </span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ====================================================================
          5. Video Section (Conditional YouTube Player)
         ==================================================================== */}
      {env.PLATFORM_INTRO_VIDEO_YOUTUBE_ID ? (
        <section className="ah-video-section" aria-labelledby="about-video-title">
          <div className="ah-container">
            <div className="ah-section-header">
              <span className="ah-kicker">
                {t("Presentation Video", "Vidéo de Présentation", "فيديو تقديمي")}
              </span>
              <h2 className="ah-section-title" id="about-video-title">
                {t(
                  "See ANEI Academy in two minutes.",
                  "Découvrez l’Académie ANEI en deux minutes.",
                  "اكتشف أكاديمية ANEI في دقيقتين.",
                )}
              </h2>
              <p className="ah-section-lead">
                {t(
                  "A short video presenting the platform, its courses and how it supports inclusive education in practice.",
                  "Une courte vidéo qui présente la plateforme, ses formations et son apport concret à l’éducation inclusive.",
                  "فيديو قصير يقدّم المنصة ودوراتها ومساهمتها العملية في التربية الدامجة.",
                )}
              </p>
            </div>
            <div className="ah-video-frame">
              <YoutubePlayer
                videoId={env.PLATFORM_INTRO_VIDEO_YOUTUBE_ID}
                title={t(
                  "ANEI Academy presentation video",
                  "Vidéo de présentation de l’Académie ANEI",
                  "فيديو تقديمي لأكاديمية ANEI",
                )}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ====================================================================
          6. Call to Action Banner
         ==================================================================== */}
      <section className="ah-cta-wrap" aria-labelledby="about-cta-heading">
        <div className="ah-container">
          <div className="ah-cta-panel">
            <div className="ah-cta-copy">
              <h2 id="about-cta-heading">{ctaCopy.title}</h2>
              <p>{ctaCopy.lead}</p>
            </div>
            <div className="ah-cta-actions">
              <Link href={`/${locale}/formations`} className="ah-btn ah-cta-btn-light">
                <span>{ctaCopy.primary}</span>
                <Icon name="arrow" size={16} className="directional-icon" />
              </Link>
              <Link href={`/${locale}/contact`} className="ah-btn ah-cta-btn-dark">
                {ctaCopy.secondary}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
