import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { searchAdmissions } from "@/server/queries/admission";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminAdmissionCreateForm } from "@/components/admin/AdminAdmissionCreateForm";

export const dynamic = "force-dynamic";

function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? (query[key] as string) : undefined;
}

export default async function AdminCrmAdmissionsPage({ params, searchParams }: {
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
  const data = await searchAdmissions({
    organizationId: orgId,
    decision: value(query, "decision"),
    page: Number(value(query, "page")) || undefined,
  });

  const href = (page: number) => {
    const next = new URLSearchParams();
    const item = value(query, "decision");
    if (item) next.set("decision", item);
    next.set("page", String(page));
    return `/${locale}/admin/crm/${orgId}/admissions?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={organization.name}
      title={ar ? "ملفات القبول" : "Admissions"}
      description={ar ? `${data.total} ملف قبول` : `${data.total} admissions`}
      actions={<>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}`}>{ar ? "العملاء" : "Contacts"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/appointments`}>{ar ? "المواعيد" : "Rendez-vous"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/assessments`}>{ar ? "التقييمات" : "Évaluations"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/cohorts`}>{ar ? "المجموعات" : "Cohortes"}</Link>
      </>} />

    <AdminAdmissionCreateForm organizationId={orgId} locale={locale} />

    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "القرار" : "Décision"}</span>
        <select name="decision" defaultValue={value(query, "decision") ?? ""}>
          <option value="">{ar ? "الكل" : "Toutes"}</option>
          <option value="PENDING">{ar ? "قيد الانتظار" : "En attente"}</option>
          <option value="ACCEPTED">{ar ? "مقبول" : "Acceptée"}</option>
          <option value="REJECTED">{ar ? "مرفوض" : "Rejetée"}</option>
        </select>
      </label>
      <button className="admin-primary-button">{ar ? "تطبيق" : "Appliquer"}</button>
    </form>

    <div className="admin-table-surface">
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>{ar ? "جهة الاتصال" : "Contact"}</th><th>{ar ? "القرار" : "Décision"}</th>
              <th>{ar ? "البّت بواسطة" : "Décidé par"}</th><th>{ar ? "السبب" : "Motif"}</th>
              <th>{ar ? "التاريخ" : "Date"}</th>
              <th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.contactFirstName ?? "—"} {item.contactLastName ?? ""}</strong></td>
                <td>{item.decision}</td>
                <td>{item.decidedByName ?? "—"}</td>
                <td>{item.reason ?? "—"}</td>
                <td>{formatDate(item.createdAt, locale)}</td>
                <td><Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/admissions/${item.id}`}>{ar ? "فتح" : "Ouvrir"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length ? (
        <div className="admin-empty-state"><strong>{ar ? "لا توجد ملفات قبول" : "Aucune admission"}</strong></div>
      ) : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}