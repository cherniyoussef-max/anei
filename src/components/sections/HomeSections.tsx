import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { courses as courseTranslations, webinars as webinarTranslations, avsProfiles as avsTranslations } from "@/lib/data";
import { formatDate, formatMillimes, t } from "@/lib/i18n";
import { courseVisuals } from "@/lib/visuals";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { listHomeAvs, listHomeCourses, listHomeResources, listHomeWebinars } from "@/server/queries/catalog";
import type { listHomeNews } from "@/server/queries/news";

type CourseRow = Awaited<ReturnType<typeof listHomeCourses>>[number];
type WebinarRow = Awaited<ReturnType<typeof listHomeWebinars>>[number];
type AvsRow = Awaited<ReturnType<typeof listHomeAvs>>[number];
type ResourceRow = Awaited<ReturnType<typeof listHomeResources>>[number];
type NewsRow = Awaited<ReturnType<typeof listHomeNews>>[number];
type Copy = { en: string; fr: string; ar: string };
type AudienceItem = { key: string; image: string; alt: Copy; title: Copy; body: Copy; role: string };

const tx = (locale: Locale, copy: Copy) => copy[locale];
const categories: Record<string, Copy> = {
  education: { en: "Foundations", fr: "Fondamentaux", ar: "الأساسيات" },
  avs: { en: "AVS support", fr: "Accompagnement AVS", ar: "مرافقة AVS" },
  "special-needs": { en: "Specific needs", fr: "Besoins spécifiques", ar: "الاحتياجات الخاصة" },
  teaching: { en: "Teaching practice", fr: "Pratiques pédagogiques", ar: "الممارسات البيداغوجية" },
  communication: { en: "Communication", fr: "Communication", ar: "التواصل" },
  family: { en: "Family and school", fr: "Famille et école", ar: "الأسرة والمدرسة" },
};
const modes: Record<string, Copy> = {
  online: { en: "Online", fr: "En ligne", ar: "عن بعد" },
  hybrid: { en: "Hybrid", fr: "Hybride", ar: "هجين" },
  onsite: { en: "On site", fr: "Présentiel", ar: "حضوري" },
};
const resourceTypes: Record<string, Copy> = {
  guide: { en: "Guide", fr: "Guide", ar: "دليل" },
  sheet: { en: "Practice sheet", fr: "Fiche pratique", ar: "بطاقة عملية" },
  checklist: { en: "Checklist", fr: "Liste de contrôle", ar: "قائمة تحقق" },
  template: { en: "Template", fr: "Modèle", ar: "نموذج" },
  toolkit: { en: "Toolkit", fr: "Boîte à outils", ar: "حقيبة أدوات" },
  video: { en: "Video", fr: "Vidéo", ar: "فيديو" },
  ebook: { en: "E-book", fr: "Livre numérique", ar: "كتاب رقمي" },
  article: { en: "Article", fr: "Article", ar: "مقال" },
  pdf: { en: "Document", fr: "Document", ar: "وثيقة" },
  document: { en: "Document", fr: "Document", ar: "وثيقة" },
};

function resourceTypeLabel(type: string, locale: Locale) {
  return resourceTypes[type.toLowerCase()]?.[locale] ?? (locale === "ar" ? "مورد عملي" : type);
}

function longDate(value: Date | null, locale: Locale) {
  return value ? new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" }).format(value) : "";
}

function AudienceCard({ item, locale }: { item: AudienceItem; locale: Locale }) {
  return <Link className={`audience-photo-card audience-${item.key}`} href={`/${locale}/register?role=${item.role}`}>
    <Image src={item.image} alt={tx(locale, item.alt)} fill sizes="(max-width: 767px) 92vw, 42vw" />
    <span className="audience-photo-scrim" aria-hidden="true" />
    <span className="audience-photo-copy"><strong>{tx(locale, item.title)}</strong><span>{tx(locale, item.body)}</span><span className="audience-action">{tx(locale, { en: "Open my route", fr: "Accéder à mon parcours", ar: "انتقل إلى مساري" })}<Icon className="directional-icon" name="arrow" size={18} /></span></span>
  </Link>;
}

export function HomeSections({ locale, courses, webinars, avsProfiles, resources, news }: {
  locale: Locale;
  courses: CourseRow[];
  webinars: WebinarRow[];
  avsProfiles: AvsRow[];
  resources: ResourceRow[];
  news: NewsRow[];
}) {
  const c = t(locale);
  const ar = locale === "ar";
  const en = locale === "en";
  resources = resources.map((resource) => ({ ...resource, type: resourceTypeLabel(resource.type, locale) }));
  const featuredCourses = courses.slice(0, 3);
  const audience: AudienceItem[] = [
    { key: "learner", image: "/media/anei-learning-path.webp", alt: { en: "Learners taking part in professional training", fr: "Des apprenants participant à une formation professionnelle", ar: "متعلمون يشاركون في تكوين مهني" }, title: { en: "Learners", fr: "Apprenants", ar: "المتعلمون" }, body: { en: "Follow courses, assessments and certificates in one focused space.", fr: "Suivez vos formations, évaluations et certificats dans un espace dédié.", ar: "تابع دوراتك وتقييماتك وشهاداتك في مساحة مخصصة." }, role: "learner" },
    { key: "family", image: "/media/anei-audience-families.webp", alt: { en: "A family working with an education professional", fr: "Une famille échangeant avec une professionnelle de l’éducation", ar: "أسرة تتعاون مع مختصة في التربية" }, title: { en: "Parents and families", fr: "Parents et familles", ar: "الأولياء والأسر" }, body: { en: "Access resources and follow a linked learner's progress.", fr: "Accédez aux ressources et suivez la progression d’un apprenant lié.", ar: "اطلع على الموارد وتابع تقدم المتعلم المرتبط بحسابك." }, role: "parent" },
    { key: "institution", image: "/media/anei-audience-institutions.webp", alt: { en: "An education organization planning professional learning", fr: "Une organisation éducative préparant un programme de formation", ar: "فريق مؤسسة تعليمية يخطط لبرنامج تكوين" }, title: { en: "Institutions and organizations", fr: "Établissements et organisations", ar: "المؤسسات والمنظمات" }, body: { en: "Build a learning partnership for your teams.", fr: "Construisez un partenariat de formation pour vos équipes.", ar: "ابنِ شراكة تكوين لفريق مؤسستك." }, role: "institution" },
  ];
  const professionalRoles = [
    { role: "teacher", icon: "book" as IconName, label: { en: "Educators", fr: "Enseignants", ar: "المدرسون" } },
    { role: "avs", icon: "shield" as IconName, label: { en: "AVS professionals", fr: "Professionnels AVS", ar: "مرافقو AVS" } },
    { role: "specialist", icon: "spark" as IconName, label: { en: "Specialists", fr: "Spécialistes", ar: "المختصون" } },
  ];
  const starts = [
    { icon: "graduation" as IconName, href: `/${locale}/formations`, title: { en: "Find a course", fr: "Trouver une formation", ar: "ابحث عن دورة" }, body: { en: "Compare published learning paths.", fr: "Comparez les parcours publiés.", ar: "قارن بين المسارات المنشورة." } },
    { icon: "shield" as IconName, href: `/${locale}/avs`, title: { en: "Find an AVS", fr: "Trouver un AVS", ar: "ابحث عن AVS" }, body: { en: "Search the public professional directory.", fr: "Consultez l’annuaire professionnel public.", ar: "تصفح الدليل المهني العام." } },
    { icon: "book" as IconName, href: `/${locale}/bibliotheque`, title: { en: "Use a resource", fr: "Consulter une ressource", ar: "استخدم موردًا" }, body: { en: "Browse practical tools and guides.", fr: "Parcourez les outils et guides pratiques.", ar: "تصفح الأدوات والأدلة العملية." } },
    { icon: "calendar" as IconName, href: `/${locale}/webinaires`, title: { en: "Join a webinar", fr: "Participer à un webinaire", ar: "شارك في ندوة" }, body: { en: "See upcoming sessions and replays.", fr: "Retrouvez les sessions et replays.", ar: "اطلع على الجلسات والتسجيلات." } },
  ];

  return <div className="home-overhaul">
    <section className="home-chapter audience-gateway" aria-labelledby="audience-title"><div className="container">
      <header className="home-section-heading"><h2 id="audience-title">{tx(locale, { en: "ANEI, for every role in inclusion", fr: "ANEI, pour chaque acteur de l’inclusion", ar: "ANEI لكل فاعل في مجال الدمج" })}</h2><p>{tx(locale, { en: "Choose the route that best matches your role today.", fr: "Choisissez le parcours qui correspond à votre rôle aujourd’hui.", ar: "اختر المسار الذي يناسب دورك اليوم." })}</p></header>
      <div className="audience-editorial-grid"><AudienceCard item={audience[0]} locale={locale} /><AudienceCard item={audience[1]} locale={locale} />
        <article className="audience-professional-card"><Image src="/media/anei-audience-professionals.webp" alt={tx(locale, { en: "Education professionals reviewing inclusive-learning resources", fr: "Des professionnels de l’éducation analysant des ressources inclusives", ar: "مهنيون في التربية يراجعون موارد للتعليم الدامج" })} fill sizes="(max-width: 767px) 92vw, 55vw" /><span className="audience-photo-scrim" aria-hidden="true" /><div className="audience-professional-copy"><h3>{tx(locale, { en: "Education professionals", fr: "Professionnels de l’éducation", ar: "مهنيّو التربية" })}</h3><p>{tx(locale, { en: "Train, share practice and access tools for your field role.", fr: "Formez-vous, partagez vos pratiques et accédez aux outils adaptés à votre rôle.", ar: "طوّر مهاراتك وشارك ممارساتك واستفد من أدوات تناسب دورك." })}</p><div className="professional-role-links">{professionalRoles.map((role) => <Link href={`/${locale}/register?role=${role.role}`} key={role.role}><Icon name={role.icon} size={18} /><span>{tx(locale, role.label)}</span><Icon className="directional-icon" name="chevron" size={17} /></Link>)}</div></div></article>
        <AudienceCard item={audience[2]} locale={locale} />
      </div>
    </div></section>

    <section className="home-chapter starting-point" aria-labelledby="starting-point-title"><div className="container starting-point-grid"><div className="starting-point-intro"><h2 id="starting-point-title">{tx(locale, { en: "What do you need today?", fr: "Que recherchez-vous aujourd’hui ?", ar: "ما الذي تبحث عنه اليوم؟" })}</h2><p>{tx(locale, { en: "Go straight to the right ANEI service without navigating the full site.", fr: "Accédez directement au service ANEI adapté à votre besoin.", ar: "انتقل مباشرة إلى خدمة ANEI التي تناسب احتياجك." })}</p></div><div className="starting-point-options">{starts.map((start) => <Link href={start.href} key={start.href}><span><Icon name={start.icon} size={21} /></span><span><strong>{tx(locale, start.title)}</strong><small>{tx(locale, start.body)}</small></span><Icon className="directional-icon" name="arrow" size={18} /></Link>)}</div></div></section>

    <section className="home-chapter featured-learning" aria-labelledby="featured-learning-title"><div className="container"><header className="home-section-heading with-action"><div><h2 id="featured-learning-title">{tx(locale, { en: "Learning built for practice", fr: "Des parcours conçus pour la pratique", ar: "مسارات مصممة للممارسة" })}</h2><p>{tx(locale, { en: "Published courses with clear format, duration and pricing.", fr: "Des formations publiées avec une durée, une modalité et un tarif clairement indiqués.", ar: "دورات منشورة مع مدة وصيغة وسعر واضح." })}</p></div><Link className="text-link" href={`/${locale}/formations`}>{c.actions.browse}<Icon className="directional-icon" name="arrow" size={17} /></Link></header>
      {featuredCourses.length ? <div className={`featured-course-grid count-${featuredCourses.length}`}>{featuredCourses.map((course, index) => {
        const translated = courseTranslations.find((item) => item.slug === course.slug);
        const title = ar ? course.titleAr : en ? translated?.title.en ?? course.titleFr : course.titleFr;
        const summary = ar ? course.summaryAr : en ? translated?.description.en ?? course.summaryFr : course.summaryFr;
        return <article className={index === 0 ? "home-course-card is-featured" : "home-course-card"} key={course.slug}><div className="home-course-media"><Image src={courseVisuals[(index + 1) % courseVisuals.length]} alt="" fill sizes={featuredCourses.length === 1 ? "(max-width: 900px) 100vw, 54vw" : "(max-width: 767px) 100vw, 34vw"} /></div><div className="home-course-body"><span className="home-course-category">{categories[course.category]?.[locale] ?? course.category.replaceAll("-", " ")}</span><h3><Link href={`/${locale}/formations/${course.slug}`}>{title}</Link></h3><p>{summary}</p><div className="home-course-meta"><span><Icon name="clock" size={16} />{Math.max(1, Math.round(course.durationMinutes / 60))} h</span><span><Icon name="play" size={16} />{modes[course.mode]?.[locale] ?? course.mode}</span>{course.startAt ? <span><Icon name="calendar" size={16} />{formatDate(course.startAt, locale)}</span> : null}</div><div className="home-course-footer"><span><small>{tx(locale, { en: "Led by", fr: "Avec", ar: "مع" })}</small><strong>{course.trainerName}</strong></span><span><strong>{formatMillimes(course.priceMillimes, locale)}</strong><Link className="icon-button" href={`/${locale}/formations/${course.slug}`} aria-label={tx(locale, { en: `View ${title}`, fr: `Voir ${title}`, ar: `عرض ${title}` })}><Icon className="directional-icon" name="arrow" size={19} /></Link></span></div></div></article>;
      })}</div> : <div className="compact-home-empty"><Icon name="book" size={22} /><div><strong>{tx(locale, { en: "The next courses are being prepared.", fr: "Les prochains parcours sont en préparation.", ar: "يجري إعداد المسارات القادمة." })}</strong><p>{tx(locale, { en: "Explore resources while the catalog is updated.", fr: "Consultez les ressources pendant la mise à jour du catalogue.", ar: "تصفح الموارد إلى حين تحديث الكتالوج." })}</p></div><Link className="btn btn-secondary" href={`/${locale}/bibliotheque`}>{c.nav.library}</Link></div>}
    </div></section>

    <section className="home-chapter method-story" aria-labelledby="method-title"><div className="container method-story-grid"><div className="method-story-photo"><Image src="/media/anei-learning-story.webp" alt={tx(locale, { en: "Two people collaborating with educational materials", fr: "Deux personnes collaborant autour de supports pédagogiques", ar: "شخصان يتعاونان حول مواد تعليمية" })} fill sizes="(max-width: 900px) 100vw, 48vw" /></div><div className="method-story-copy"><h2 id="method-title">{tx(locale, { en: "Understand. Apply. Progress.", fr: "Comprendre. Appliquer. Progresser.", ar: "افهم. طبّق. تقدّم." })}</h2><p>{tx(locale, { en: "ANEI connects learning to real professional action, with a clear next step at every stage.", fr: "ANEI relie chaque apprentissage à l’action professionnelle et rend la prochaine étape toujours visible.", ar: "تربط ANEI كل تعلم بالممارسة المهنية وتجعل الخطوة التالية واضحة دائمًا." })}</p><ol className="method-steps">{[
        [{ en: "Understand the essentials", fr: "Comprendre l’essentiel", ar: "فهم الأساسيات" }, { en: "Structured, bilingual and accessible content.", fr: "Des contenus structurés, bilingues et accessibles.", ar: "محتوى منظم وثنائي اللغة ومتاح." }],
        [{ en: "Apply with confidence", fr: "Appliquer avec confiance", ar: "التطبيق بثقة" }, { en: "Methods and resources connected to field work.", fr: "Des méthodes et ressources reliées au terrain.", ar: "أساليب وموارد مرتبطة بالميدان." }],
        [{ en: "Keep progressing", fr: "Continuer à progresser", ar: "مواصلة التقدم" }, { en: "Assessments, progress tracking and certificates.", fr: "Évaluations, suivi de progression et certificats.", ar: "تقييمات ومتابعة للتقدم وشهادات." }],
      ].map(([title, body], index) => <li key={title.fr}><span>{index + 1}</span><div><strong>{tx(locale, title)}</strong><p>{tx(locale, body)}</p></div></li>)}</ol><Link className="btn btn-primary" href={`/${locale}/about`}>{tx(locale, { en: "Discover our approach", fr: "Découvrir notre approche", ar: "اكتشف رؤيتنا" })}<Icon className="directional-icon" name="arrow" size={17} /></Link></div></div></section>

    <section className="home-chapter knowledge-section" aria-labelledby="knowledge-title"><div className="container"><header className="home-section-heading with-action"><div><h2 id="knowledge-title">{tx(locale, { en: "Resources and news to keep moving", fr: "Des ressources et actualités pour avancer", ar: "موارد وأخبار تساعدك على التقدم" })}</h2><p>{tx(locale, { en: "Practical material and the latest updates from ANEI.", fr: "Des supports pratiques et les dernières informations de l’Académie.", ar: "مواد عملية وآخر مستجدات الأكاديمية." })}</p></div><Link className="text-link" href={`/${locale}/actualites`}>{c.nav.news}<Icon className="directional-icon" name="arrow" size={17} /></Link></header>
      {news.length || resources.length ? <div className="knowledge-grid">{news[0] ? <article className="knowledge-lead"><div className="knowledge-lead-date"><Icon name="bell" size={22} /><time dateTime={(news[0].publishedAt ?? news[0].createdAt).toISOString()}>{longDate(news[0].publishedAt ?? news[0].createdAt, locale)}</time></div><div><span>{ar ? news[0].tagAr : news[0].tagFr}</span><h3><Link href={`/${locale}/actualites/${news[0].slug}`}>{ar ? news[0].titleAr : news[0].titleFr}</Link></h3><p>{ar ? news[0].excerptAr : news[0].excerptFr}</p><Link className="text-link" href={`/${locale}/actualites/${news[0].slug}`}>{tx(locale, { en: "Read the article", fr: "Lire l’article", ar: "اقرأ المقال" })}<Icon className="directional-icon" name="arrow" size={17} /></Link></div></article> : null}<div className="knowledge-list">{resources.map((resource) => <article key={resource.id}><span className="knowledge-icon"><Icon name="download" size={20} /></span><div><span>{resource.type}</span><h3><Link href={`/${locale}/bibliotheque`}>{ar ? resource.titleAr : resource.titleFr}</Link></h3><p>{ar ? resource.audienceAr : resource.audienceFr}</p></div><Link className="icon-button" href={`/${locale}/bibliotheque`} aria-label={tx(locale, { en: `View ${resource.titleFr}`, fr: `Voir ${resource.titleFr}`, ar: `عرض ${resource.titleAr}` })}><Icon className="directional-icon" name="chevron" size={18} /></Link></article>)}{news.slice(1, 3).map((item) => <article key={item.id}><span className="knowledge-icon"><Icon name="bell" size={20} /></span><div><span>{ar ? item.tagAr : item.tagFr}</span><h3><Link href={`/${locale}/actualites/${item.slug}`}>{ar ? item.titleAr : item.titleFr}</Link></h3><p>{longDate(item.publishedAt ?? item.createdAt, locale)}</p></div><Link className="icon-button" href={`/${locale}/actualites/${item.slug}`} aria-label={tx(locale, { en: `Read ${item.titleFr}`, fr: `Lire ${item.titleFr}`, ar: `اقرأ ${item.titleAr}` })}><Icon className="directional-icon" name="chevron" size={18} /></Link></article>)}</div></div> : <div className="compact-home-empty"><Icon name="book" size={22} /><div><strong>{tx(locale, { en: "New material is being prepared.", fr: "De nouveaux contenus sont en préparation.", ar: "يجري إعداد محتوى جديد." })}</strong><p>{tx(locale, { en: "The public library remains available.", fr: "La bibliothèque publique reste accessible.", ar: "تبقى المكتبة العامة متاحة." })}</p></div><Link className="btn btn-secondary" href={`/${locale}/bibliotheque`}>{c.nav.library}</Link></div>}
    </div></section>

    <section className="home-chapter support-section" aria-labelledby="support-title"><div className="container support-grid"><div className="support-intro"><h2 id="support-title">{tx(locale, { en: "Learning stays connected to people", fr: "Un apprentissage qui reste relié aux personnes", ar: "تعلم يبقى مرتبطًا بالناس" })}</h2><p>{tx(locale, { en: "Join a live exchange or find a visible AVS profile when you need direct support.", fr: "Participez à un échange en direct ou trouvez un profil AVS visible lorsque vous avez besoin d’un accompagnement.", ar: "شارك في لقاء مباشر أو ابحث عن ملف AVS متاح عندما تحتاج إلى مرافقة." })}</p></div><div className="support-panels"><article className="webinar-panel"><div className="support-panel-heading"><span><Icon name="calendar" size={21} /></span><div><strong>{c.nav.webinars}</strong><small>{tx(locale, { en: "Live sessions and replays", fr: "Sessions en direct et replays", ar: "جلسات مباشرة وتسجيلات" })}</small></div></div>{webinars[0] ? (() => { const webinar = webinars[0]; const translated = webinarTranslations.find((item) => item.title.fr === webinar.titleFr); const title = ar ? webinar.titleAr : en ? translated?.title.en ?? webinar.titleFr : webinar.titleFr; return <div className="featured-webinar"><time dateTime={webinar.startsAt?.toISOString()}>{webinar.startsAt ? longDate(webinar.startsAt, locale) : tx(locale, { en: "Replay available", fr: "Replay disponible", ar: "التسجيل متاح" })}</time><h3>{title}</h3>{webinar.trainerName ? <p>{webinar.trainerName}</p> : null}<Link className="text-link" href={`/${locale}/webinaires`}>{webinar.replayUrl ? tx(locale, { en: "Watch the replay", fr: "Voir le replay", ar: "شاهد التسجيل" }) : tx(locale, { en: "View the session", fr: "Voir la session", ar: "عرض الجلسة" })}<Icon className="directional-icon" name="arrow" size={17} /></Link></div>; })() : <div className="support-empty"><strong>{tx(locale, { en: "No webinar scheduled right now.", fr: "Aucun webinaire programmé pour le moment.", ar: "لا توجد ندوة مبرمجة حاليًا." })}</strong><Link href={`/${locale}/webinaires`}>{tx(locale, { en: "See sessions and replays", fr: "Voir les sessions et replays", ar: "عرض الجلسات والتسجيلات" })}</Link></div>}</article>
        <article className="avs-panel"><div className="support-panel-heading"><span><Icon name="shield" size={21} /></span><div><strong>{tx(locale, { en: "Certified AVS network", fr: "Réseau AVS certifié", ar: "شبكة AVS معتمدة" })}</strong><small>{tx(locale, { en: "Public profiles by region", fr: "Profils publics par région", ar: "ملفات عامة حسب الجهة" })}</small></div></div>{avsProfiles.length ? <div className="home-avs-list">{avsProfiles.map((profile) => { const translated = avsTranslations.find((item) => item.name === profile.displayName); const specialty = ar ? profile.specialtyAr : en ? translated?.specialty.en ?? profile.specialtyFr : profile.specialtyFr; const city = ar ? profile.cityAr : en ? translated?.city.en ?? profile.cityFr : profile.cityFr; return <div key={profile.id}><span aria-hidden="true">{profile.displayName.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><div><strong>{profile.displayName}</strong><small>{specialty}</small></div><span><Icon name="map" size={14} />{city}</span></div>; })}</div> : <div className="support-empty"><strong>{tx(locale, { en: "No public AVS profile is listed right now.", fr: "Aucun profil AVS public n’est répertorié pour le moment.", ar: "لا يوجد ملف AVS عام حاليًا." })}</strong><p>{tx(locale, { en: "The directory will update as profiles become available.", fr: "L’annuaire sera mis à jour lorsque des profils seront disponibles.", ar: "سيتم تحديث الدليل عند توفر ملفات جديدة." })}</p></div>}<Link className="text-link" href={`/${locale}/avs`}>{tx(locale, { en: "Search the directory", fr: "Rechercher dans l’annuaire", ar: "ابحث في الدليل" })}<Icon className="directional-icon" name="arrow" size={17} /></Link></article></div></div></section>

    <section className="home-final-cta" aria-labelledby="final-cta-title"><div className="container home-final-cta-inner"><div><h2 id="final-cta-title">{tx(locale, { en: "Ready to move forward?", fr: "Prêt à avancer ?", ar: "هل أنت مستعد للتقدم؟" })}</h2><p>{tx(locale, { en: "Choose a course or find the right professional support.", fr: "Choisissez un parcours ou trouvez l’accompagnement professionnel adapté.", ar: "اختر مسارًا أو ابحث عن المرافقة المهنية المناسبة." })}</p></div><div><Link className="btn btn-primary" href={`/${locale}/formations`}>{tx(locale, { en: "Explore courses", fr: "Découvrir les formations", ar: "اكتشف الدورات" })}<Icon className="directional-icon" name="arrow" size={18} /></Link><Link className="btn btn-secondary" href={`/${locale}/avs`}>{tx(locale, { en: "Find an AVS", fr: "Trouver un AVS", ar: "ابحث عن AVS" })}</Link></div></div></section>
  </div>;
}
