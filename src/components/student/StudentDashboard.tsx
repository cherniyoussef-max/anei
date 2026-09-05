import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GraduationCap, Trophy, Award, PlayCircle, Clock, CalendarDays, BookOpen, Download, ChevronRight, type LucideIcon } from "lucide-react";
import type { Locale } from "@/types";
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

function EmptyState({ icon: StateIcon, title, body, action }: { icon: LucideIcon; title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="student-empty-state">
      <span aria-hidden="true"><StateIcon size={22} strokeWidth={1.75} /></span>
      <div><strong>{title}</strong><p>{body}</p></div>
      {action ? <Link href={action.href}>{action.label}<ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} /></Link> : null}
    </div>
  );
}

function RadialProgress({ value }: { value: number }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div
      className="student-radial-progress"
      style={{ background: `conic-gradient(var(--brand-navy-950) ${safeValue * 3.6}deg, var(--border-subtle) 0deg)` }}
      role="img"
      aria-label={`${safeValue}%`}
    >
      <span dir="ltr">{safeValue}%</span>
    </div>
  );
}

function MetricCard({ icon: MetricIcon, tone, label, value, sub }: { icon: LucideIcon; tone: "navy" | "gold" | "cream"; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="student-summary-card">
      <span className={`student-summary-icon is-${tone}`} aria-hidden="true"><MetricIcon size={21} strokeWidth={1.75} /></span>
      <div>
        <p className="student-summary-label">{label}</p>
        <p className="student-summary-value" dir="ltr">{value}</p>
        {sub ? <p className="student-summary-detail">{sub}</p> : null}
      </div>
    </div>
  );
}

export function StudentDashboard({ locale, userName, continueItem, averageProgress, courses, sessions, resources, certificates }: {
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
  const inProgressCount = courses.filter((course) => course.progress < 100).length;
  const completedCount = courses.filter((course) => course.progress >= 100).length;
  return (
    <div className="student-dashboard-home">
      <header className="student-welcome">
        <div>
          <p className="student-welcome-kicker">{ar ? "مساحة التعلم الخاصة بك" : "Votre espace d’apprentissage"}</p>
          <h1>{ar ? `مرحبًا ${firstName}` : `Bonjour ${firstName}`}</h1>
          <p>{ar ? "واصل تقدمك، ثم راجع مواعيدك ومواردك." : "Poursuivez votre progression, puis retrouvez vos rendez-vous et vos ressources."}</p>
        </div>
        <span className="student-welcome-status"><GraduationCap size={18} strokeWidth={1.75} />{continueItem ? (ar ? "دورة قيد التقدم" : "Formation en cours") : (ar ? "جاهز للبدء" : "Prêt à commencer")}</span>
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
                <Link className="student-primary-action" href={`/${locale}/apprendre/${continueItem.slug}`}><PlayCircle size={18} strokeWidth={1.75} /><span>{ar ? "متابعة التعلم" : "Continuer la formation"}</span></Link>
                {continueItem.remainingMinutes ? <span className="student-remaining"><Clock size={17} strokeWidth={1.75} />{ar ? `حوالي ${continueItem.remainingMinutes} دقيقة متبقية` : `Environ ${continueItem.remainingMinutes} min restantes`}</span> : null}
              </div>
            </div>
            <div className="student-continue-media">
              <Image src={getCourseVisual(continueItem.slug)} alt="" width={800} height={600} priority loading="eager" sizes="(max-width: 767px) 100vw, (max-width: 1100px) 36vw, 420px" />
              <span aria-hidden="true"><GraduationCap size={24} strokeWidth={1.75} /></span>
            </div>
          </article>
        ) : (
          <div className="student-continue-empty">
            <span aria-hidden="true"><GraduationCap size={28} strokeWidth={1.75} /></span>
            <div><h2 id="continue-title">{ar ? "ابدأ أول مسار لك" : "Commencez votre premier parcours"}</h2><p>{ar ? "اختر دورة تناسب أهدافك وابدأ التعلم بالوتيرة التي تناسبك." : "Choisissez une formation adaptée à vos objectifs et avancez à votre rythme."}</p></div>
            <Link className="student-primary-action" href={`/${locale}/formations`}>{ar ? "عرض الدورات" : "Voir les formations"}<ArrowRight className="student-directional-icon" size={17} strokeWidth={1.75} /></Link>
          </div>
        )}
      </section>

      <section className="student-summary" aria-labelledby="summary-title">
        <div className="student-section-heading">
          <div><h2 id="summary-title">{ar ? "نظرة على تقدمك" : "Votre progression en un coup d’œil"}</h2><p>{ar ? "ملخص واضح لنشاطك التعليمي." : "Un résumé clair de votre activité d’apprentissage."}</p></div>
        </div>
        <div className="student-summary-grid">
          <div className="student-summary-card is-progress">
            <RadialProgress value={averageProgress} />
            <div>
              <p className="student-summary-label">{ar ? "التقدم الإجمالي" : "Progression globale"}</p>
              <p className="student-summary-detail">{ar ? "متوسط الدورات النشطة" : "Moyenne des formations actives"}</p>
            </div>
          </div>
          <MetricCard icon={GraduationCap} tone="navy" label={ar ? "دورات جارية" : "Formations en cours"} value={inProgressCount} sub={ar ? "قيد التقدم حاليًا" : "En cours actuellement"} />
          <MetricCard icon={Trophy} tone="gold" label={ar ? "دورات مكتملة" : "Formations terminées"} value={completedCount} sub={ar ? "أُنجزت بالكامل" : "Menées à terme"} />
          <MetricCard icon={Award} tone="cream" label={ar ? "الشهادات المحصلة" : "Certifications obtenues"} value={certificates.length} sub={ar ? "شهادات قابلة للتحقق" : "Certificats vérifiables"} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="student-courses lg:col-span-7" id="courses" aria-labelledby="courses-title">
          <div className="student-section-heading student-section-heading-row">
            <div><h2 id="courses-title">{ar ? "دوراتي" : "Mes formations"}</h2><p>{ar ? "تابع مساراتك النشطة وراجع ما أنجزته." : "Continuez vos parcours actifs et retrouvez ceux que vous avez terminés."}</p></div>
            <Link href={`/${locale}/dashboard/formations`}>{ar ? "عرض دوراتي" : "Voir mes formations"}<ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} /></Link>
          </div>
          {courses.length ? <div className="student-course-list">{courses.slice(0, 4).map((course) => (
            <article key={course.id}>
              <div className="student-course-cover"><Image src={getCourseVisual(course.slug)} alt="" width={96} height={72} sizes="96px" /></div>
              <div className="student-course-main"><strong>{course.title}</strong><Progress compact value={course.progress} label={ar ? `تقدم الدورة ${course.progress}%` : `Progression de la formation : ${course.progress} %`} /></div>
              <Link href={`/${locale}/apprendre/${course.slug}`} aria-label={`${course.progress >= 100 ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}: ${course.title}`}><span>{course.progress >= 100 ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}</span><ArrowRight className="student-directional-icon" size={16} strokeWidth={1.75} /></Link>
            </article>
          ))}</div> : <EmptyState icon={GraduationCap} title={ar ? "لا توجد دورات بعد" : "Aucune formation pour le moment"} body={ar ? "استكشف الكتالوج للعثور على مسارك الأول." : "Explorez le catalogue pour choisir votre premier parcours."} action={{ href: `/${locale}/formations`, label: ar ? "استكشف الدورات" : "Parcourir le catalogue" }} />}
        </section>

        <section className="student-upcoming lg:col-span-5" id="sessions" aria-labelledby="sessions-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="sessions-title">{ar ? "الموعد القادم" : "Prochain rendez-vous"}</h2><p>{ar ? "جلساتك وندواتك المسجلة." : "Vos sessions et webinaires enregistrés."}</p></div><Link href={`/${locale}/dashboard/rendez-vous`}>{ar ? "عرض المواعيد" : "Voir mes rendez-vous"}<ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} /></Link></div>
          {sessions.length ? <div className="student-session-list">{sessions.slice(0, 2).map((session, index) => (
            <article className={index === 0 ? "is-next" : undefined} key={session.id}>
              <span className="student-session-icon" aria-hidden="true"><CalendarDays size={19} strokeWidth={1.75} /></span>
              <div><time>{session.date}</time><strong>{session.title}</strong><small>{session.trainer}</small></div>
              {session.meetingUrl ? <a href={session.meetingUrl} target="_blank" rel="noreferrer" aria-label={`${ar ? "الدخول إلى الجلسة" : "Accéder à la session"}: ${session.title}`}><ArrowRight className="student-directional-icon" size={17} strokeWidth={1.75} /></a> : null}
            </article>
          ))}</div> : <EmptyState icon={CalendarDays} title={ar ? "لا يوجد موعد قريب" : "Aucun rendez-vous à venir"} body={ar ? "ستظهر جلساتك المسجلة هنا." : "Vos prochaines sessions apparaîtront ici."} action={{ href: `/${locale}/dashboard/rendez-vous`, label: ar ? "حجز موعد" : "Réserver un créneau" }} />}
        </section>
      </div>

      <div className="student-library-grid">
        <section id="resources" aria-labelledby="resources-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="resources-title">{ar ? "مواردي" : "Mes ressources"}</h2><p>{ar ? "الوثائق والأدوات المتاحة لك." : "Les documents et outils disponibles dans votre compte."}</p></div><Link href={`/${locale}/dashboard/ressources`}>{ar ? "عرض الكل" : "Tout voir"}<ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} /></Link></div>
          {resources.length ? <div className="student-asset-list">{resources.slice(0, 4).map((resource) => (
            <article key={resource.id}><span aria-hidden="true"><BookOpen size={19} strokeWidth={1.75} /></span><div><strong>{resource.title}</strong><small>{resource.date}</small></div><a href={`/api/resources/${resource.id}/download`} aria-label={`${ar ? "تحميل" : "Télécharger"}: ${resource.title}`}><Download size={18} strokeWidth={1.75} /></a></article>
          ))}</div> : <EmptyState icon={BookOpen} title={ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"} body={ar ? "ستظهر الموارد التي تحصل عليها هنا." : "Les ressources que vous obtenez apparaîtront ici."} action={{ href: `/${locale}/bibliotheque`, label: ar ? "عرض المكتبة" : "Voir la bibliothèque" }} />}
        </section>

        <section id="certificates" aria-labelledby="certificates-title">
          <div className="student-section-heading student-section-heading-row"><div><h2 id="certificates-title">{ar ? "شهاداتي" : "Mes certificats"}</h2><p>{ar ? "إنجازاتك القابلة للتحقق والطباعة." : "Vos réussites vérifiables et prêtes à imprimer."}</p></div><Link href={`/${locale}/dashboard/certificats`}>{ar ? "عرض الكل" : "Tout voir"}<ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} /></Link></div>
          {certificates.length ? <div className="student-certificate-list">{certificates.slice(0, 4).map((certificate) => (
            <Link key={certificate.id} href={`/${locale}/certificats/${certificate.code}`}><span aria-hidden="true"><Award size={20} strokeWidth={1.75} /></span><span><strong>{certificate.title}</strong><small dir="ltr">{certificate.code}</small></span><ChevronRight className="student-directional-icon" size={17} strokeWidth={1.75} /></Link>
          ))}</div> : <EmptyState icon={Award} title={ar ? "أكمل دورة للحصول على شهادة" : "Terminez une formation pour obtenir un certificat"} body={ar ? "ستظهر شهاداتك الصادرة هنا تلقائيًا." : "Vos certificats délivrés apparaîtront automatiquement ici."} />}
        </section>
      </div>
    </div>
  );
}
