import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CourseDiscussion } from "@/components/learning/CourseDiscussion";
import { StreamLessonPlayer } from "@/components/learning/StreamLessonPlayer";
import { VideoLessonPlayer } from "@/components/learning/VideoLessonPlayer";
import { YoutubeLessonPlayer } from "@/components/learning/YoutubeLessonPlayer";
import { MarkLessonCompleteButton } from "@/components/learning/MarkLessonCompleteButton";
import { AutismLessonInteractiveContent } from "@/components/learning/AutismLessonInteractiveContent";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  PlayCircle,
  Check,
  BookOpen,
  Download,
  Award,
} from "lucide-react";
import { courses as courseTranslations } from "@/lib/data";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearningCourse } from "@/server/queries/account";
import { getCourseDiscussion } from "@/server/services/course-discussion";
import { getCheckpointsForLearner } from "@/server/services/video-checkpoints";
import "./course-room.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const labels = {
  en: {
    back: "My courses",
    room: "Course room",
    overview: "Overview",
    programme: "Course outline",
    lessons: "Lessons",
    questions: "Questions & Answers",
    continue: "Continue learning",
    completed: "completed",
    progress: "Course progress",
    about: "About this course",
    aboutBody: "Follow your learning programme, master each skill, and ask questions to the community.",
    programmeTitle: "Course outline",
    lesson: "Lesson",
    extra: "Additional lessons",
    document: "Course resources & attachments",
    textLesson: "Document lesson",
    previous: "Previous",
    next: "Next",
    end: "End of course",
    assessments: "Assessments",
    best: "Best score",
    passed: "Passed",
    failed: "Not passed",
    attempts: "attempt(s) remaining",
    noAttempts: "No attempts remaining",
    retry: "Try again",
    startQuiz: "Start assessment",
    hours: "hours",
    trainer: "Instructor",
  },
  fr: {
    back: "Mes formations",
    room: "Espace de formation",
    overview: "Vue d’ensemble",
    programme: "Programme",
    lessons: "Leçons",
    questions: "Questions et réponses",
    continue: "Continuer la formation",
    completed: "terminé",
    progress: "Progression du parcours",
    about: "À propos de ce parcours",
    aboutBody: "Retrouvez ici le programme, vos leçons et un espace d'échange pratique pour progresser efficacement.",
    programmeTitle: "Programme de la formation",
    lesson: "Leçon",
    extra: "Leçons complémentaires",
    document: "Ressource & document associé",
    textLesson: "Leçon documentaire",
    previous: "Précédent",
    next: "Suivant",
    end: "Fin du parcours",
    assessments: "Évaluations",
    best: "Meilleur score",
    passed: "Réussi",
    failed: "Non réussi",
    attempts: "tentative(s) restante(s)",
    noAttempts: "Plus de tentative disponible",
    retry: "Retenter",
    startQuiz: "Commencer l’évaluation",
    hours: "heures",
    trainer: "Formateur",
  },
  ar: {
    back: "دوراتي",
    room: "مساحة الدورة",
    overview: "نظرة عامة",
    programme: "البرنامج",
    lessons: "الدروس",
    questions: "الأسئلة والإجابات",
    continue: "متابعة التعلم",
    completed: "مكتمل",
    progress: "تقدم الدورة",
    about: "عن هذه الدورة",
    aboutBody: "تابع البرنامج والدروس واطرح أسئلتك العملية من مساحة واحدة تساعدك على التقدم بوضوح.",
    programmeTitle: "منهاج الدورة",
    lesson: "الدرس",
    extra: "دروس إضافية",
    document: "الموارد والوثيقة المرفقة",
    textLesson: "درس وثائقي",
    previous: "السابق",
    next: "التالي",
    end: "نهاية الدورة",
    assessments: "التقييمات",
    best: "أفضل نتيجة",
    passed: "ناجح",
    failed: "غير ناجح",
    attempts: "محاولات متبقية",
    noAttempts: "لا توجد محاولات متبقية",
    retry: "إعادة المحاولة",
    startQuiz: "بدء التقييم",
    hours: "ساعات",
    trainer: "المكوّن",
  },
} as const;

export default async function CourseRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { locale, slug } = await params;
  const { lesson: requestedLessonId } = await searchParams;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const data = await getLearningCourse(session.user.id, slug);
  if (!data) {
    const courseExists = courseTranslations.some((item) => item.slug === slug);
    if (courseExists) {
      redirect(`/${locale}/formations/${slug}`);
    }
    redirect(`/${locale}/dashboard/formations`);
  }
  const discussion = (await getCourseDiscussion(session.user.id, data.course.id)) ?? [];

  const c = labels[locale];
  const ar = locale === "ar";
  const en = locale === "en";
  const translated = courseTranslations.find((item) => item.slug === data.course.slug);
  const title = ar ? data.course.titleAr : en ? translated?.title.en ?? data.course.titleFr : data.course.titleFr;
  const description = ar ? data.course.descriptionAr : en ? translated?.description.en ?? data.course.descriptionFr : data.course.descriptionFr;
  const progress = new Map(data.progress.map((item) => [item.lessonId, item] as const));
  const modules = data.modules
    .map((courseModule) => ({
      module: courseModule,
      lessons: data.lessons.filter((lesson) => lesson.moduleId === courseModule.id),
    }))
    .filter((group) => group.lessons.length > 0);
  const ungrouped = data.lessons.filter(
    (lesson) => !lesson.moduleId || !data.modules.some((courseModule) => courseModule.id === lesson.moduleId)
  );
  const groups = [...modules, ...(ungrouped.length ? [{ module: null, lessons: ungrouped }] : [])];
  const firstIncomplete = data.lessons.find((lesson) => !progress.get(lesson.id)?.completed) ?? data.lessons[0];
  const activeLesson = data.lessons.find((lesson) => lesson.id === requestedLessonId) ?? firstIncomplete;
  const activeLessonIndex = activeLesson ? data.lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const previousLesson = activeLessonIndex > 0 ? data.lessons[activeLessonIndex - 1] : null;
  const nextLesson =
    activeLessonIndex >= 0 && activeLessonIndex < data.lessons.length - 1 ? data.lessons[activeLessonIndex + 1] : null;
  const activeGroup = activeLesson
    ? groups.find((group) => group.lessons.some((lesson) => lesson.id === activeLesson.id))
    : null;
  const activeProgress = activeLesson ? progress.get(activeLesson.id) : null;
  const lessonHref = (lessonId: string) => `/${locale}/apprendre/${slug}?lesson=${lessonId}#lessons`;
  const firstAssessment = data.assessments[0]?.assessment;
  const assessmentHref = firstAssessment ? `/${locale}/apprendre/${slug}/quiz/${firstAssessment.id}` : undefined;
  const isNativeVideoLesson = Boolean(
    activeLesson &&
      !(activeLesson.mediaProvider === "youtube" && activeLesson.mediaRef) &&
      !(activeLesson.mediaProvider === "cloudflare_stream" && activeLesson.mediaRef) &&
      activeLesson.videoUrl
  );
  const checkpoints =
    isNativeVideoLesson && activeLesson && data.enrollment?.id
      ? await getCheckpointsForLearner(activeLesson.id, data.enrollment.id)
      : [];
  const completedLessonsCount = data.lessons.filter((l) => progress.get(l.id)?.completed).length;
  const progressPercent = data.enrollment?.progressPercent ?? 0;
  const allLessonsDone = data.lessons.length > 0 && completedLessonsCount === data.lessons.length;
  const hasPublishedAssessments = data.assessments.length > 0;
  const hasPassedAllAssessments = hasPublishedAssessments && data.assessments.every((a) => a.bestAttempt?.passed);
  const pendingMandatoryQuiz = allLessonsDone && hasPublishedAssessments && !hasPassedAllAssessments;

  return (
    <div className="course-room coursera-style">
      {/* 1. COURSERA MINIMAL TOP BAR */}
      <header className="course-top-strip" id="overview-bar">
        <div className="course-top-strip-left">
          <Link className="course-top-back-btn" href={`/${locale}/dashboard/formations`}>
            <ArrowLeft size={16} className="rtl:rotate-180" />
            <span>{c.back}</span>
          </Link>
          <span className="course-top-sep" aria-hidden="true">/</span>
          <span className="course-top-course-title truncate" title={title}>
            {title}
          </span>
        </div>
        <div className="course-top-strip-right">
          <div className="course-top-progress-info">
            <span className="course-top-progress-text">
              {c.lesson} {activeLessonIndex + 1}/{data.lessons.length} • {progressPercent}% {c.completed}
            </span>
            <div className="course-top-progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.progress}: ${progressPercent}%`}>
              <div
                className="course-top-progress-fill"
                style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 2. MAIN 2-COLUMN LEARNING WORKSPACE */}
      <div className="course-workspace-grid">
        {/* MAIN STAGE (72%) */}
        <main className="course-main-stage" id="lessons">
          {/* MANDATORY QUIZ CALL-TO-ACTION BANNER */}
          {pendingMandatoryQuiz && firstAssessment && (
            <div
              className="course-mandatory-quiz-banner"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "16px 20px",
                background: "#eff6ff",
                border: "1.5px solid #bfdbfe",
                borderRadius: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ background: "#0056D2", color: "#fff", padding: 8, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Award size={20} />
                </div>
                <div>
                  <strong style={{ display: "block", color: "#1e3a8a", fontSize: 14 }}>
                    {ar ? "التقييم النهائي الإلزامي لإتمام الدورة" : "Évaluation finale obligatoire du parcours"}
                  </strong>
                  <p style={{ margin: 0, color: "#1e40af", fontSize: 13 }}>
                    {ar
                      ? "تهانينا على إتمام جميع الدروس! اجتز هذا الاختبار لتأكيد نتيجتك واستلام شهادتك الرسمية ANEI."
                      : "Félicitations pour avoir suivi toutes les leçons ! Validez ce quiz pour finaliser votre parcours et débloquer votre certificat officiel ANEI."}
                  </p>
                </div>
              </div>
              <Link
                href={`/${locale}/apprendre/${slug}/quiz/${firstAssessment.id}`}
                className="course-btn-primary"
                style={{ padding: "10px 18px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}
              >
                {ar ? "بدء الاختبار الإلزامي الآن" : "Passer le quiz obligatoire"}
              </Link>
            </div>
          )}

          {allLessonsDone && (!hasPublishedAssessments || hasPassedAllAssessments) && data.enrollment?.status === "completed" && (
            <div
              className="course-completed-success-banner"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                padding: "14px 18px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 10,
                marginBottom: 20,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Check size={18} className="text-emerald-700" strokeWidth={2.5} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#065f46" }}>
                  {ar
                    ? "تهانينا! لقد أتممت هذه الدورة واجتزت التقييم بنجاح. شهادتك الرسمية جاهزة."
                    : "Félicitations ! Vous avez validé cette formation avec succès. Votre certificat officiel est disponible."}
                </span>
              </div>
              <Link
                href={`/${locale}/dashboard/certificats`}
                className="course-btn-primary"
                style={{ padding: "8px 16px", fontSize: 12, background: "#059669" }}
              >
                {ar ? "عرض الشهادة" : "Voir mon certificat"}
              </Link>
            </div>
          )}

          {activeLesson ? (
            <article className="course-player-card">
              {/* VIDEO / MEDIA PLAYER AT TOP */}
              <div className="course-player-container">
                {activeLesson.mediaProvider === "youtube" && activeLesson.mediaRef ? (
                  <YoutubeLessonPlayer
                    videoId={activeLesson.mediaRef}
                    title={ar ? activeLesson.titleAr : activeLesson.titleFr}
                    locale={locale}
                  />
                ) : activeLesson.mediaProvider === "cloudflare_stream" && activeLesson.mediaRef ? (
                  <StreamLessonPlayer
                    lessonId={activeLesson.id}
                    title={ar ? activeLesson.titleAr : activeLesson.titleFr}
                    locale={locale}
                    initialSeconds={activeProgress?.watchedSeconds ?? 0}
                    initiallyCompleted={activeProgress?.completed ?? false}
                    nextLessonHref={nextLesson ? lessonHref(nextLesson.id) : undefined}
                  />
                ) : activeLesson.videoUrl ? (
                  <VideoLessonPlayer
                    lessonId={activeLesson.id}
                    videoUrl={activeLesson.videoUrl}
                    title={ar ? activeLesson.titleAr : activeLesson.titleFr}
                    initialSeconds={activeProgress?.watchedSeconds ?? 0}
                    initiallyCompleted={activeProgress?.completed ?? false}
                    locale={locale}
                    checkpoints={checkpoints}
                    nextLessonHref={nextLesson ? lessonHref(nextLesson.id) : undefined}
                    previousLessonHref={previousLesson ? lessonHref(previousLesson.id) : undefined}
                    assessmentHref={assessmentHref}
                    hideMetaBar={true}
                  />
                ) : (
                  <div className="course-room-placeholder">
                    <BookOpen size={36} strokeWidth={1.5} className="text-[#0056D2]" />
                    <span>{c.textLesson}</span>
                  </div>
                )}
              </div>

              {/* COURSERA-STYLE STEP ACTION BAR */}
              <div className="course-step-action-bar">
                <div className="course-step-prev">
                  {previousLesson ? (
                    <Link href={lessonHref(previousLesson.id)} className="course-btn-nav-prev">
                      <ChevronLeft size={16} className="rtl:rotate-180" />
                      <span>{c.previous}</span>
                    </Link>
                  ) : null}
                </div>

                <div className="course-step-center">
                  <MarkLessonCompleteButton
                    lessonId={activeLesson.id}
                    initiallyCompleted={activeProgress?.completed ?? false}
                    locale={locale}
                    nextHref={nextLesson ? lessonHref(nextLesson.id) : assessmentHref}
                    hasNextLesson={Boolean(nextLesson)}
                  />
                </div>

                <div className="course-step-next">
                  {nextLesson ? (
                    <Link href={lessonHref(nextLesson.id)} className="course-btn-nav-next">
                      <span className="truncate max-w-[200px]">{c.next}: {ar ? nextLesson.titleAr : nextLesson.titleFr}</span>
                      <ChevronRight size={16} className="rtl:rotate-180 flex-none" />
                    </Link>
                  ) : assessmentHref ? (
                    <Link href={assessmentHref} className="course-btn-nav-assessment">
                      <span>{ar ? "بدء التقييم النهائي" : "Passer à l’évaluation finale"}</span>
                      <ArrowRight size={16} className="rtl:rotate-180 flex-none" />
                    </Link>
                  ) : (
                    <span className="course-btn-nav-end">
                      <Award size={16} />
                      <span>{c.end}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* LESSON DETAILS HEADER */}
              <div className="course-lesson-header">
                <div className="course-lesson-header-top">
                  <span className="course-lesson-module-tag">
                    {activeGroup?.module
                      ? ar
                        ? activeGroup.module.titleAr
                        : activeGroup.module.titleFr
                      : c.programme}{" "}
                    • {c.lesson} {activeLesson.position}
                  </span>
                  <span className="course-lesson-duration-badge">
                    <Clock size={13} />
                    <span>{Math.max(1, Math.round(activeLesson.durationSeconds / 60))} min</span>
                  </span>
                </div>

                <h1 className="course-lesson-heading">
                  {ar ? activeLesson.titleAr : activeLesson.titleFr}
                </h1>

                {data.course.slug === "trouble-spectre-autisme-accompagnement-scolaire" ? (
                  <AutismLessonInteractiveContent
                    courseSlug={data.course.slug}
                    lessonPosition={activeLesson.position}
                    locale={locale}
                    titleFr={activeLesson.titleFr}
                    titleAr={activeLesson.titleAr}
                    descriptionFr={activeLesson.descriptionFr}
                    descriptionAr={activeLesson.descriptionAr}
                  />
                ) : (ar ? activeLesson.descriptionAr : activeLesson.descriptionFr) ? (
                  <p className="course-lesson-description">
                    {ar ? activeLesson.descriptionAr : activeLesson.descriptionFr}
                  </p>
                ) : null}

                {activeLesson.documentUrl ? (
                  <div className="course-lesson-attachment">
                    <a className="course-btn-document" href={activeLesson.documentUrl} target="_blank" rel="noreferrer">
                      <Download size={15} />
                      <span>{c.document}</span>
                    </a>
                  </div>
                ) : null}
              </div>
            </article>
          ) : (
            <div className="course-room-placeholder">
              <BookOpen size={36} strokeWidth={1.5} className="text-[#0056D2]" />
              <span>{c.textLesson}</span>
            </div>
          )}

          {/* TABS NAVIGATION (Required by tests: navigation named "Sections de la formation") */}
          <nav
            className="course-room-tabs"
            aria-label={ar ? "أقسام الدورة" : en ? "Course sections" : "Sections de la formation"}
          >
            <a href="#overview">{c.overview}</a>
            <a href="#programme" className="course-tab-mobile-only">{c.programme}</a>
            <a href="#questions">{c.questions}</a>
            {data.assessments.length ? <a href="#assessments">{c.assessments}</a> : null}
          </nav>

          {/* TAB SECTION: OVERVIEW / ABOUT */}
          <section className="course-section-card" id="overview" aria-labelledby="course-about-title">
            <div className="course-overview-header">
              <h2 id="course-about-title">{c.about}</h2>
              <p>{description}</p>
            </div>
            <div className="course-overview-grid">
              <div className="course-overview-stat">
                <span className="course-stat-label">{c.trainer}</span>
                <strong className="course-stat-val">{data.course.trainerName}</strong>
              </div>
              <div className="course-overview-stat">
                <span className="course-stat-label">{c.hours}</span>
                <strong className="course-stat-val">
                  {Math.max(1, Math.round(data.course.durationMinutes / 60))} h
                </strong>
              </div>
              <div className="course-overview-stat">
                <span className="course-stat-label">{c.lessons}</span>
                <strong className="course-stat-val">
                  {data.lessons.length} {c.lessons.toLocaleLowerCase(locale)}
                </strong>
              </div>
              <div className="course-overview-stat">
                <span className="course-stat-label">{c.progress}</span>
                <strong className="course-stat-val">{progressPercent}%</strong>
              </div>
            </div>
          </section>

          {/* TAB SECTION: QUESTIONS & DISCUSSION */}
          <section id="questions">
            <CourseDiscussion
              courseId={data.course.id}
              locale={locale}
              items={discussion.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
              currentUserFirstName={(session.user.name ?? "").trim().split(/\s+/)[0] || "ANEI"}
            />
          </section>

          {/* TAB SECTION: ASSESSMENTS (IF PRESENT) */}
          {data.assessments.length ? (
            <section
              className="course-section-card course-room-assessments"
              id="assessments"
              aria-labelledby="course-assessments-title"
            >
              <h2 id="course-assessments-title">{c.assessments}</h2>
              <div className="course-assessments-list">
                {data.assessments.map(({ assessment, attemptCount, bestAttempt }) => {
                  const attemptsLeft = assessment.maxAttempts - attemptCount;
                  return (
                    <article key={assessment.id} className="course-assessment-card">
                      <div className="course-assessment-info">
                        <strong>{ar ? assessment.titleAr : assessment.titleFr}</strong>
                        <small>
                          {bestAttempt
                            ? `${c.best}: ${bestAttempt.percentage}% (${bestAttempt.passed ? c.passed : c.failed})`
                            : attemptsLeft > 0
                            ? `${attemptsLeft} ${c.attempts}`
                            : c.noAttempts}
                        </small>
                      </div>
                      {attemptsLeft > 0 ? (
                        <Link
                          className="course-btn-primary"
                          href={`/${locale}/apprendre/${slug}/quiz/${assessment.id}`}
                        >
                          {bestAttempt ? c.retry : c.startQuiz}
                        </Link>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}
        </main>

        {/* SIDEBAR SYLLABUS DRAWER (28%) */}
        <aside className="course-syllabus-drawer" id="programme" aria-labelledby="course-programme-title">
          <header className="course-syllabus-header">
            <div>
              <h2 id="course-programme-title">{c.programmeTitle}</h2>
              <small>
                {completedLessonsCount}/{data.lessons.length} {c.completed}
              </small>
            </div>
            <div className="course-syllabus-pill">
              {progressPercent}%
            </div>
          </header>

          <div className="course-syllabus-modules">
            {groups.map((group) => (
              <div key={group.module?.id ?? "ungrouped"} className="course-syllabus-group">
                <h3 className="course-syllabus-group-title">
                  {group.module ? (ar ? group.module.titleAr : group.module.titleFr) : c.extra}
                </h3>
                <div className="course-syllabus-group-items">
                  {group.lessons.map((lesson) => {
                    const item = progress.get(lesson.id);
                    const current = activeLesson?.id === lesson.id;
                    const isComplete = item?.completed;
                    return (
                      <Link
                        href={lessonHref(lesson.id)}
                        key={lesson.id}
                        className={`course-syllabus-item ${isComplete ? "is-complete" : ""} ${current ? "is-current" : ""}`}
                        aria-current={current ? "true" : undefined}
                      >
                        <span className="course-syllabus-item-status">
                          {isComplete ? (
                            <Check size={13} strokeWidth={2.5} />
                          ) : current ? (
                            <PlayCircle size={14} className="text-[#0056D2]" />
                          ) : (
                            lesson.position
                          )}
                        </span>
                        <div className="course-syllabus-item-copy">
                          <strong className="course-syllabus-item-title">{ar ? lesson.titleAr : lesson.titleFr}</strong>
                          <span className="course-syllabus-item-meta">{Math.max(1, Math.round(lesson.durationSeconds / 60))} min</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {data.assessments.length ? (
              <div className="course-syllabus-group border-t border-[#E2E8F0] pt-3">
                <h3 className="course-syllabus-group-title flex items-center gap-1.5 text-[#0056D2]">
                  <Award size={14} />
                  <span>{c.assessments}</span>
                </h3>
                <div className="course-syllabus-group-items">
                  {data.assessments.map(({ assessment, attemptCount, bestAttempt }) => {
                    const attemptsLeft = assessment.maxAttempts - attemptCount;
                    return (
                      <Link
                        key={assessment.id}
                        href={`/${locale}/apprendre/${slug}/quiz/${assessment.id}`}
                        className="course-syllabus-item is-assessment"
                      >
                        <span className="course-syllabus-item-status is-quiz">
                          <Award size={13} />
                        </span>
                        <div className="course-syllabus-item-copy">
                          <strong className="course-syllabus-item-title">{ar ? assessment.titleAr : assessment.titleFr}</strong>
                          <span className="course-syllabus-item-meta">
                            {bestAttempt ? `${bestAttempt.percentage}%` : `${attemptsLeft} ${c.attempts}`}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
