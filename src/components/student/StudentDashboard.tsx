import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  GraduationCap,
  Award,
  PlayCircle,
  Clock,
  CalendarDays,
  BookOpen,
  Download,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  UserCheck,
  ExternalLink,
  ShieldCheck,
  Check,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import type { Locale } from "@/types";
import { getCourseVisual } from "@/lib/visuals";

export type StudentCourseItem = {
  id: string;
  slug: string;
  title: string;
  progress: number;
  category?: string;
  coverImage?: string | null;
  status?: string;
};

export type ContinueLearningItem = StudentCourseItem & {
  moduleTitle?: string;
  lessonTitle?: string;
  remainingMinutes?: number;
  completedLessonsCount?: number;
  totalLessonsCount?: number;
};

export type StudentSessionItem = {
  id: string;
  title: string;
  date: string;
  startAtRaw?: string;
  trainer: string;
  meetingUrl?: string;
  type?: "appointment" | "webinar";
};

export type StudentResourceItem = {
  id: string;
  title: string;
  date: string;
  type?: string;
  description?: string;
};

export type StudentCertificateItem = {
  id: string;
  title: string;
  code: string;
  date?: string;
};

function ProgressRing({ value, size = 50, strokeWidth = 4 }: { value: number; size?: number; strokeWidth?: number }) {
  const safeValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safeValue / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center flex-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#0056D2"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-[#1F1F1F] font-mono tracking-tighter" dir="ltr">
        {safeValue}%
      </span>
    </div>
  );
}

function formatCategory(category?: string, ar?: boolean) {
  if (!category) return ar ? "التربية الدامجة" : "Pédagogie inclusive";
  const cat = category.toLowerCase();
  if (cat.includes("autis")) return ar ? "طيف التوحد" : "Troubles du spectre de l’autisme";
  if (cat.includes("dys")) return ar ? "صعوبات التعلّم DYS" : "Troubles des apprentissages";
  if (cat.includes("avs")) return ar ? "مرافقة مدرسية AVS" : "Accompagnement AVS";
  if (cat.includes("inclus")) return ar ? "التربية الدامجة" : "Éducation inclusive";
  return ar ? "تكوين مهني معتمد" : "Formation certifiante";
}

function parseSessionDate(dateStr: string, rawIso?: string, locale: Locale = "fr") {
  const date = rawIso ? new Date(rawIso) : null;
  if (date && !isNaN(date.getTime())) {
    const month = date.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", { month: "short" }).toUpperCase();
    const day = date.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR", { day: "numeric" });
    return { month, day };
  }
  const parts = dateStr.split(/[\s,.-]+/);
  const day = parts.find((p) => /^\d{1,2}$/.test(p)) || "01";
  const month = parts.find((p) => p.length >= 3 && !/^\d+$/.test(p)) || (locale === "ar" ? "أكتوبر" : "OCT");
  return { month: month.slice(0, 4).toUpperCase(), day };
}

function EmptyState({
  icon: StateIcon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="student-empty-state-box">
      <span className="student-empty-state-icon" aria-hidden="true">
        <StateIcon size={24} strokeWidth={1.75} />
      </span>
      <div className="student-empty-state-text">
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {action ? (
        <Link href={action.href} className="student-empty-state-action">
          <span>{action.label}</span>
          <ArrowRight className="student-directional-icon" size={15} strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}

export function StudentDashboard({
  locale,
  userName,
  continueItem,
  averageProgress,
  courses,
  sessions,
  resources,
  certificates,
  completedLessonsTotal = 0,
}: {
  locale: Locale;
  userName: string;
  completedLessonsTotal?: number;
  continueItem?: ContinueLearningItem;
  averageProgress: number;
  courses: StudentCourseItem[];
  sessions: StudentSessionItem[];
  resources: StudentResourceItem[];
  certificates: StudentCertificateItem[];
  pointsBalance?: number;
}) {
  const ar = locale === "ar";
  const en = locale === "en";
  const firstName = userName.trim().split(/\s+/)[0] || userName;
  const inProgressCount = courses.filter((course) => course.progress < 100).length;
  const completedCount = courses.filter((course) => course.progress >= 100).length;

  return (
    <div className="student-dashboard-home">
      {/* 1. EDITORIAL HEADER & LEARNER GREETING */}
      <header className="student-welcome-header">
        <div className="student-welcome-info">
          <p className="student-welcome-kicker">
            {ar ? "مساحة التعلّم · مسار التطوير المهني" : en ? "Learning Space · Professional Track" : "Espace Apprenant · Parcours Professionnel"}
          </p>
          <h1 className="student-welcome-title">
            {ar ? `مرحبًا، ${firstName}` : `Bonjour, ${firstName}`}
          </h1>
          <p className="student-welcome-subtitle">
            {ar
              ? "إليك ملخص تقدمك الدراسي وخطواتك القادمة لمواصلة التعلّم بمرونة وكفاءة."
              : en
              ? "Here is your learning momentum and your next actionable steps."
              : "Voici l'état de votre progression et vos prochaines étapes d'apprentissage."}
          </p>
        </div>
      </header>

      {/* 2. HERO LEARNING COCKPIT (CONTINUE CARD) */}
      <section className="student-hero-section" aria-labelledby="continue-hero-title">
        {continueItem ? (
          <article className="student-hero-cockpit">
            <div className="student-hero-copy">
              <div className="student-hero-eyebrow">
                <span className="student-active-tag">
                  <span className="student-pulse-dot" aria-hidden="true" />
                  {ar ? "دورة قيد المتابعة" : en ? "Active Course" : "Formation en cours"}
                </span>
                <span className="student-category-pill">
                  {formatCategory(continueItem.category, ar)}
                </span>
              </div>

              <h2 id="continue-hero-title" className="student-hero-heading">
                {continueItem.title}
              </h2>

              {/* Context Module / Lesson Stepper */}
              <div className="student-hero-context">
                <div className="student-context-row">
                  <BookOpen size={16} className="text-[#0056D2] flex-none" />
                  <span className="truncate">
                    {continueItem.moduleTitle || (ar ? "الوحدة الدراسية الجارية" : "Module en cours")}
                  </span>
                </div>
                <div className="student-context-lesson-row">
                  <span className="student-lesson-play-icon" aria-hidden="true">▶</span>
                  <strong className="truncate">
                    {continueItem.lessonTitle || (ar ? "متابعة الدرس القادم" : "Reprendre la prochaine leçon")}
                  </strong>
                </div>
              </div>

              {/* Dual-layer Progress Bar */}
              <div className="student-hero-progress-block">
                <div className="student-hero-progress-header">
                  <span>{ar ? "مستوى الإنجاز" : en ? "Progress" : "Progression"}</span>
                  <span dir="ltr" className="student-hero-progress-percent">
                    {continueItem.progress}%
                  </span>
                </div>
                <div className="student-hero-progress-track">
                  <div
                    className="student-hero-progress-fill"
                    style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%` }}
                  />
                </div>
                <div className="student-hero-progress-meta">
                  <span>
                    {continueItem.totalLessonsCount
                      ? ar
                        ? `${continueItem.completedLessonsCount ?? 0} من أصل ${continueItem.totalLessonsCount} درسًا مكتملة`
                        : `${continueItem.completedLessonsCount ?? 0} sur ${continueItem.totalLessonsCount} leçons complétées`
                      : ar
                      ? "تابع المسار من آخر نقطة توقفت عندها"
                      : "Reprenez le parcours à votre rythme"}
                  </span>
                  {continueItem.remainingMinutes ? (
                    <span className="student-hero-time-pill">
                      <Clock size={13} />
                      {ar ? `~${continueItem.remainingMinutes} دقيقة متبقية` : `~${continueItem.remainingMinutes} min restantes`}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="student-hero-actions">
                <Link
                  className="student-hero-btn-primary"
                  href={`/${locale}/apprendre/${continueItem.slug}`}
                >
                  <PlayCircle size={19} />
                  <span>{ar ? "متابعة الدرس" : en ? "Resume Lesson" : "Reprendre la leçon"}</span>
                </Link>
                <Link
                  className="student-hero-btn-secondary"
                  href={`/${locale}/apprendre/${continueItem.slug}#lessons`}
                >
                  <span>{ar ? "منهاج الدورة" : en ? "Syllabus" : "Plan de cours"}</span>
                  <ArrowRight size={15} className="student-directional-icon" />
                </Link>
              </div>
            </div>

            {/* Media side */}
            <div className="student-hero-media">
              <Image
                src={getCourseVisual(continueItem.slug)}
                alt=""
                width={800}
                height={540}
                priority
                loading="eager"
                sizes="(max-width: 767px) 100vw, (max-width: 1100px) 40vw, 480px"
                className="student-hero-img"
              />
              <div className="student-hero-media-badge">
                <ShieldCheck size={16} className="text-[#0056D2]" />
                <span>{ar ? "شهادة رسمية معتمدة" : "Certification ANEI"}</span>
              </div>
            </div>
          </article>
        ) : (
          <article className="student-hero-cockpit is-empty-hero">
            <div className="student-empty-hero-copy">
              <div className="student-hero-eyebrow">
                <span className="student-active-tag">
                  <Sparkles size={14} className="text-[#0056D2]" />
                  {ar ? "ابدأ مسارك التعليمي" : "Démarrez votre parcours"}
                </span>
              </div>
              <h2 id="continue-hero-title" className="student-hero-heading">
                {ar ? "اكتشف الدورات التدريبية المعتمدة في التربية الدامجة" : "Découvrez les formations certifiantes en éducation inclusive"}
              </h2>
              <p className="student-empty-hero-desc">
                {ar
                  ? "طوّر مهاراتك مع برامج تدريبية متخصصة ومصممة لمرافقة التلاميذ ذوي الاحتياجات الخاصة وتمكين كل طفل من النجاح المدرسي."
                  : "Développez vos compétences avec des programmes spécialisés, conçus par des praticiens et experts pour accompagner efficacement chaque élève."}
              </p>
              <div className="student-empty-hero-highlights">
                <div className="student-highlight-item">
                  <CheckCircle2 size={16} className="text-[#0056D2]" />
                  <span>{ar ? "شهادات معترف بها وقابلة للتحقق" : "Certifications vérifiables"}</span>
                </div>
                <div className="student-highlight-item">
                  <CheckCircle2 size={16} className="text-[#0056D2]" />
                  <span>{ar ? "مرافقة بيداغوجية مع خبراء ANEI" : "Tutorat pédagogique dédié"}</span>
                </div>
                <div className="student-highlight-item">
                  <CheckCircle2 size={16} className="text-[#0056D2]" />
                  <span>{ar ? "أدوات عملية وجداول رصد قابلة للتحميل" : "Boîte à outils téléchargeable"}</span>
                </div>
              </div>
              <div className="student-hero-actions">
                <Link className="student-hero-btn-primary" href={`/${locale}/formations`}>
                  <span>{ar ? "استكشف كل الدورات" : "Explorer le catalogue"}</span>
                  <ArrowRight size={17} className="student-directional-icon" />
                </Link>
              </div>
            </div>
            <div className="student-hero-media">
              <Image
                src="/images/heroes/hero-documentary.webp"
                alt=""
                width={800}
                height={540}
                priority
                className="student-hero-img"
              />
            </div>
          </article>
        )}
      </section>

      {/* 3. REFINED 4-METRIC BENTO ROW */}
      <section className="student-metrics-section" aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="sr-only">
          {ar ? "مؤشرات التقدم والنشاط" : "Indicateurs de progression"}
        </h2>
        <div className="student-metrics-grid">
          {/* Metric 1: Progression globale */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "التقدم الإجمالي" : "Progression générale"}</span>
              <ProgressRing value={averageProgress} size={46} strokeWidth={4} />
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{averageProgress}%</span>
              <p className="student-metric-caption">
                {courses.length > 0
                  ? ar
                    ? `متوسط الإنجاز على ${courses.length} مسار`
                    : `Moyenne sur ${courses.length} formation(s)`
                  : ar
                  ? "لا توجد دورات نشطة"
                  : "Aucune formation active"}
              </p>
            </div>
          </div>

          {/* Metric 2: Formations actives */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الدورات النشطة" : "Formations actives"}</span>
              <span className="student-metric-icon-wrap is-navy" aria-hidden="true">
                <BookOpen size={20} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{inProgressCount}</span>
              <p className="student-metric-caption">
                {ar
                  ? `${completedCount} مكتملة · ${inProgressCount} قيد المتابعة`
                  : `${completedCount} terminée(s) · ${inProgressCount} en cours`}
              </p>
            </div>
          </div>

          {/* Metric 3: Leçons validées */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الدروس المنجزة" : "Leçons validées"}</span>
              <span className="student-metric-icon-wrap is-gold" aria-hidden="true">
                <CheckCircle2 size={20} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{completedLessonsTotal}</span>
              <Link href={`/${locale}/dashboard/formations`} className="student-metric-action-link">
                <span>{ar ? "متابعة المنهاج" : "Voir mes cours"}</span>
                <ChevronRight size={13} className="student-directional-icon" />
              </Link>
            </div>
          </div>

          {/* Metric 4: Certifications */}
          <div className="student-metric-card">
            <div className="student-metric-top">
              <span className="student-metric-kicker">{ar ? "الشهادات المحصلة" : "Certifications obtenues"}</span>
              <span className="student-metric-icon-wrap is-emerald" aria-hidden="true">
                <Award size={20} strokeWidth={1.8} />
              </span>
            </div>
            <div className="student-metric-main">
              <span className="student-metric-num" dir="ltr">{certificates.length}</span>
              <Link href={`/${locale}/dashboard/certificats`} className="student-metric-action-link">
                <span>{ar ? "شهادات قابلة للتحقق" : "Consulter mes certificats"}</span>
                <ChevronRight size={13} className="student-directional-icon" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MAIN 2-COLUMN SECTION (COURSES & AGENDA) */}
      <div className="student-core-grid">
        {/* Left Column (7 cols): Mes Formations */}
        <section className="student-courses-panel" id="courses" aria-labelledby="courses-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="courses-heading" className="student-panel-title">
                {ar ? "دوراتي التعليمية" : "Mes formations"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "تابع مساراتك النشطة وراجع ما أنجزته من دروس ومشاريع." : "Continuez vos parcours actifs et retrouvez vos leçons."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/formations`} className="student-panel-viewall">
              <span>{ar ? "عرض الكل" : "Voir tout"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {courses.length > 0 ? (
            <div className="student-courses-stack">
              {courses.slice(0, 4).map((course) => {
                const isCompleted = course.progress >= 100;
                return (
                  <article key={course.id} className="student-course-item">
                    <div className="student-course-item-thumb">
                      <Image
                        src={getCourseVisual(course.slug)}
                        alt=""
                        width={128}
                        height={88}
                        className="student-course-item-img"
                      />
                      {isCompleted ? (
                        <span className="student-course-item-check" title={ar ? "مكتملة" : "Terminée"}>
                          <Check size={13} strokeWidth={2.5} />
                        </span>
                      ) : null}
                    </div>

                    <div className="student-course-item-content">
                      <div className="student-course-item-category">
                        {formatCategory(course.category, ar)}
                      </div>
                      <h3 className="student-course-item-title">
                        {course.title}
                      </h3>
                      <div className="student-course-item-progress-row">
                        <div className="student-course-item-track">
                          <div
                            className={`student-course-item-fill ${isCompleted ? "is-complete" : ""}`}
                            style={{ width: `${Math.min(100, Math.max(0, course.progress))}%` }}
                          />
                        </div>
                        <span className="student-course-item-percent" dir="ltr">
                          {course.progress}%
                        </span>
                      </div>
                    </div>

                    <div className="student-course-item-action">
                      <Link
                        href={`/${locale}/apprendre/${course.slug}`}
                        className={isCompleted ? "student-btn-ghost-sm" : "student-btn-primary-sm"}
                        aria-label={`${isCompleted ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}: ${course.title}`}
                      >
                        <span>{isCompleted ? (ar ? "مراجعة" : "Revoir") : (ar ? "متابعة" : "Continuer")}</span>
                        <ArrowRight size={14} className="student-directional-icon" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={GraduationCap}
              title={ar ? "لا توجد دورات مسجلة بعد" : "Aucune formation pour le moment"}
              body={ar ? "استكشف كتالوج ANEI واختر الدورة المناسبة لأهدافك المهنية." : "Explorez le catalogue ANEI pour démarrer votre premier parcours certifiant."}
              action={{
                href: `/${locale}/formations`,
                label: ar ? "تصفح الدورات" : "Parcourir le catalogue",
              }}
            />
          )}
        </section>

        {/* Right Column (5 cols): Agenda & Rendez-vous */}
        <section className="student-agenda-panel" id="sessions" aria-labelledby="sessions-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="sessions-heading" className="student-panel-title">
                {ar ? "المواعيد واللقاءات" : "Agenda & Rendez-vous"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "جلساتك التفاعلية وندواتك المسجلة." : "Vos sessions et webinaires programmés."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/rendez-vous`} className="student-panel-viewall">
              <span>{ar ? "مواعيدي" : "Mes créneaux"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {sessions.length > 0 ? (
            <div className="student-agenda-stack">
              {sessions.map((session) => {
                const dateParts = parseSessionDate(session.date, session.startAtRaw, locale);
                return (
                  <article key={session.id} className="student-agenda-item">
                    <div className="student-agenda-date-tile">
                      <span className="student-date-month">{dateParts.month}</span>
                      <span className="student-date-day">{dateParts.day}</span>
                    </div>

                    <div className="student-agenda-details">
                      <span className="student-agenda-type-pill">
                        {session.type === "webinar"
                          ? (ar ? "ندوة تفاعلية" : "Webinaire interactif")
                          : (ar ? "متابعة فردية" : "Suivi pédagogique")}
                      </span>
                      <h3 className="student-agenda-name">{session.title}</h3>
                      <p className="student-agenda-trainer">
                        <UserCheck size={14} className="text-[#0056D2]" />
                        <span>{session.trainer}</span>
                      </p>
                    </div>

                    {session.meetingUrl ? (
                      <a
                        href={session.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="student-agenda-join-btn"
                        aria-label={`${ar ? "انضمام إلى اللقاء" : "Rejoindre la visio"}: ${session.title}`}
                      >
                        <span>{ar ? "انضمام" : "Rejoindre"}</span>
                        <ExternalLink size={13} />
                      </a>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="student-support-slot-card">
              <div className="student-support-slot-icon">
                <CalendarDays size={26} strokeWidth={1.75} />
              </div>
              <div className="student-support-slot-body">
                <h3>{ar ? "هل ترغب في جلسة متابعة فردية؟" : "Besoin d'un accompagnement personnalisé ?"}</h3>
                <p>
                  {ar
                    ? "احجز موعدًا فرديًا مع مستشار بيداغوجي لمناقشة أهدافك وصعوبات الميدان."
                    : "Réservez un échange de 30 min avec un tuteur pédagogique pour poser vos questions sur votre pratique."}
                </p>
                <Link href={`/${locale}/dashboard/rendez-vous`} className="student-support-slot-btn">
                  <CalendarDays size={15} />
                  <span>{ar ? "حجز موعد متابعة" : "Réserver un créneau"}</span>
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 5. LOWER GRID: RESSOURCES RÉCENTES & CERTIFICATS */}
      <div className="student-secondary-grid">
        {/* Left Column: Ressources Pratiques */}
        <section className="student-resources-panel" id="resources" aria-labelledby="resources-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="resources-heading" className="student-panel-title">
                {ar ? "الموارد والأدوات" : "Boîte à outils & Ressources"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "الوثائق والأدلة المتاحة لحسابك." : "Documents et fiches pratiques disponibles."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/ressources`} className="student-panel-viewall">
              <span>{ar ? "كل الموارد" : "Tout voir"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {resources.length > 0 ? (
            <div className="student-resources-stack">
              {resources.slice(0, 4).map((resource) => (
                <article key={resource.id} className="student-resource-item">
                  <div className="student-resource-icon-box" aria-hidden="true">
                    <BookOpen size={19} strokeWidth={1.8} />
                  </div>
                  <div className="student-resource-info">
                    <h3 className="student-resource-title">{resource.title}</h3>
                    <p className="student-resource-date">{resource.date}</p>
                  </div>
                  <a
                    href={`/api/resources/${resource.id}/download`}
                    className="student-resource-download-btn"
                    aria-label={`${ar ? "تحميل" : "Télécharger"}: ${resource.title}`}
                  >
                    <Download size={16} strokeWidth={2} />
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={BookOpen}
              title={ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"}
              body={ar ? "ستظهر الأدوات وجداول الرصد التي تحصل عليها هنا." : "Les guides et grilles d’observation apparaîtront ici."}
              action={{
                href: `/${locale}/bibliotheque`,
                label: ar ? "عرض المكتبة" : "Consulter la bibliothèque",
              }}
            />
          )}
        </section>

        {/* Right Column: Certificats & Validations */}
        <section className="student-certificates-panel" id="certificates" aria-labelledby="certificates-heading">
          <div className="student-panel-header">
            <div>
              <h2 id="certificates-heading" className="student-panel-title">
                {ar ? "الشهادات والتحقق" : "Certificats & Validations"}
              </h2>
              <p className="student-panel-subtitle">
                {ar ? "شهاداتك المعتمدة القابلة للتحقق الفوري." : "Titres officiels vérifiables par QR code."}
              </p>
            </div>
            <Link href={`/${locale}/dashboard/certificats`} className="student-panel-viewall">
              <span>{ar ? "شهاداتي" : "Tout voir"}</span>
              <ArrowRight size={14} className="student-directional-icon" />
            </Link>
          </div>

          {certificates.length > 0 ? (
            <div className="student-certificates-stack">
              {certificates.slice(0, 4).map((cert) => (
                <Link
                  key={cert.id}
                  href={`/${locale}/certificats/${cert.code}`}
                  className="student-certificate-item"
                >
                  <div className="student-certificate-seal" aria-hidden="true">
                    <Award size={22} strokeWidth={1.8} />
                  </div>
                  <div className="student-certificate-info">
                    <h3 className="student-certificate-title">{cert.title}</h3>
                    <span className="student-certificate-code" dir="ltr">
                      Réf: {cert.code}
                    </span>
                  </div>
                  <ChevronRight size={18} className="student-directional-icon text-[#7A7261]" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="student-cert-milestone-card">
              <div className="student-cert-milestone-seal">
                <Award size={30} strokeWidth={1.75} className="text-[#0056D2]" />
              </div>
              <div className="student-cert-milestone-body">
                <h3>{ar ? "مسار الحصول على الشهادة الرسمية" : "Parcours de certification officielle"}</h3>
                <p>
                  {ar
                    ? "أكمل دراسة دورتك التدريبية بنسبة 100% للحصول على شهادة معتمدة وموثقة برمز QR رسمي."
                    : "Complétez votre formation active à 100% pour débloquer votre certificat officiel reconnu par les établissements scolaires."}
                </p>
                {continueItem ? (
                  <div className="student-cert-milestone-track">
                    <div className="student-cert-milestone-bar">
                      <div
                        className="student-cert-milestone-fill"
                        style={{ width: `${Math.min(100, Math.max(0, continueItem.progress))}%` }}
                      />
                    </div>
                    <span dir="ltr">{continueItem.progress}% complété</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 6. BOTTOM PEDAGOGICAL HELP & AI ASSISTANT BANNER */}
      <section className="student-bottom-banner" aria-label={ar ? "المساعدة والدعم" : "Aide et accompagnement"}>
        <div className="student-bottom-banner-icon" aria-hidden="true">
          <Sparkles size={24} className="text-[#0056D2]" />
        </div>
        <div className="student-bottom-banner-content">
          <h3>
            {ar
              ? "هل لديك سؤال أو تحتاج إلى مساعدة بيداغوجية؟"
              : "Une question sur votre cours ou un besoin d'accompagnement ?"}
          </h3>
          <p>
            {ar
              ? "مساعد ANEI الذكي وفريقنا البيداغوجي متاحون للإجابة على جميع استفساراتك وتوجيهك خطوة بخطوة."
              : "L'Assistant ANEI et nos référents pédagogiques sont à vos côtés pour vous guider vers la réussite."}
          </p>
        </div>
        <div className="student-bottom-banner-actions">
          <Link
            href={`/${locale}/dashboard?assistant=open`}
            className="student-banner-btn-gold"
          >
            <Sparkles size={16} />
            <span>{ar ? "فتح مساعد ANEI" : "Assistant ANEI"}</span>
          </Link>
          <Link
            href={`/${locale}/contact`}
            className="student-banner-btn-ghost"
          >
            <HelpCircle size={16} />
            <span>{ar ? "التواصل مع الدعم" : "Contacter le support"}</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
