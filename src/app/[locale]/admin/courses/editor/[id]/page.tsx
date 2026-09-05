import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCourseAssessments, getAdminCourseCurriculum, getAdminCourseEditorBase, getAdminCoursePublicationSummary } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminLessonForm, AdminModuleForm } from "@/components/admin/AdminOperationsForms";
import { AdminAssessmentBuilder } from "@/components/admin/AdminAssessmentBuilder";
import { AdminCourseEditForm } from "@/components/admin/AdminCourseEditForm";
import { AdminCoursePublicationAction } from "@/components/admin/AdminCoursePublicationAction";
import { AdminModuleRow } from "@/components/admin/AdminModuleRow";
import { AdminLessonRow } from "@/components/admin/AdminLessonRow";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

const editorSections = ["information", "programme", "lessons", "evaluation", "publication", "preview"] as const;
type EditorSection = typeof editorSections[number];

export default async function CourseEditorPage({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  await requireAdminPermission(locale, "courses.update");
  const requestedSection = (await searchParams).section;
  const section: EditorSection = editorSections.includes(requestedSection as EditorSection) ? requestedSection as EditorSection : "information";
  const needsCurriculum = section === "programme" || section === "lessons";
  const needsAssessment = section === "evaluation";
  const needsSummary = section === "publication" || section === "preview";
  const [course, curriculum, assessments, summary] = await Promise.all([
    getAdminCourseEditorBase(id),
    needsCurriculum ? getAdminCourseCurriculum(id) : Promise.resolve(null),
    needsAssessment ? getAdminCourseAssessments(id) : Promise.resolve(null),
    needsSummary ? getAdminCoursePublicationSummary(id) : Promise.resolve(null),
  ]);
  if (!course) notFound();

  const ar = locale === "ar";
  const base = `/${locale}/admin/courses/editor/${id}`;
  const title = ar ? course.titleAr : course.titleFr;
  const courseOption = [{ id: course.id, title }];
  const labels: Record<EditorSection, string> = {
    information: ar ? "المعلومات" : "Informations",
    programme: ar ? "البرنامج" : "Programme",
    lessons: ar ? "الدروس" : "Leçons",
    evaluation: ar ? "التقييم" : "Évaluation",
    publication: ar ? "النشر" : "Publication",
    preview: ar ? "المعاينة" : "Aperçu",
  };
  const lessonCounts = new Map<string, number>();
  curriculum?.lessons.forEach((lesson) => {
    if (lesson.moduleId) lessonCounts.set(lesson.moduleId, (lessonCounts.get(lesson.moduleId) ?? 0) + 1);
  });
  const publicUrl = `/${locale}/formations/${course.slug}`;

  return <div className="admin-editor-workspace">
    <div className="admin-editor-sticky-header">
      <AdminPageHeader locale={locale} eyebrow={ar ? "محرر الدورات" : "Éditeur de cours"} title={title}
        description={ar ? `آخر تحديث ${formatDate(course.updatedAt, locale)}` : `Dernière mise à jour ${formatDate(course.updatedAt, locale)}`}
        actions={<div className="admin-editor-actions">
          <span className={`admin-status ${course.published ? "is-success" : "is-neutral"}`}>{course.published ? (ar ? "منشورة" : "Publiée") : (ar ? "مسودة" : "Brouillon")}</span>
          <Link className="btn btn-secondary btn-sm" href={publicUrl} target="_blank"><Icon name="play" size={16}/>{ar ? "معاينة" : "Aperçu"}</Link>
          {section === "information" ? <button className="btn btn-primary btn-sm" type="submit" form="admin-course-information-form">{ar ? "حفظ" : "Enregistrer"}</button> : null}
          <AdminCoursePublicationAction locale={locale} courseId={id} published={course.published}/>
          <AdminDeleteButton locale={locale} endpoint={`/api/admin/courses/${id}`} confirmMessage={ar ? "هل تريد حذف هذه الدورة؟" : "Supprimer cette formation ?"} label={ar ? "حذف" : "Supprimer"}/>
        </div>}/>
      <nav className="admin-editor-steps" aria-label={ar ? "مراحل التحرير" : "Étapes de l’éditeur"}>
        {editorSections.map((item, index) => <Link key={item} href={`${base}?section=${item}`} className={section === item ? "is-current" : ""} aria-current={section === item ? "step" : undefined}>
          <span>{index + 1}</span>{labels[item]}
        </Link>)}
      </nav>
    </div>

    {section === "information" ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-information-title">
      <header><div><span>{ar ? "الأساسيات" : "Essentiel"}</span><h2 id="editor-information-title">{labels.information}</h2></div><p>{ar ? "ابدأ بالعنوان والوصف، ثم أكمل تفاصيل العرض." : "Commencez par le titre et la promesse, puis complétez les paramètres de l’offre."}</p></header>
      <AdminCourseEditForm locale={locale} course={course}/>
    </section> : null}

    {section === "programme" && curriculum ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-programme-title">
      <header><div><span>{curriculum.modules.length} {ar ? "وحدات" : "modules"}</span><h2 id="editor-programme-title">{labels.programme}</h2></div><p>{ar ? "نظّم تسلسل التعلّم إلى وحدات واضحة." : "Organisez la progression pédagogique en modules clairs."}</p></header>
      <details className="admin-editor-create-panel"><summary><Icon name="book" size={17}/>{ar ? "إضافة وحدة" : "Ajouter un module"}</summary><AdminModuleForm locale={locale} courses={courseOption}/></details>
      <div className="admin-curriculum-list">{curriculum.modules.map((module) => <AdminModuleRow key={module.id} locale={locale} module={module} lessonCount={lessonCounts.get(module.id) ?? 0}/>)}</div>
      {!curriculum.modules.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد وحدات بعد" : "Aucun module pour le moment"}</strong><p>{ar ? "أضف الوحدة الأولى لبناء مسار التعلّم." : "Ajoutez le premier module pour structurer le parcours."}</p></div> : null}
    </section> : null}

    {section === "lessons" && curriculum ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-lessons-title">
      <header><div><span>{curriculum.lessons.length} {ar ? "دروس" : "leçons"}</span><h2 id="editor-lessons-title">{labels.lessons}</h2></div><p>{ar ? "أدر المحتوى والوسائط ضمن سياق الوحدة." : "Gérez le contenu et les médias dans le contexte de chaque module."}</p></header>
      <details className="admin-editor-create-panel"><summary><Icon name="play" size={17}/>{ar ? "إضافة درس" : "Ajouter une leçon"}</summary><AdminLessonForm locale={locale} courses={courseOption} modules={curriculum.modules.map((module) => ({ id: module.id, courseId: module.courseId, title: ar ? module.titleAr : module.titleFr }))}/></details>
      <div className="admin-curriculum-list">{curriculum.lessons.map((lesson) => <AdminLessonRow key={lesson.id} locale={locale} courseId={course.id} lesson={lesson} modules={curriculum.modules.map((module) => ({ id: module.id, title: ar ? module.titleAr : module.titleFr }))}/>)}</div>
      {!curriculum.lessons.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد دروس بعد" : "Aucune leçon pour le moment"}</strong><p>{ar ? "أضف درساً واربطه بوحدة عند الحاجة." : "Ajoutez une leçon et rattachez-la à un module si nécessaire."}</p></div> : null}
    </section> : null}

    {section === "evaluation" && assessments ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-evaluation-title">
      <header><div><span>{assessments.length} {ar ? "اختبارات" : "quiz"}</span><h2 id="editor-evaluation-title">{labels.evaluation}</h2></div><p>{ar ? "أنشئ التقييم، ثم أضف الأسئلة وانشره." : "Créez le quiz, ajoutez ses questions, puis publiez-le."}</p></header>
      <AdminAssessmentBuilder locale={locale} courseId={id} assessments={assessments.map((item) => ({
        id: item.id,
        titleFr: item.titleFr,
        titleAr: item.titleAr,
        instructionsFr: item.instructionsFr,
        instructionsAr: item.instructionsAr,
        timeLimitSeconds: item.timeLimitSeconds,
        passingScore: item.passingScore,
        maxAttempts: item.maxAttempts,
        published: item.published,
        attemptCount: item.attemptCount,
        questions: item.questions,
      }))}/>
    </section> : null}

    {section === "publication" && summary ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-publication-title">
      <header><div><span>{ar ? "جاهزية" : "État de préparation"}</span><h2 id="editor-publication-title">{labels.publication}</h2></div><p>{ar ? "راجع العناصر الأساسية قبل إتاحة الدورة للمتعلمين." : "Vérifiez les éléments essentiels avant de rendre la formation accessible."}</p></header>
      <dl className="admin-readiness-list">
        <div><dt>{ar ? "معلومات الدورة" : "Informations"}</dt><dd className="is-complete"><Icon name="check" size={16}/>{ar ? "مكتملة" : "Complètes"}</dd></div>
        <div><dt>{ar ? "الوحدات" : "Modules"}</dt><dd className={summary.modules ? "is-complete" : "is-missing"}>{summary.modules} {ar ? "وحدات" : "modules"}</dd></div>
        <div><dt>{ar ? "الدروس" : "Leçons"}</dt><dd className={summary.lessons ? "is-complete" : "is-missing"}>{summary.lessons} {ar ? "دروس" : "leçons"}</dd></div>
        <div><dt>{ar ? "التقييم" : "Évaluation"}</dt><dd className={summary.assessments ? "is-complete" : "is-missing"}>{summary.assessments ? (ar ? "مهيأة" : "Configurée") : (ar ? "غير مهيأة" : "Absente")}</dd></div>
        <div><dt>{ar ? "صورة الغلاف" : "Image de couverture"}</dt><dd className={course.coverImage ? "is-complete" : "is-missing"}>{course.coverImage ? (ar ? "مهيأة" : "Configurée") : (ar ? "غير مهيأة" : "Absente")}</dd></div>
        <div><dt>{ar ? "السعر" : "Prix"}</dt><dd>{course.priceMillimes ? formatMillimes(course.priceMillimes, locale) : (ar ? "مجانية" : "Gratuite")}</dd></div>
        <div><dt>{ar ? "الرؤية" : "Visibilité"}</dt><dd><span className={`admin-status ${course.published ? "is-success" : "is-neutral"}`}>{course.published ? (ar ? "منشورة" : "Publiée") : (ar ? "مسودة" : "Brouillon")}</span></dd></div>
      </dl>
      <div className="admin-publication-footer"><p>{course.published ? (ar ? "الدورة متاحة حالياً في الكتالوج العام." : "La formation est actuellement visible dans le catalogue public.") : (ar ? "النشر يجعل الدورة مرئية في الكتالوج العام." : "La publication rend la formation visible dans le catalogue public.")}</p><AdminCoursePublicationAction locale={locale} courseId={id} published={course.published}/></div>
    </section> : null}

    {section === "preview" && summary ? <section className="admin-surface admin-editor-section" aria-labelledby="editor-preview-title">
      <header><div><span>{ar ? "فحص نهائي" : "Contrôle final"}</span><h2 id="editor-preview-title">{labels.preview}</h2></div><p>{ar ? "افتح الصفحة العامة للتحقق من النسختين الفرنسية والعربية." : "Ouvrez la page publique pour vérifier les versions française et arabe."}</p></header>
      <div className="admin-preview-panel"><div><strong>{title}</strong><span>{summary.modules} {ar ? "وحدات" : "modules"} · {summary.lessons} {ar ? "دروس" : "leçons"}</span></div><div className="admin-row-actions"><Link className="btn btn-secondary" href={`/fr/formations/${course.slug}`} target="_blank">Aperçu FR</Link><Link className="btn btn-secondary" href={`/ar/formations/${course.slug}`} target="_blank">معاينة AR</Link></div></div>
    </section> : null}
  </div>;
}
