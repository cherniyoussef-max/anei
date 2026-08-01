import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { courses, webinars, avsProfiles, resources, newsItems } from "@/lib/data";
import { formatDate, formatPrice, t } from "@/lib/i18n";
import { getCourseVisual } from "@/lib/visuals";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function HomeSections({ locale, liveStats }: { locale: Locale; liveStats: { courses: number; webinars: number; avs: number; resources: number } }) {
  const c = t(locale);
  const ar = locale === "ar";
  const stats = ar
    ? [{ value: liveStats.courses, label: "دورات منشورة" }, { value: liveStats.webinars, label: "ندوات" }, { value: liveStats.avs, label: "ملفات AVS معتمدة" }, { value: liveStats.resources, label: "موارد تربوية" }]
    : [{ value: liveStats.courses, label: "formations publiées" }, { value: liveStats.webinars, label: "webinaires" }, { value: liveStats.avs, label: "profils AVS certifiés" }, { value: liveStats.resources, label: "ressources pédagogiques" }];

  const categoryLabels: Record<string, { fr: string; ar: string }> = {
    education: { fr: "Fondamentaux", ar: "الأساسيات" },
    avs: { fr: "Accompagnement AVS", ar: "مرافقة AVS" },
    "special-needs": { fr: "Besoins spécifiques", ar: "الاحتياجات الخاصة" },
    teaching: { fr: "Pédagogie", ar: "البيداغوجيا" },
    communication: { fr: "Communication", ar: "التواصل" },
    family: { fr: "Famille & école", ar: "الأسرة والمدرسة" },
  };
  const categoryIcons: IconName[] = ["graduation", "users", "spark", "book", "mail", "shield"];
  const categories = [...new Set(courses.map((course) => course.category))].slice(0, 6);

  const pillars: { icon: IconName; fr: string; ar: string; frText: string; arText: string }[] = [
    { icon: "graduation", fr: "Parcours structurés", ar: "مسارات منظمة", frText: "Des objectifs clairs, des modules progressifs et une progression visible.", arText: "أهداف واضحة ووحدات متدرجة وتقدم يمكن متابعته." },
    { icon: "users", fr: "Ancré dans le terrain", ar: "مرتبط بالميدان", frText: "Des contenus pensés pour les professionnels, les familles et les acteurs de l’inclusion.", arText: "محتوى موجه للمهنيين والأسر وفاعلي التربية الدامجة." },
    { icon: "award", fr: "Reconnaissance des acquis", ar: "إثبات المكتسبات", frText: "Des certificats vérifiables et un historique d’apprentissage centralisé.", arText: "شهادات قابلة للتحقق وسجل تعلم مركزي." },
  ];

  return (
    <>
      <section className="stats-strip" aria-label={ar ? "أرقام المنصة" : "ANEI en chiffres"}><div className="container stats-grid">{stats.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div></section>

      <section className="section discovery-section"><div className="container">
        <div className="section-title-row"><SectionHeading eyebrow={ar ? "استكشف حسب المجال" : "Explorer par domaine"} title={ar ? "اختر نقطة البداية المناسبة" : "Trouvez le bon point de départ"} description={ar ? "مجالات واضحة تساعدك على الوصول إلى المسار الأقرب لدورك واحتياجاتك." : "Des domaines lisibles pour accéder rapidement aux parcours les plus pertinents pour votre rôle et vos besoins."}/><Link className="text-link desktop-only-link" href={`/${locale}/formations`}>{c.actions.browse}<Icon name="arrow" size={17}/></Link></div>
        <div className="category-grid">{categories.map((category, index) => { const label = categoryLabels[category]?.[locale] ?? category.replaceAll("-", " "); return <Link className="category-card" href={`/${locale}/formations?category=${encodeURIComponent(category)}`} key={category}><span><Icon name={categoryIcons[index] ?? "book"} size={21}/></span><div><strong>{label}</strong><small>{ar ? "عرض الدورات" : "Voir les formations"}</small></div><Icon name="chevron" size={18}/></Link>; })}</div>
      </div></section>

      <section className="section section-tint"><div className="container">
        <div className="section-title-row"><SectionHeading eyebrow={ar ? "التكوين" : "Se former"} title={ar ? "مسارات مصممة للممارسة" : "Des parcours conçus pour la pratique"} description={ar ? "محتوى منظم وعملي مع شهادات لكل فاعل في التربية الدامجة." : "Des contenus structurés, pratiques et certifiants pour chaque acteur de l’inclusion."}/><Link className="text-link desktop-only-link" href={`/${locale}/formations`}>{c.actions.browse}<Icon name="arrow" size={17}/></Link></div>
        <div className="course-grid compact-grid">{courses.slice(0, 3).map((course) => <article className="course-card course-card-human" key={course.slug}><div className="course-photo"><Image src={getCourseVisual(course.slug)} alt="" fill sizes="(max-width: 900px) 100vw, 33vw"/><span>{course.mode}</span></div><div className="course-card-body"><span className="course-category-label">{categoryLabels[course.category]?.[locale] ?? course.category}</span><h3>{course.title[locale]}</h3><p>{course.description[locale]}</p><div className="meta-row"><span><Icon name="clock" size={15}/>{course.duration}</span><span><Icon name="calendar" size={15}/>{formatDate(course.startDate, locale)}</span></div><div className="card-footer"><strong>{formatPrice(course.price, locale)}</strong><Link className="text-link" href={`/${locale}/formations/${course.slug}`}>{c.actions.details}<Icon name="arrow" size={16}/></Link></div></div></article>)}</div>
      </div></section>

      <section className="section"><div className="container"><SectionHeading eyebrow={ar ? "لماذا ANEI؟" : "Pourquoi ANEI"} title={ar ? "تعلم مهني واضح وموثوق" : "Une expérience d’apprentissage claire et crédible"} description={ar ? "نظام واحد يربط المعرفة بالممارسة والمتابعة وإثبات الإنجاز." : "Un même système relie connaissances, pratique, suivi de progression et reconnaissance des acquis."}/><div className="pillar-grid">{pillars.map((pillar) => <article className="pillar-item" key={pillar.fr}><span><Icon name={pillar.icon} size={22}/></span><h3>{ar ? pillar.ar : pillar.fr}</h3><p>{ar ? pillar.arText : pillar.frText}</p></article>)}</div></div></section>

      <section className="section human-story-section"><div className="container human-story-grid">
        <div className="human-story-photo"><Image src="/media/anei-learning-story.webp" alt={ar ? "متعلم يتابع برنامجًا تدريبيًا عبر الحاسوب" : "Apprenant engagé dans un parcours de formation en ligne"} fill sizes="(max-width: 900px) 100vw, 48vw"/><div className="human-story-label"><Icon name="spark" size={17}/><span>{ar ? "تعلم يركز على الإنسان" : "Une pédagogie centrée sur l’humain"}</span></div></div>
        <div className="human-story-copy"><span className="eyebrow">{ar ? "منصة مهنية، وليست مجرد كتالوج" : "Plus qu’un catalogue"}</span><h2>{ar ? "مساحة تساعدك على الفهم، التطبيق، ثم التقدم." : "Une expérience qui aide à comprendre, appliquer, puis progresser."}</h2><p>{ar ? "صُممت ANEI لتجعل كل خطوة واضحة: ماذا أتعلم، لماذا، كيف أطبقه، وما هي الخطوة التالية؟" : "ANEI est pensée pour rendre chaque étape lisible : qu’est-ce que j’apprends, pourquoi, comment je l’applique, et quelle est ma prochaine étape ?"}</p>
          <div className="human-story-points"><div><span>01</span><strong>{ar ? "تعلّم حسب دورك" : "Apprendre selon son rôle"}</strong><p>{ar ? "مسارات للمدرسين وAVS والأخصائيين والأسر." : "Des parcours pour enseignants, AVS, spécialistes et familles."}</p></div><div><span>02</span><strong>{ar ? "تطبيق عملي" : "Passage à la pratique"}</strong><p>{ar ? "أهداف ووحدات وموارد مرتبطة بالميدان." : "Objectifs, modules et ressources reliés au terrain."}</p></div><div><span>03</span><strong>{ar ? "تقدم قابل للمتابعة" : "Progression visible"}</strong><p>{ar ? "حفظ التقدم وشهادات وموارد في مساحة واحدة." : "Progression, certificats et ressources centralisés."}</p></div></div>
          <Link className="btn btn-primary" href={`/${locale}/about`}>{ar ? "اكتشف رؤيتنا" : "Découvrir notre approche"}<Icon name="arrow" size={17}/></Link>
        </div>
      </div></section>

      <section className="section section-tint"><div className="container webinar-feature">
        <div><SectionHeading eyebrow={ar ? "مباشر" : "En direct"} title={ar ? "تعلم يبقى متصلًا بالممارسات" : "Rester connecté aux pratiques"} description={ar ? "تبادل مع المختصين واطرح أسئلتك واسترجع التسجيلات في مساحتك." : "Échangez avec des spécialistes, posez vos questions et retrouvez les replays dans votre espace."}/><Link className="btn btn-secondary" href={`/${locale}/webinaires`}>{c.nav.webinars}<Icon name="arrow" size={18}/></Link></div>
        <div className="webinar-stack">{webinars.slice(0, 2).map((webinar, index) => <article className={index === 0 ? "webinar-card active" : "webinar-card"} key={webinar.id}><div className="date-tile"><strong>{new Date(webinar.date).getDate()}</strong><span>{new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { month: "short" }).format(new Date(webinar.date))}</span></div><div><span className="status-pill">{index === 0 ? (ar ? "البث القادم" : "Prochain live") : (ar ? "قريبًا" : "À venir")}</span><h3>{webinar.title[locale]}</h3><p>{webinar.trainer} · {webinar.time}</p></div><Link className="icon-button" href={`/${locale}/webinaires`} aria-label={ar ? "عرض الندوات" : "Voir les webinaires"}><Icon name="chevron" size={20}/></Link></article>)}</div>
      </div></section>

      <section className="section"><div className="container"><div className="section-title-row"><SectionHeading eyebrow={ar ? "شبكة معتمدة" : "Réseau certifié"} title={ar ? "اعثر على AVS بالقرب منك" : "Trouver un AVS près de vous"} description={ar ? "ملفات مهنية مدرّبة ومعتمدة يمكن البحث فيها حسب الجهة والاختصاص." : "Des profils formés et certifiés par l’Académie, consultables par région et spécialité."}/><Link className="text-link desktop-only-link" href={`/${locale}/avs`}>{c.actions.browse}<Icon name="arrow" size={17}/></Link></div><div className="avs-grid home-avs-grid">{avsProfiles.slice(0, 3).map((profile) => <article className="avs-card" key={profile.id}><div className="avs-avatar">{profile.initials}</div><div className="avs-card-main"><div className="avs-name-row"><h3>{profile.name}</h3><span className="certified"><Icon name="check" size={13}/>{ar ? "معتمد" : "Certifié"}</span></div><p className="avs-specialty">{profile.specialty[locale]}</p><div className="meta-row"><span><Icon name="map" size={15}/>{profile.city[locale]}</span></div></div></article>)}</div></div></section>

      <section className="section library-highlight"><div className="container library-grid"><div className="library-copy"><span className="eyebrow">{ar ? "المكتبة الرقمية" : "Bibliothèque numérique"}</span><h2>{ar ? "موارد عملية، جاهزة للاستخدام." : "Des ressources pratiques, prêtes à l’emploi."}</h2><p>{ar ? "أدلة وشبكات وبطاقات ووسائط لتسهيل الملاحظة والمرافقة والتعاون." : "Guides, grilles, fiches et supports conçus pour faciliter l’observation, l’accompagnement et la coopération."}</p><Link className="btn btn-light" href={`/${locale}/bibliotheque`}>{c.nav.library}<Icon name="arrow" size={18}/></Link></div><div className="resource-mini-grid">{resources.slice(0, 3).map((resource) => <div className="resource-mini" key={resource.id}><span className="resource-type"><Icon name="book" size={18}/></span><h3>{resource.title[locale]}</h3><span>{formatPrice(resource.price, locale)}</span></div>)}</div></div></section>

      <section className="section"><div className="container"><div className="section-title-row"><SectionHeading eyebrow={ar ? "الأخبار" : "Actualités"} title={ar ? "آخر مستجدات الأكاديمية" : "Ce qui évolue à l’Académie"}/><Link className="text-link desktop-only-link" href={`/${locale}/actualites`}>{c.actions.browse}<Icon name="arrow" size={17}/></Link></div><div className="news-grid">{newsItems.map((item) => <article className="news-card" key={item.id}><span className="news-tag">{item.tag[locale]}</span><h3>{item.title[locale]}</h3><p>{item.excerpt[locale]}</p><div className="news-footer"><time>{formatDate(item.date, locale)}</time><Link className="icon-button" href={`/${locale}/actualites/actualite-${item.id}`} aria-label={ar ? "قراءة الخبر" : "Lire l’actualité"}><Icon name="arrow" size={18}/></Link></div></article>)}</div></div></section>

      <section className="section cta-wrap"><div className="container"><div className="cta-panel"><div><span className="eyebrow light">{ar ? "مسار مهني أوضح" : "Progresser avec méthode"}</span><h2>{ar ? "ابدأ مسارك التالي بثقة." : "Construisez votre prochain parcours avec confiance."}</h2><p>{ar ? "أنشئ حسابك واجمع دوراتك ومواردك وشهاداتك في مساحة تعلم واحدة." : "Créez votre compte et centralisez formations, ressources et certificats dans un seul espace d’apprentissage."}</p></div><Link className="btn btn-light btn-lg" href={`/${locale}/register`}>{c.actions.register}<Icon name="arrow" size={18}/></Link></div></div></section>
    </>
  );
}
