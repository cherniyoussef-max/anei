import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCourseList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCourseForm } from "@/components/admin/AdminCourseForm";

export default async function CourseEditorIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound(); await requireAdminPermission(locale, "courses.create");
  const rows = await getAdminCourseList(); const ar = locale === "ar";
  return <><AdminPageHeader locale={locale} eyebrow={ar ? "محرر الدورات" : "Éditeur de cours"} title={ar ? "إنشاء دورة" : "Créer une formation"} description={ar ? "ابدأ بمعلومات الدورة، ثم نظّم الوحدات والدروس والتقييم." : "Commencez par les informations, puis structurez modules, leçons et évaluation."}/>
    <div className="admin-editor-layout"><section className="admin-surface"><h2>{ar ? "1. المعلومات" : "1. Informations"}</h2><AdminCourseForm locale={locale}/></section><aside className="admin-surface"><h2>{ar ? "الدورات الحالية" : "Formations existantes"}</h2><div className="admin-list">{rows.map((row) => <article key={row.id}><div><strong>{ar ? row.title_ar : row.title_fr}</strong><small>{row.published ? (ar ? "منشورة" : "Publiée") : (ar ? "مسودة" : "Brouillon")}</small></div><Link className="admin-row-link" href={`/${locale}/admin/courses/editor/${row.id}`}>{ar ? "فتح" : "Ouvrir"}</Link></article>)}</div></aside></div>
  </>;
}
