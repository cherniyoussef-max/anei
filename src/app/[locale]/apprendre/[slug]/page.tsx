import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearningCourse } from "@/server/queries/account";
import { VideoLessonPlayer } from "@/components/learning/VideoLessonPlayer";
import { YoutubeLessonPlayer } from "@/components/learning/YoutubeLessonPlayer";
import { StreamLessonPlayer } from "@/components/learning/StreamLessonPlayer";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function LearnPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const data = await getLearningCourse(session.user.id, slug);
  if (!data) notFound();

  const ar = locale === "ar";
  const progress = new Map(data.progress.map((item) => [item.lessonId, item] as const));
  const modules = data.modules.map((courseModule) => ({
    module: courseModule,
    lessons: data.lessons.filter((lesson) => lesson.moduleId === courseModule.id),
  })).filter((group) => group.lessons.length > 0);
  const ungrouped = data.lessons.filter((lesson) => !lesson.moduleId || !data.modules.some((courseModule) => courseModule.id === lesson.moduleId));
  const groups = [
    ...modules,
    ...(ungrouped.length ? [{ module: null, lessons: ungrouped }] : []),
  ];
  const firstIncomplete = data.lessons.find((lesson) => !progress.get(lesson.id)?.completed) ?? data.lessons[0];

  return <section className="learning-workspace">
    <div className="container">
      <div className="learning-header">
        <div>
          <Link className="learning-breadcrumb" href={`/${locale}/dashboard`}>← {ar ? "مساحتي" : "Mon espace"}</Link>
          <span className="eyebrow">{ar ? "مسار التعلّم" : "Espace de formation"}</span>
          <h1>{ar ? data.course.titleAr : data.course.titleFr}</h1>
          <p>{ar ? "يُحفظ تقدمك تلقائيًا أثناء المشاهدة. يمكنك الرجوع من أي جهاز متصل بحسابك." : "Votre progression est enregistrée automatiquement pendant le visionnage et vous suit sur vos appareils connectés."}</p>
          {firstIncomplete ? <a className="btn btn-primary btn-sm" href={`#lesson-${firstIncomplete.id}`}><Icon name="play" size={16}/>{ar ? "متابعة التعلّم" : "Reprendre la formation"}</a> : null}
        </div>
        <div className="learning-progress-card" aria-label={`${data.enrollment.progressPercent}%`}>
          <strong>{data.enrollment.progressPercent}%</strong>
          <span>{ar ? "مكتمل" : "complété"}</span>
          <div className="learning-progress-track" aria-hidden="true"><span style={{ width: `${data.enrollment.progressPercent}%` }}/></div>
        </div>
      </div>

      <div className="lesson-grid">
        <aside className="lesson-sidebar" aria-label={ar ? "برنامج الدورة" : "Programme de la formation"}>
          <div className="lesson-sidebar-head"><h2>{ar ? "البرنامج" : "Programme"}</h2><small>{data.lessons.length} {ar ? "درس" : "leçons"}</small></div>
          {groups.map((group, groupIndex) => <div className="lesson-module-nav" key={group.module?.id ?? "ungrouped"}>
            <h3>{group.module ? (ar ? group.module.titleAr : group.module.titleFr) : ar ? "دروس إضافية" : "Leçons complémentaires"}</h3>
            {group.lessons.map((lesson) => {
              const itemProgress = progress.get(lesson.id);
              return <a href={`#lesson-${lesson.id}`} key={lesson.id} className={itemProgress?.completed ? "lesson-nav done" : "lesson-nav"}>
                <span>{itemProgress?.completed ? <Icon name="check" size={14}/> : lesson.position}</span>
                <div><strong>{ar ? lesson.titleAr : lesson.titleFr}</strong><small>{Math.max(1, Math.round(lesson.durationSeconds / 60))} min</small></div>
              </a>;
            })}
            {groupIndex < groups.length - 1 ? <div className="module-separator"/> : null}
          </div>)}
        </aside>

        <div className="lesson-content">
          {groups.map((group) => <section className="learning-module-section" key={group.module?.id ?? "ungrouped-content"}>
            {group.module ? <header className="learning-module-head"><span>{ar ? `الوحدة ${group.module.position}` : `Module ${group.module.position}`}</span><h2>{ar ? group.module.titleAr : group.module.titleFr}</h2>{(ar ? group.module.descriptionAr : group.module.descriptionFr) ? <p>{ar ? group.module.descriptionAr : group.module.descriptionFr}</p> : null}</header> : null}
            {group.lessons.map((lesson) => {
              const itemProgress = progress.get(lesson.id);
              const lessonIndex = data.lessons.findIndex((item) => item.id === lesson.id);
              const previous = lessonIndex > 0 ? data.lessons[lessonIndex - 1] : null;
              const next = lessonIndex < data.lessons.length - 1 ? data.lessons[lessonIndex + 1] : null;
              return <article id={`lesson-${lesson.id}`} className="lesson-section" key={lesson.id}>
                <div className="lesson-title"><span>{itemProgress?.completed ? <Icon name="check" size={14}/> : lesson.position}</span><div><small>{ar ? "درس" : "Leçon"} {lesson.position}</small><h2>{ar ? lesson.titleAr : lesson.titleFr}</h2><p>{ar ? lesson.descriptionAr : lesson.descriptionFr}</p></div></div>
                {lesson.mediaProvider === "youtube" && lesson.mediaRef ? <YoutubeLessonPlayer videoId={lesson.mediaRef} title={ar ? lesson.titleAr : lesson.titleFr} locale={locale}/>
                  : lesson.mediaProvider === "cloudflare_stream" && lesson.mediaRef ? <StreamLessonPlayer lessonId={lesson.id} title={ar ? lesson.titleAr : lesson.titleFr} locale={locale}/>
                  : lesson.videoUrl ? <VideoLessonPlayer lessonId={lesson.id} videoUrl={lesson.videoUrl} title={ar ? lesson.titleAr : lesson.titleFr} initialSeconds={itemProgress?.watchedSeconds ?? 0} initiallyCompleted={itemProgress?.completed ?? false} locale={locale}/>
                  : <div className="lesson-placeholder"><Icon name="book" size={26}/><span>{ar ? "درس نصي / وثيقة" : "Leçon documentaire"}</span></div>}
                {lesson.documentUrl ? <a className="btn btn-soft btn-sm" href={lesson.documentUrl} target="_blank" rel="noreferrer"><Icon name="download" size={16}/>{ar ? "الوثيقة المرفقة" : "Document associé"}</a> : null}
                <nav className="lesson-step-nav" aria-label={ar ? "التنقل بين الدروس" : "Navigation entre les leçons"}>
                  {previous ? <a href={`#lesson-${previous.id}`}><Icon name="arrow" size={15}/>{ar ? "السابق" : "Précédent"}</a> : <span/>}
                  {next ? <a href={`#lesson-${next.id}`}>{ar ? "التالي" : "Suivant"}<Icon name="arrow" size={15}/></a> : <span className="completion-label"><Icon name="award" size={16}/>{ar ? "نهاية المسار" : "Fin du parcours"}</span>}
                </nav>
              </article>;
            })}
          </section>)}
        </div>
      </div>
    </div>
  </section>;
}
