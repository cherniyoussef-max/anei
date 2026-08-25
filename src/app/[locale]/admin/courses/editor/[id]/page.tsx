import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCourseEditor } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminLessonForm, AdminModuleForm } from "@/components/admin/AdminOperationsForms";
import { AdminAssessmentBuilder } from "@/components/admin/AdminAssessmentBuilder";
import { AdminCourseEditForm } from "@/components/admin/AdminCourseEditForm";
import { AdminModuleRow } from "@/components/admin/AdminModuleRow";
import { AdminLessonRow } from "@/components/admin/AdminLessonRow";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export const dynamic = "force-dynamic";
export default async function CourseEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params; if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  await requireAdminPermission(locale, "courses.update"); const data = await getAdminCourseEditor(id); if (!data) notFound(); const ar = locale === "ar";
  const courseOption = [{ id: data.course.id, title: ar ? data.course.titleAr : data.course.titleFr }];
  return <><AdminPageHeader locale={locale} eyebrow={ar ? "محرر الدورات" : "Éditeur de cours"} title={ar ? data.course.titleAr : data.course.titleFr} description={ar ? "نظّم البرنامج والمحتوى والتقييم قبل النشر." : "Structurez le programme, le contenu et l’évaluation avant publication."}
      actions={<AdminDeleteButton locale={locale} endpoint={`/api/admin/courses/${id}`} confirmMessage={ar ? "هل تريد حذف هذه الدورة؟" : "Supprimer cette formation ?"} label={ar ? "حذف الدورة" : "Supprimer la formation"}/>}/>
    <nav className="admin-editor-steps" aria-label={ar ? "مراحل التحرير" : "Étapes de l’éditeur"}>{[ar?"المعلومات":"Informations",ar?"البرنامج":"Programme",ar?"المحتوى":"Contenu",ar?"التقييم":"Évaluation",ar?"الوصول والسعر":"Accès / prix",ar?"المراجعة":"Révision"].map((label,index)=><span key={label} className={index===1?"is-current":""}>{index+1}. {label}</span>)}</nav>
    <div className="admin-editor-stack">
    <section className="admin-surface"><header><div><span>01</span><h2>{ar ? "المعلومات" : "Informations"}</h2></div></header><AdminCourseEditForm locale={locale} course={data.course}/></section>
    <section className="admin-surface"><header><div><span>02</span><h2>{ar ? "الوحدات" : "Programme · modules"}</h2></div></header><AdminModuleForm locale={locale} courses={courseOption}/><div className="admin-curriculum-list">{data.modules.map((module)=><AdminModuleRow key={module.id} locale={locale} module={module} lessonCount={data.lessons.filter((lesson)=>lesson.moduleId===module.id).length}/>)}</div></section>
    <section className="admin-surface"><header><div><span>03</span><h2>{ar ? "الدروس والمحتوى" : "Leçons et contenu"}</h2></div></header><AdminLessonForm locale={locale} courses={courseOption} modules={data.modules.map((module)=>({id:module.id,courseId:module.courseId,title:ar?module.titleAr:module.titleFr}))}/><div className="admin-curriculum-list">{data.lessons.map((lesson)=><AdminLessonRow key={lesson.id} locale={locale} lesson={lesson} modules={data.modules.map((module)=>({id:module.id,title:ar?module.titleAr:module.titleFr}))}/>)}</div></section>
    <section className="admin-surface"><header><div><span>04</span><h2>{ar ? "التقييم" : "Évaluation"}</h2></div></header><AdminAssessmentBuilder locale={locale} courseId={id} assessments={data.assessments.map((item)=>({id:item.id,title:ar?item.titleAr:item.titleFr,published:item.published,questions:item.questions.map((question)=>({id:question.id,prompt:ar?question.promptAr:question.promptFr,type:question.type,points:question.points}))}))}/></section></div>
  </>;
}
