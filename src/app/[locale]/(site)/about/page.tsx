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
        url: "/media/anei-learning-path.webp",
        width: 1200,
        height: 900,
        alt: locale === "ar" ? "تكوين مهني دامج من ANEI" : locale === "fr" ? "Formation professionnelle inclusive avec ANEI" : "Inclusive professional learning with ANEI",
      }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/media/anei-learning-path.webp"] },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const ar = locale === "ar";
  const en = locale === "en";
  const t = (english: string, french: string, arabic: string) => ar ? arabic : en ? english : french;

  const method = [
    {
      title: t("Understand", "Comprendre", "الفهم"),
      text: t(
        "Build a shared understanding of needs, roles and inclusive practice.",
        "Construire une compréhension commune des besoins, des rôles et des pratiques inclusives.",
        "بناء فهم مشترك للاحتياجات والأدوار والممارسات الدامجة.",
      ),
    },
    {
      title: t("Put it into practice", "Mettre en œuvre", "التطبيق"),
      text: t(
        "Use clear methods and resources in real educational situations.",
        "Mobiliser des méthodes claires et des ressources utiles dans les situations éducatives réelles.",
        "استخدام أساليب واضحة وموارد عملية في المواقف التربوية الحقيقية.",
      ),
    },
    {
      title: t("Progress together", "Progresser ensemble", "التقدم معًا"),
      text: t(
        "Observe, exchange and improve practice with the people involved.",
        "Observer, échanger et améliorer les pratiques avec les personnes concernées.",
        "الملاحظة وتبادل الخبرات وتحسين الممارسات مع جميع الأطراف المعنية.",
      ),
    },
  ];

  const commitments = [
    {
      title: t("Dignity first", "La dignité avant tout", "الكرامة أولًا"),
      text: t(
        "Every educational decision begins with the person, their voice and their right to participate.",
        "Chaque décision éducative part de la personne, de sa parole et de son droit à participer.",
        "ينطلق كل قرار تربوي من الشخص وصوته وحقه في المشاركة.",
      ),
    },
    {
      title: t("Structured collaboration", "Une coopération structurée", "تعاون منظم"),
      text: t(
        "Families, schools and specialists work from clear roles and shared objectives.",
        "Familles, établissements et spécialistes avancent avec des rôles clairs et des objectifs partagés.",
        "تعمل الأسر والمؤسسات والمختصون ضمن أدوار واضحة وأهداف مشتركة.",
      ),
    },
    {
      title: t("Tools that can be used", "Des outils applicables", "أدوات قابلة للتطبيق"),
      text: t(
        "Knowledge becomes practical guidance that can support everyday professional decisions.",
        "Les connaissances deviennent des repères concrets pour guider les décisions professionnelles au quotidien.",
        "تتحول المعرفة إلى مرجع عملي يوجّه القرارات المهنية اليومية.",
      ),
    },
    {
      title: t("Educational rigour", "Une exigence pédagogique", "جودة تربوية"),
      text: t(
        "Content is organised to support understanding, application and continuous improvement.",
        "Les contenus sont structurés pour soutenir la compréhension, l’application et l’amélioration continue.",
        "يُنظّم المحتوى لدعم الفهم والتطبيق والتحسين المستمر.",
      ),
    },
  ];

  return (
    <div className="about-v6">
      <section className="about-v6-hero" aria-labelledby="about-title">
        <div className="v5-container about-v6-hero-grid">
          <div className="about-v6-hero-copy">
            <h1 id="about-title">{t(
              "Inclusion, in practice.",
              "L’inclusion, en pratique.",
              "التربية الدامجة، في الممارسة.",
            )}</h1>
            <p>{t(
              "ANEI trains, equips and connects professionals and families supporting diverse learning journeys every day.",
              "ANEI forme, outille et relie les professionnels et les familles qui accompagnent chaque jour des parcours éducatifs singuliers.",
              "تكوّن ANEI المهنيين والأسر وتزوّدهم بالأدوات وتربط بينهم لمرافقة مسارات تعليمية متنوعة كل يوم.",
            )}</p>
            <div className="about-v6-actions">
              <Link className="about-v6-primary-action" href={`/${locale}/formations`}>
                <span>{t("Explore courses", "Découvrir les formations", "اكتشف الدورات")}</span>
                <Icon className="directional-icon" name="arrow" size={18} />
              </Link>
              <Link className="about-v6-secondary-action" href={`/${locale}/contact`}>
                {t("Contact ANEI", "Contacter ANEI", "تواصل مع ANEI")}
              </Link>
            </div>
          </div>

          <figure className="about-v6-hero-figure">
            <div className="about-v6-hero-media">
              <Image
                src="/media/anei-learning-path.webp"
                alt={t(
                  "A professional explores tactile Arabic and braille learning materials",
                  "Une professionnelle explore du matériel pédagogique tactile en arabe et en braille",
                  "متخصصة تستكشف وسائل تعليمية لمسية باللغة العربية وبطريقة برايل",
                )}
                fill
                priority
                sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1100px) 52vw, 640px"
              />
            </div>
            <figcaption>{t(
              "Learning designed to be understood, adapted and used.",
              "Des apprentissages conçus pour être compris, adaptés et utilisés.",
              "تعلّم مصمم للفهم والتكييف والتطبيق.",
            )}</figcaption>
          </figure>
        </div>
      </section>

      {env.PLATFORM_INTRO_VIDEO_YOUTUBE_ID ? (
        <section className="about-v6-video" aria-labelledby="about-video-title">
          <div className="v5-container about-v6-video-inner">
            <div className="about-v6-section-intro">
              <h2 id="about-video-title">{t(
                "See ANEI Academy in two minutes.",
                "Découvrez l’Académie ANEI en deux minutes.",
                "اكتشف أكاديمية ANEI في دقيقتين.",
              )}</h2>
              <p>{t(
                "A short video presenting the platform, its courses and how it supports inclusive education in practice.",
                "Une courte vidéo qui présente la plateforme, ses formations et son apport concret à l’éducation inclusive.",
                "فيديو قصير يقدّم المنصة ودوراتها ومساهمتها العملية في التربية الدامجة.",
              )}</p>
            </div>
            <div className="about-v6-video-frame">
              <YoutubePlayer videoId={env.PLATFORM_INTRO_VIDEO_YOUTUBE_ID} title={t("ANEI Academy presentation video", "Vidéo de présentation de l’Académie ANEI", "فيديو تقديمي لأكاديمية ANEI")} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="about-v6-method" aria-labelledby="about-method-title">
        <div className="v5-container">
          <div className="about-v6-section-intro">
            <h2 id="about-method-title">{t(
              "From knowledge to action, with people at the centre.",
              "Du savoir à l’action, avec l’humain au centre.",
              "من المعرفة إلى الفعل، والإنسان في المركز.",
            )}</h2>
            <p>{t(
              "ANEI brings together continuous learning, professional resources and human support so inclusive practice can take root in everyday work.",
              "ANEI réunit formation continue, ressources professionnelles et accompagnement humain pour ancrer les pratiques inclusives dans le travail quotidien.",
              "تجمع ANEI بين التكوين المستمر والموارد المهنية والمرافقة الإنسانية لترسيخ الممارسات الدامجة في العمل اليومي.",
            )}</p>
          </div>

          <div className="about-v6-method-grid">
            {method.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-v6-field" aria-labelledby="about-field-title">
        <div className="v5-container about-v6-field-grid">
          <figure className="about-v6-field-figure">
            <Image
              src="/media/anei-learning-story.webp"
              alt={t(
                "Professionals analyse inclusive learning materials together during a training session",
                "Des professionnels analysent ensemble des supports pédagogiques inclusifs pendant une formation",
                "مهنيون يحللون معًا وسائل تعليمية دامجة خلال جلسة تكوين",
              )}
              fill
              sizes="(max-width: 900px) calc(100vw - 40px), 52vw"
            />
          </figure>

          <div className="about-v6-field-copy">
            <h2 id="about-field-title">{t(
              "A method built for real situations.",
              "Une méthode pensée pour le terrain.",
              "منهجية مصممة للواقع الميداني.",
            )}</h2>
            <p>{t(
              "The challenge is not only to know what inclusion means. It is to decide, coordinate and act with confidence when situations are complex.",
              "L’enjeu n’est pas seulement de connaître les principes de l’inclusion. Il faut pouvoir décider, coordonner et agir avec justesse lorsque les situations sont complexes.",
              "لا يكفي فهم مبادئ الدمج. الأهم هو القدرة على اتخاذ القرار والتنسيق والعمل بثقة عندما تكون المواقف معقدة.",
            )}</p>
            <div className="about-v6-field-points">
              <div>
                <strong>{t("Professional learning", "Formation professionnelle", "تكوين مهني")}</strong>
                <span>{t("Structured pathways that connect concepts to practice.", "Des parcours structurés qui relient concepts et pratique.", "مسارات منظمة تربط المفاهيم بالممارسة.")}</span>
              </div>
              <div>
                <strong>{t("Practical resources", "Ressources concrètes", "موارد عملية")}</strong>
                <span>{t("Clear tools to prepare, observe and adapt.", "Des outils clairs pour préparer, observer et adapter.", "أدوات واضحة للتحضير والملاحظة والتكييف.")}</span>
              </div>
              <div>
                <strong>{t("Shared professional language", "Langage professionnel partagé", "لغة مهنية مشتركة")}</strong>
                <span>{t("Common reference points for better collaboration.", "Des repères communs pour mieux coopérer.", "مرجعيات مشتركة لتحسين التعاون.")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="about-v6-commitments" aria-labelledby="about-commitments-title">
        <div className="v5-container">
          <div className="about-v6-section-intro">
            <h2 id="about-commitments-title">{t(
              "What guides every ANEI experience.",
              "Ce qui guide chaque expérience ANEI.",
              "ما يوجّه كل تجربة في ANEI.",
            )}</h2>
            <p>{t(
              "Four commitments shape our courses, resources and professional support.",
              "Quatre engagements structurent nos formations, nos ressources et notre accompagnement professionnel.",
              "أربعة التزامات تنظّم دوراتنا ومواردنا ومرافقتنا المهنية.",
            )}</p>
          </div>
          <div className="about-v6-commitment-grid">
            {commitments.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="about-v6-next" aria-labelledby="about-next-title">
        <div className="v5-container about-v6-next-inner">
          <div>
            <h2 id="about-next-title">{t(
              "Start with the path that matches your role.",
              "Commencez par le parcours adapté à votre rôle.",
              "ابدأ بالمسار الأنسب لدورك.",
            )}</h2>
            <p>{t(
              "Explore ANEI courses or speak with the team about your professional learning needs.",
              "Découvrez les formations ANEI ou échangez avec l’équipe sur vos besoins de développement professionnel.",
              "اكتشف دورات ANEI أو تحدّث مع الفريق حول احتياجاتك في التطوير المهني.",
            )}</p>
          </div>
          <div className="about-v6-next-actions">
            <Link className="about-v6-light-action" href={`/${locale}/formations`}>
              <span>{t("Explore courses", "Découvrir les formations", "اكتشف الدورات")}</span>
              <Icon className="directional-icon" name="arrow" size={18} />
            </Link>
            <Link className="about-v6-dark-outline-action" href={`/${locale}/contact`}>
              {t("Contact ANEI", "Contacter ANEI", "تواصل مع ANEI")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
