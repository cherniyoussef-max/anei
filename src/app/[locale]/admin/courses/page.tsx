import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCourseList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "courses.read");
  const rows = await getAdminCourseList();
  const ar = locale === "ar";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "التعلّم والمحتوى" : "Apprentissage & Contenu"}
        title={ar ? "الدورات والبرامج التدريبية" : "Catalogue des Formations"}
        description={
          ar
            ? "إدارة النشر والمحتوى الرقمي ومتابعة نسب إكمال المتعلمين."
            : "Gérez la publication, le contenu pédagogique et la performance des apprenants."
        }
        actions={
          <Link
            className="h-9 px-4 rounded-md bg-[#0056D2] hover:bg-[#00419E] text-white text-[13px] font-semibold inline-flex items-center gap-1.5 transition-colors shadow-2xs"
            href={`/${locale}/admin/courses/editor`}
          >
            <Plus className="h-4 w-4" />
            <span>{ar ? "إنشاء دورة جديدة" : "Créer une formation"}</span>
          </Link>
        }
      />

      <AdminSectionCard
        title={ar ? "قائمة الدورات المنشورة والمسودات" : "Répertoire des Formations"}
        infoTooltip={ar ? "جميع الدورات المسجلة في المنصة" : "Table des formations avec statut de publication et progression"}
        headerActions={
          <span className="text-[12px] font-semibold text-slate-500">
            {rows.length} {ar ? "دورة" : "formations"}
          </span>
        }
        bodyClassName="!p-0"
      >
        <div className="admin-table-surface !border-0 !rounded-none !shadow-none">
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>{ar ? "الدورة" : "Formation"}</th>
                  <th>{ar ? "الحالة" : "État"}</th>
                  <th>{ar ? "المستوى" : "Niveau"}</th>
                  <th>{ar ? "السعر" : "Prix"}</th>
                  <th>{ar ? "المتعلمون" : "Apprenants"}</th>
                  <th>{ar ? "متوسط التقدم" : "Progression"}</th>
                  <th>{ar ? "التحديث" : "Mise à jour"}</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong className="text-slate-900 block">{ar ? row.title_ar : row.title_fr}</strong>
                      <small className="admin-cell-subtitle text-slate-400">
                        {row.category} · {row.mode}
                      </small>
                    </td>
                    <td>
                      <span className={`admin-status ${row.published ? "is-success" : "is-neutral"}`}>
                        {row.published ? (ar ? "منشورة" : "Publiée") : (ar ? "مسودة" : "Brouillon")}
                      </span>
                    </td>
                    <td>{row.level}</td>
                    <td className="numeric">
                      {row.price_millimes ? formatMillimes(row.price_millimes, locale) : (ar ? "مجانية" : "Gratuite")}
                    </td>
                    <td className="numeric">{row.enrollments}</td>
                    <td className="numeric">{row.completion_rate}%</td>
                    <td>{formatDate(row.updated_at, locale)}</td>
                    <td>
                      <div className="admin-row-actions">
                        <Link className="admin-row-link" href={`/${locale}/admin/courses/editor/${row.id}`}>
                          {ar ? "تحرير" : "Modifier"}
                        </Link>
                        <AdminDeleteButton
                          locale={locale}
                          endpoint={`/api/admin/courses/${row.id}`}
                          confirmMessage={ar ? "هل تريد حذف هذه الدورة؟" : "Supprimer cette formation ?"}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length ? (
            <div className="admin-empty-state">
              <strong>{ar ? "لا توجد دورات" : "Aucune formation"}</strong>
              <p>{ar ? "أنشئ أول دورة للبدء." : "Créez la première formation pour commencer."}</p>
            </div>
          ) : null}
        </div>
      </AdminSectionCard>

      <AdminFooter locale={locale} />
    </div>
  );
}
