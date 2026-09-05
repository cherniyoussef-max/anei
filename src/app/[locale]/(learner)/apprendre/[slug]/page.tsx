import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseDiscussion } from "@/components/learning/CourseDiscussion";
import { StreamLessonPlayer } from "@/components/learning/StreamLessonPlayer";
import { VideoLessonPlayer } from "@/components/learning/VideoLessonPlayer";
import { YoutubeLessonPlayer } from "@/components/learning/YoutubeLessonPlayer";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, UserCheck, PlayCircle, Check, BookOpen, Download, Award } from "lucide-react";
import { courses as courseTranslations } from "@/lib/data";
import { isLocale } from "@/lib/i18n";
import { getCourseVisual } from "@/lib/visuals";
import { requireUser } from "@/server/auth/session";
import { getLearningCourse } from "@/server/queries/account";
import { getCourseDiscussion } from "@/server/services/course-discussion";
import { getCheckpointsForLearner } from "@/server/services/video-checkpoints";
import "./course-room.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

const labels = {
  en: { back: "My courses", room: "Course room", overview: "Overview", programme: "Programme", lessons: "Lessons", questions: "Questions", continue: "Continue learning", completed: "completed", progress: "Course progress", about: "About this course", aboutBody: "Use this space to follow the programme, complete each lesson and ask practical questions as you progress.", programmeTitle: "Course programme", lesson: "Lesson", extra: "Additional lessons", document: "Attached document", textLesson: "Document lesson", previous: "Previous", next: "Next", end: "End of course", assessments: "Assessments", best: "Best score", passed: "Passed", failed: "Not passed", attempts: "attempt(s) remaining", noAttempts: "No attempts remaining", retry: "Try again", startQuiz: "Start assessment", hours: "hours", trainer: "Trainer" },
  fr: { back: "Mes formations", room: "Espace de formation", overview: "Vue d’ensemble", programme: "Programme", lessons: "Leçons", questions: "Questions", continue: "Continuer la formation", completed: "terminé", progress: "Progression du parcours", about: "À propos de ce parcours", aboutBody: "Retrouvez ici le programme, vos leçons et un espace de questions pratiques pour avancer avec des repères clairs.", programmeTitle: "Programme de la formation", lesson: "Leçon", extra: "Leçons complémentaires", document: "Document associé", textLesson: "Leçon documentaire", previous: "Précédent", next: "Suivant", end: "Fin du parcours", assessments: "Évaluations", best: "Meilleur score", passed: "Réussi", failed: "Non réussi", attempts: "tentative(s) restante(s)", noAttempts: "Plus de tentative disponible", retry: "Retenter", startQuiz: "Commencer l’évaluation", hours: "heures", trainer: "Formateur" },
  ar: { back: "دوراتي", room: "مساحة الدورة", overview: "نظرة عامة", programme: "البرنامج", lessons: "الدروس", questions: "الأسئلة", continue: "متابعة التعلم", completed: "مكتمل", progress: "تقدم الدورة", about: "عن هذه الدورة", aboutBody: "تابع البرنامج والدروس واطرح أسئلتك العملية من مساحة واحدة تساعدك على التقدم بوضوح.", programmeTitle: "برنامج الدورة", lesson: "الدرس", extra: "دروس إضافية", document: "الوثيقة المرفقة", textLesson: "درس وثائقي", previous: "السابق", next: "التالي", end: "نهاية الدورة", assessments: "التقييمات", best: "أفضل نتيجة", passed: "ناجح", failed: "غير ناجح", attempts: "محاولات متبقية", noAttempts: "لا توجد محاولات متبقية", retry: "إعادة المحاولة", startQuiz: "بدء التقييم", hours: "ساعات", trainer: "المكوّن" },
} as const;

export default async function CourseRoomPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ lesson?: string }> }) {
  const { locale, slug } = await params;
  const { lesson: requestedLessonId } = await searchParams;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const data = await getLearningCourse(session.user.id, slug);
  if (!data) notFound();
  const discussion = await getCourseDiscussion(session.user.id, data.course.id);
  if (!discussion) notFound();

  const c = labels[locale];
  const ar = locale === "ar";
  const en = locale === "en";
  const translated = courseTranslations.find((item) => item.slug === data.course.slug);
  const title = ar ? data.course.titleAr : en ? translated?.title.en ?? data.course.titleFr : data.course.titleFr;
  const description = ar ? data.course.descriptionAr : en ? translated?.description.en ?? data.course.descriptionFr : data.course.descriptionFr;
  const progress = new Map(data.progress.map((item) => [item.lessonId, item] as const));
  const modules = data.modules.map((courseModule) => ({ module: courseModule, lessons: data.lessons.filter((lesson) => lesson.moduleId === courseModule.id) })).filter((group) => group.lessons.length > 0);
  const ungrouped = data.lessons.filter((lesson) => !lesson.moduleId || !data.modules.some((courseModule) => courseModule.id === lesson.moduleId));
  const groups = [...modules, ...(ungrouped.length ? [{ module: null, lessons: ungrouped }] : [])];
  const firstIncomplete = data.lessons.find((lesson) => !progress.get(lesson.id)?.completed) ?? data.lessons[0];
  const activeLesson = data.lessons.find((lesson) => lesson.id === requestedLessonId) ?? firstIncomplete;
  const activeLessonIndex = activeLesson ? data.lessons.findIndex((lesson) => lesson.id === activeLesson.id) : -1;
  const previousLesson = activeLessonIndex > 0 ? data.lessons[activeLessonIndex - 1] : null;
  const nextLesson = activeLessonIndex >= 0 && activeLessonIndex < data.lessons.length - 1 ? data.lessons[activeLessonIndex + 1] : null;
  const activeGroup = activeLesson ? groups.find((group) => group.lessons.some((lesson) => lesson.id === activeLesson.id)) : null;
  const activeProgress = activeLesson ? progress.get(activeLesson.id) : null;
  const lessonHref = (lessonId: string) => `/${locale}/apprendre/${slug}?lesson=${lessonId}#lessons`;
  const isNativeVideoLesson = Boolean(activeLesson && !(activeLesson.mediaProvider === "youtube" && activeLesson.mediaRef) && !(activeLesson.mediaProvider === "cloudflare_stream" && activeLesson.mediaRef) && activeLesson.videoUrl);
  const checkpoints = isNativeVideoLesson && activeLesson ? await getCheckpointsForLearner(activeLesson.id, data.enrollment.id) : [];

  return <div className="course-room">
    <header className="course-room-hero" id="overview">
      <div className="course-room-hero-copy">
        <Link className="course-room-back" href={`/${locale}/dashboard/formations`}><ArrowLeft className="course-room-back-icon" size={17} strokeWidth={1.75}/>{c.back}</Link>
        <p className="course-room-context">{c.room}</p>
        <h1>{title}</h1>
        <p className="course-room-lead">{description}</p>
        <div className="course-room-meta"><span><Clock size={17} strokeWidth={1.75}/>{Math.max(1, Math.round(data.course.durationMinutes / 60))} {c.hours}</span><span><UserCheck size={17} strokeWidth={1.75}/>{c.trainer}: {data.course.trainerName}</span></div>
        {firstIncomplete ? <Link className="course-room-primary" href={lessonHref(firstIncomplete.id)}><PlayCircle size={17} strokeWidth={1.75}/>{c.continue}</Link> : null}
      </div>
      <div className="course-room-progress-panel">
        <Image src={getCourseVisual(data.course.slug)} alt="" fill priority sizes="(max-width: 767px) 100vw, 360px"/>
        <div className="course-room-progress-copy"><span>{c.progress}</span><strong>{data.enrollment.progressPercent}%</strong><progress max={100} value={data.enrollment.progressPercent} aria-label={`${c.progress}: ${data.enrollment.progressPercent}%`}>{data.enrollment.progressPercent}%</progress><small>{data.enrollment.progressPercent}% {c.completed}</small></div>
      </div>
    </header>

    <nav className="course-room-tabs" aria-label={ar ? "أقسام الدورة" : en ? "Course sections" : "Sections de la formation"}>
      <a href="#overview">{c.overview}</a><a href="#programme">{c.programme}</a><a href="#lessons">{c.lessons}</a><a href="#questions">{c.questions}</a>
    </nav>

    <section className="course-room-introduction" aria-labelledby="course-about-title"><div><h2 id="course-about-title">{c.about}</h2><p>{c.aboutBody}</p></div><dl><div><dt>{c.lessons}</dt><dd>{data.lessons.length}</dd></div><div><dt>{c.programme}</dt><dd>{groups.length}</dd></div><div><dt>{c.trainer}</dt><dd>{data.course.trainerName}</dd></div></dl></section>

    <div className="course-room-learning-layout">
      <aside className="course-room-programme" id="programme" aria-labelledby="course-programme-title"><header><h2 id="course-programme-title">{c.programmeTitle}</h2><small>{data.lessons.length} {c.lessons.toLocaleLowerCase(locale)}</small></header>{groups.map((group) => <section key={group.module?.id ?? "ungrouped"}><h3>{group.module ? (ar ? group.module.titleAr : group.module.titleFr) : c.extra}</h3>{group.lessons.map((lesson) => { const item = progress.get(lesson.id); const current = activeLesson?.id === lesson.id; return <Link href={lessonHref(lesson.id)} key={lesson.id} className={`${item?.completed ? "is-complete" : ""}${current ? " is-current" : ""}`} aria-current={current ? "true" : undefined}><span>{item?.completed ? <Check size={14} strokeWidth={1.75}/> : lesson.position}</span><div><strong>{ar ? lesson.titleAr : lesson.titleFr}</strong><small>{Math.max(1, Math.round(lesson.durationSeconds / 60))} min</small></div></Link>; })}</section>)}</aside>

      <main className="course-room-lessons" id="lessons">{activeLesson ? <section className="course-room-module">{activeGroup?.module ? <header><span>{c.programme}</span><h2>{ar ? activeGroup.module.titleAr : activeGroup.module.titleFr}</h2>{(ar ? activeGroup.module.descriptionAr : activeGroup.module.descriptionFr) ? <p>{ar ? activeGroup.module.descriptionAr : activeGroup.module.descriptionFr}</p> : null}</header> : null}<article id={`lesson-${activeLesson.id}`} className="course-room-lesson"><div className="course-room-lesson-title"><span>{activeProgress?.completed ? <Check size={14} strokeWidth={1.75}/> : activeLesson.position}</span><div><small>{c.lesson} {activeLesson.position}</small><h2>{ar ? activeLesson.titleAr : activeLesson.titleFr}</h2>{(ar ? activeLesson.descriptionAr : activeLesson.descriptionFr) ? <p>{ar ? activeLesson.descriptionAr : activeLesson.descriptionFr}</p> : null}</div></div>{activeLesson.mediaProvider === "youtube" && activeLesson.mediaRef ? <YoutubeLessonPlayer videoId={activeLesson.mediaRef} title={ar ? activeLesson.titleAr : activeLesson.titleFr} locale={locale}/> : activeLesson.mediaProvider === "cloudflare_stream" && activeLesson.mediaRef ? <StreamLessonPlayer lessonId={activeLesson.id} title={ar ? activeLesson.titleAr : activeLesson.titleFr} locale={locale}/> : activeLesson.videoUrl ? <VideoLessonPlayer lessonId={activeLesson.id} videoUrl={activeLesson.videoUrl} title={ar ? activeLesson.titleAr : activeLesson.titleFr} initialSeconds={activeProgress?.watchedSeconds ?? 0} initiallyCompleted={activeProgress?.completed ?? false} locale={locale} checkpoints={checkpoints} nextLessonHref={nextLesson ? lessonHref(nextLesson.id) : undefined} previousLessonHref={previousLesson ? lessonHref(previousLesson.id) : undefined}/> : <div className="course-room-placeholder"><BookOpen size={24} strokeWidth={1.75}/><span>{c.textLesson}</span></div>}{activeLesson.documentUrl ? <a className="course-room-secondary" href={activeLesson.documentUrl} target="_blank" rel="noreferrer"><Download size={16} strokeWidth={1.75}/>{c.document}</a> : null}<nav className="course-room-step-nav" aria-label={ar ? "التنقل بين الدروس" : en ? "Lesson navigation" : "Navigation entre les leçons"}>{previousLesson ? <Link href={lessonHref(previousLesson.id)}><ChevronLeft size={15} strokeWidth={1.75}/>{c.previous}</Link> : <span/>}{nextLesson ? <Link href={lessonHref(nextLesson.id)}>{c.next}<ChevronRight size={15} strokeWidth={1.75}/></Link> : <span><Award size={16} strokeWidth={1.75}/>{c.end}</span>}</nav></article></section> : <div className="course-room-placeholder"><BookOpen size={24} strokeWidth={1.75}/><span>{c.textLesson}</span></div>}</main>
    </div>

    {data.assessments.length ? <section className="course-room-assessments" aria-labelledby="course-assessments-title"><h2 id="course-assessments-title">{c.assessments}</h2>{data.assessments.map(({ assessment, attemptCount, bestAttempt }) => { const attemptsLeft = assessment.maxAttempts - attemptCount; return <article key={assessment.id}><div><strong>{ar ? assessment.titleAr : assessment.titleFr}</strong><small>{bestAttempt ? `${c.best}: ${bestAttempt.percentage}% (${bestAttempt.passed ? c.passed : c.failed})` : attemptsLeft > 0 ? `${attemptsLeft} ${c.attempts}` : c.noAttempts}</small></div>{attemptsLeft > 0 ? <Link className="course-room-primary" href={`/${locale}/apprendre/${slug}/quiz/${assessment.id}`}>{bestAttempt ? c.retry : c.startQuiz}</Link> : null}</article>; })}</section> : null}

    <CourseDiscussion
      courseId={data.course.id}
      locale={locale}
      items={discussion.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}
      currentUserFirstName={session.user.name.trim().split(/\s+/)[0] || "ANEI"}
    />
  </div>;
}
