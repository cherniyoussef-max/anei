import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/types";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getCourseVisual } from "@/lib/visuals";

export type StudentCourseItem = { id: string; slug: string; title: string; progress: number };
export type ContinueLearningItem = StudentCourseItem & { moduleTitle?: string; lessonTitle?: string; remainingMinutes?: number };
export type StudentSessionItem = { id: string; title: string; date: string; trainer: string; meetingUrl?: string };
export type StudentResourceItem = { id: string; title: string; date: string };
export type StudentCertificateItem = { id: string; title: string; code: string };

function Progress({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div className={compact ? "student-progress is-compact" : "student-progress"}>
      <progress className="student-progress-track" aria-label={label} max={100} value={safeValue}>{safeValue}%</progress>
      <span className="student-progress-value" dir="ltr">{safeValue}%</span>
    </div>
  );
}

function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="student-empty-state">
      <span aria-hidden="true"><Icon name={icon} size={22} /></span>
      <div><strong>{title}</strong><p>{body}</p></div>
      {action ? <Link href={action.href}>{action.label}<Icon className="student-directional-icon" name="arrow" size={15} /></Link> : null}
    </div>
  );
}

export function StudentDashboard({ locale, userName, pointsBalance, continueItem, averageProgress, courses, sessions, resources, certificates }: {
  locale: Locale;
  userName: string;
  pointsBalance: number;
  continueItem?: ContinueLearningItem;
  averageProgress: number;
  courses: StudentCourseItem[];
  sessions: StudentSessionItem[];
  resources: StudentResourceItem[];
  certificates: StudentCertificateItem[];
}) {
  const ar = locale === "ar";
  const firstName = userName.trim().split(/\s+/)[0] || userName;

  return (
    <div className="student-dashboard-view">
      <header className="student-page-heading">
        <div><h1>{ar ? `مرحبًا، ${firstName}` : `Bonjour ${firstName}`}</h1><p>{ar ? "ابدأ بخطوتك التالية، ثم راجع مواعيدك ومواردك." : "Commencez par votre prochaine étape, puis retrouvez vos rendez-vous et vos ressources."}</p></div>
        <div className="student-header-actions">
          <Link className="student-points-pill" href={`/${locale}/dashboard/porte-monnaie`}><Icon name="wallet" size={16} /><span>{pointsBalance} pts</span></Link>
          <Link className="student-catalog-link" href={`/${locale}/formations`}><Icon name="search" size={18} /><span>{ar ? "استكشف الدورات" : "Explorer les formations"}</span></Link>
        </div>
      </header>

      <section className="student-continue-section" aria-labelledby="continue-title">
        {continueItem ? (
          <article className="student-continue-card">
            <div className="student-continue-copy">
              <p className="student-continue-label">{ar ? "خطوتك التالية" : "Votre prochaine étape"}</p>
              <h2 id="continue-title">{continueItem.title}</h2>
              {continueItem.moduleTitle || continueItem.lessonTitle ? (
                <div className="student-current-context">{continueItem.moduleTitle ? <span>{continueItem.moduleTitle}</span> : null}{continueItem.lessonTitle ? <strong>{continueItem.lessonTitle}</strong> : null}</div>
              ) : <p>{ar ? "تابع المسار من آخر نقطة توقفت عندها." : "Reprenez le parcours à l’endroit où vous vous êtes arrêté."}</p>}
              <Progress value={continueItem.progress} label={ar ? `تقدم الدورة ${continueItem.progress}%` : `Progression de la formation : ${continueItem.progress} %`} />
              <div className="student-continue-actions">
                <Link className="student-primary-action" href={`/${locale}/apprendre/${continueItem.slug}`}><Icon name="play" size={18} /><span>{ar ? "متابعة التعلم" : "Continuer la formation"}</span></Link>
                {continueItem.remainingMinutes ? <span className="student-remaining"><Icon name="clock" size={17} />{ar ? `حوالي ${continueItem.remainingMinutes} دقيقة متبقية` : `Environ ${continueItem.remainingMinutes} min restantes`}</span> : null}
              </div>
            </div>
            <div className="student-continue-media">
              <Image src={getCourseVisual(continueItem.slug)} alt="" width={800} height={600} priority sizes="(max-width: 767px) 100vw, (max-width: 1100px) 36vw, 420px" />
              <span aria-hidden="true"><Icon name="graduation" size={24} /></span>
            </div>
          </article>
        ) : (
          <div className="student-continue-empty">
            <span aria-hidden="true"><Icon name="graduation" size={28} /></span>
            <div><h2 id="continue-title">{ar ? "ابدأ أول مسار لك" : "Commencez votre premier parcours"}</h2><p>{ar ? "اختر دورة تناسب أهدافك وابدأ التعلم بالوتيرة التي تناسبك." : "Choisissez une formation adaptée à vos objectifs et avancez à votre rythme."}</p></div>
            <Link className="student-primary-action" href={`/${locale}/formations`}>{ar ? "عرض الدورات" : "Voir les formations"}<Icon className="student-directional-icon" name="arrow" size={17} /></Link>
          </div>
        )}
      </section>

      <div className="student-overview-grid">
        <section className="student-progress-summary" aria-labelledby="progress-title">
          <div className="student-section-heading"><div><h2 id="progress-title">{ar ? "تقدمي" : "Ma progression"}</h2><p>{ar ? "نظرة موجزة على مساراتك الحالية." : "Une vue concise de vos parcours en cours."}</p></div><strong dir="ltr">{averageProgress}%</strong></div>
          <Progress value={averageProgress} label={ar ? `متوسط التقدم ${averageProgress}%` : `Progression moyenne : ${averageProgress} %`} />
          <dl className="student-progress-facts">
            <div><dt>{ar ? "الدورات" : "Formations"}</dt><dd>{courses.length}</dd></div>
            <div><dt>{ar ? "المكتملة" : "Terminées"}</dt><dd>{courses.filter((course) => course.progress >= 100).length}</dd></div>
            <div><dt>{ar ? "الشهادات" : "Certificats"}</dt><dd>{certificates.length}</dd></div>
          </dl>
        </section>

        <section className="student-upcoming" id="sessions" aria-labelledby="sessions-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="sessions-title">{ar ? "الموعد القادم" : "Prochain rendez-vous"}</h2><p>{ar ? "جلساتك وندواتك المسجلة." : "Vos sessions et webinaires enregistrés."}</p></div><Link href={`/${locale}/dashboard/rendez-vous`}>{ar ? "عرض المواعيد" : "Voir mes rendez-vous"}<Icon className="student-directional-icon" name="arrow" size={15} /></Link></div>
          {sessions.length ? <div className="student-session-list">{sessions.slice(0, 2).map((session, index) => (
            <article className={index === 0 ? "is-next" : undefined} key={session.id}>
              <span className="student-session-icon" aria-hidden="true"><Icon name="calendar" size={19} /></span>
              <div><time>{session.date}</time><strong>{session.title}</strong><small>{session.trainer}</small></div>
              {session.meetingUrl ? <a href={session.meetingUrl} target="_blank" rel="noreferrer" aria-label={`${ar ? "الدخول إلى الجلسة" : "Accéder à la session"}: ${session.title}`}><Icon className="student-directional-icon" name="arrow" size={17} /></a> : null}
            </article>
          ))}</div> : <EmptyState icon="calendar" title={ar ? "لا يوجد موعد قريب" : "Aucun rendez-vous à venir"} body={ar ? "ستظهر جلساتك المسجلة هنا." : "Vos prochaines sessions apparaîtront ici."} action={{ href: `/${locale}/dashboard/rendez-vous`, label: ar ? "عرض المواعيد" : "Voir mes rendez-vous" }} />}
        </section>
      </div>

      <section className="student-courses" id="courses" aria-labelledby="courses-title">
        <div className="student-section-heading student-section-heading-row">
          <div><h2 id="courses-title">{ar ? "دوراتي" : "Mes formations"}</h2><p>{ar ? "تابع مساراتك النشطة وراجع ما أنجزته." : "Continuez vos parcours actifs et retrouvez ceux que vous avez terminés."}</p></div>
          <Link href={`/${locale}/dashboard/formations`}>{ar ? "عرض دوراتي" : "Voir mes formations"}<Icon className="student-directional-icon" name="arrow" size={15} /></Link>
        </div>
        {courses.length ? <div className="student-course-list">{courses.slice(0, 4).map((course) => (
          <article key={course.id}>
            <div className="student-course-cover"><Image src={getCourseVisual(course.slug)} alt="" width={96} height={72} sizes="96px" /></div>
            <div className="student-course-main"><strong>{course.title}</strong><Progress compact value={course.progress} label={ar ? `تقدم الدورة ${course.progress}%` : `Progression de la formation : ${course.progress} %`} /></div>
            <Link href={`/${locale}/apprendre/${course.slug}`} aria-label={`${course.progress >= 100 ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}: ${course.title}`}><span>{course.progress >= 100 ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}</span><Icon className="student-directional-icon" name="arrow" size={16} /></Link>
          </article>
        ))}</div> : <EmptyState icon="graduation" title={ar ? "لا توجد دورات بعد" : "Aucune formation pour le moment"} body={ar ? "استكشف الكتالوج للعثور على مسارك الأول." : "Explorez le catalogue pour choisir votre premier parcours."} action={{ href: `/${locale}/formations`, label: ar ? "استكشف الدورات" : "Explorer les formations" }} />}
      </section>

      <div className="student-library-grid">
        <section id="resources" aria-labelledby="resources-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="resources-title">{ar ? "مواردي" : "Mes ressources"}</h2><p>{ar ? "الوثائق والأدوات المتاحة لك." : "Les documents et outils disponibles dans votre compte."}</p></div><Link href={`/${locale}/dashboard/ressources`}>{ar ? "عرض الكل" : "Tout voir"}<Icon className="student-directional-icon" name="arrow" size={15} /></Link></div>
          {resources.length ? <div className="student-asset-list">{resources.slice(0, 4).map((resource) => (
            <article key={resource.id}><span aria-hidden="true"><Icon name="book" size={19} /></span><div><strong>{resource.title}</strong><small>{resource.date}</small></div><a href={`/api/resources/${resource.id}/download`} aria-label={`${ar ? "تحميل" : "Télécharger"}: ${resource.title}`}><Icon name="download" size={18} /></a></article>
          ))}</div> : <EmptyState icon="book" title={ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"} body={ar ? "ستظهر الموارد التي تحصل عليها هنا." : "Les ressources que vous obtenez apparaîtront ici."} action={{ href: `/${locale}/bibliotheque`, label: ar ? "عرض المكتبة" : "Voir la bibliothèque" }} />}
        </section>

        <section id="certificates" aria-labelledby="certificates-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="certificates-title">{ar ? "شهاداتي" : "Mes certificats"}</h2><p>{ar ? "إنجازاتك القابلة للتحقق والطباعة." : "Vos réussites vérifiables et prêtes à imprimer."}</p></div><Link href={`/${locale}/dashboard/certificats`}>{ar ? "عرض الكل" : "Tout voir"}<Icon className="student-directional-icon" name="arrow" size={15} /></Link></div>
          {certificates.length ? <div className="student-certificate-list">{certificates.slice(0, 4).map((certificate) => (
            <Link key={certificate.id} href={`/${locale}/certificats/${certificate.code}`}><span aria-hidden="true"><Icon name="award" size={20} /></span><span><strong>{certificate.title}</strong><small dir="ltr">{certificate.code}</small></span><Icon className="student-directional-icon" name="chevron" size={17} /></Link>
          ))}</div> : <EmptyState icon="award" title={ar ? "أكمل دورة للحصول على شهادة" : "Terminez une formation pour obtenir un certificat"} body={ar ? "ستظهر شهاداتك الصادرة هنا تلقائيًا." : "Vos certificats délivrés apparaîtront automatiquement ici."} />}
        </section>
      </div>
    </div>
  );
}
