import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCourseList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export const dynamic = "force-dynamic";
export default async function AdminCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "courses.read");
  const rows = await getAdminCourseList(); const ar = locale === "ar";
  return <><AdminPageHeader locale={locale} eyebrow={ar ? "التعلّم" : "Apprentissage"} title={ar ? "الدورات" : "Formations"} description={ar ? "إدارة النشر والمحتوى وأداء المتعلمين." : "Gérez la publication, le contenu et la performance pédagogique."} actions={<Link className="admin-primary-button" href={`/${locale}/admin/courses/editor`}>{ar ? "إنشاء دورة" : "Créer une formation"}</Link>}/>
    <section className="admin-table-surface"><div className="admin-table-scroll"><table className="admin-data-table"><thead><tr><th>{ar ? "الدورة" : "Formation"}</th><th>{ar ? "الحالة" : "État"}</th><th>{ar ? "المستوى" : "Niveau"}</th><th>{ar ? "السعر" : "Prix"}</th><th>{ar ? "المتعلمون" : "Apprenants"}</th><th>{ar ? "متوسط التقدم" : "Progression"}</th><th>{ar ? "التحديث" : "Mise à jour"}</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{ar ? row.title_ar : row.title_fr}</strong><small className="admin-cell-subtitle">{row.category} · {row.mode}</small></td><td><span className={`admin-status ${row.published ? "is-success" : "is-neutral"}`}>{row.published ? (ar ? "منشورة" : "Publiée") : (ar ? "مسودة" : "Brouillon")}</span></td><td>{row.level}</td><td className="numeric">{row.price_millimes ? formatMillimes(row.price_millimes, locale) : (ar ? "مجانية" : "Gratuite")}</td><td className="numeric">{row.enrollments}</td><td className="numeric">{row.completion_rate}%</td><td>{formatDate(row.updated_at, locale)}</td><td><div className="admin-row-actions"><Link className="admin-row-link" href={`/${locale}/admin/courses/editor/${row.id}`}>{ar ? "تحرير" : "Modifier"}</Link><AdminDeleteButton locale={locale} endpoint={`/api/admin/courses/${row.id}`} confirmMessage={ar ? "هل تريد حذف هذه الدورة؟" : "Supprimer cette formation ?"} /></div></td></tr>)}</tbody></table></div>{!rows.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد دورات" : "Aucune formation"}</strong><p>{ar ? "أنشئ أول دورة للبدء." : "Créez la première formation pour commencer."}</p></div> : null}</section>
  </>;
}
