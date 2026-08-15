import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { getOrgMembersForAssignment, searchAssessments } from "@/server/queries/admission";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAssessmentCreateForm } from "@/components/admin/AdminAssessmentCreateForm";

export const dynamic = "force-dynamic";

function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? (query[key] as string) : undefined;
}

export default async function AdminCrmAssessmentsPage({ params, searchParams }: {
  params: Promise<{ locale: string; orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, orgId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organizations = await listOrganizations();
  const organization = organizations.find((org) => org.id === orgId);
  if (!organization) notFound();

  const query = await searchParams;
  const data = await searchAssessments({
    organizationId: orgId,
    status: value(query, "status"),
    page: Number(value(query, "page")) || undefined,
  });
  const members = await getOrgMembersForAssignment(orgId);

  const href = (page: number) => {
    const next = new URLSearchParams();
    const item = value(query, "status");
    if (item) next.set("status", item);
    next.set("page", String(page));
    return `/${locale}/admin/crm/${orgId}/assessments?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "التقييمات" : "Évaluations"}
      description={ar ? `${data.total} تقييم` : `${data.total} évaluations`}
      actions={<>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}`}>{ar ? "العملاء" : "Contacts"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/appointments`}>{ar ? "المواعيد" : "Rendez-vous"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/admissions`}>{ar ? "القبول" : "Admissions"}</Link>
      </>} />

    <AdminAssessmentCreateForm organizationId={orgId} members={members} locale={locale} />

    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "الحالة" : "Statut"}</span>
        <select name="status" defaultValue={value(query, "status") ?? ""}>
          <option value="">{ar ? "الكل" : "Tous"}</option>
          <option value="DRAFT">{ar ? "مسودة" : "Brouillon"}</option>
          <option value="COMPLETED">{ar ? "مكتمل" : "Terminé"}</option>
        </select>
      </label>
      <button className="admin-primary-button">{ar ? "تطبيق" : "Appliquer"}</button>
    </form>

    <div className="admin-table-surface">
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>{ar ? "جهة الاتصال" : "Contact"}</th><th>{ar ? "المقيّم" : "Évaluateur"}</th>
              <th>{ar ? "الدرجة" : "Score"}</th><th>{ar ? "الحالة" : "Statut"}</th>
              <th>{ar ? "التاريخ" : "Date"}</th>
              <th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.contactFirstName ?? "—"} {item.contactLastName ?? ""}</strong></td>
                <td>{item.assessorName ?? "—"}</td>
                <td>{item.score ?? "—"}{item.maxScore ? ` / ${item.maxScore}` : ""}</td>
                <td>{item.status}</td>
                <td>{formatDate(item.createdAt, locale)}</td>
                <td><Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/assessments/${item.id}`}>{ar ? "فتح" : "Ouvrir"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length ? (
        <div className="admin-empty-state"><strong>{ar ? "لا توجد تقييمات" : "Aucune évaluation"}</strong></div>
      ) : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}