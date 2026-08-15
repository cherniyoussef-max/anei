import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { searchCrmContacts, getTagsForContacts } from "@/server/queries/crm";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminCrmContactCreateForm } from "@/components/admin/AdminCrmContactCreateForm";

export const dynamic = "force-dynamic";

function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? (query[key] as string) : undefined;
}

export default async function AdminCrmContactsPage({ params, searchParams }: {
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
  const data = await searchCrmContacts({
    organizationId: orgId,
    q: value(query, "q"),
    status: value(query, "status"),
    page: Number(value(query, "page")) || undefined,
  });
  const tagsByContact = await getTagsForContacts(data.items.map((c) => c.id));

  const href = (page: number) => {
    const next = new URLSearchParams();
    for (const key of ["q", "status"]) {
      const item = value(query, key);
      if (item) next.set(key, item);
    }
    next.set("page", String(page));
    return `/${locale}/admin/crm/${orgId}?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "إدارة العملاء" : "CRM"}
      title={organization.name}
      description={ar ? `${data.total} جهة اتصال` : `${data.total} contacts`}
      actions={<>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/appointments`}>{ar ? "المواعيد" : "Rendez-vous"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/assessments`}>{ar ? "التقييمات" : "Évaluations"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/admissions`}>{ar ? "القبول" : "Admissions"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/whatsapp`}>{ar ? "واتساب" : "WhatsApp"}</Link>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/pipelines`}>{ar ? "المسارات" : "Pipelines"}</Link>
      </>} />

    <AdminCrmContactCreateForm organizationId={orgId} locale={locale} />

    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث" : "Recherche"}</span><input name="q" defaultValue={value(query, "q")} placeholder={ar ? "الاسم أو البريد أو الهاتف" : "Nom, e-mail ou téléphone"} /></label>
      <label><span>{ar ? "الحالة" : "Statut"}</span>
        <select name="status" defaultValue={value(query, "status") ?? ""}>
          <option value="">{ar ? "الكل" : "Tous"}</option>
          <option value="ACTIVE">{ar ? "نشط" : "Actif"}</option>
          <option value="ARCHIVED">{ar ? "مؤرشف" : "Archivé"}</option>
        </select>
      </label>
      <button className="admin-primary-button">{ar ? "تطبيق" : "Appliquer"}</button>
    </form>

    <div className="admin-table-surface">
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>{ar ? "الاسم" : "Nom"}</th><th>Email</th><th>{ar ? "الهاتف" : "Téléphone"}</th>
              <th>{ar ? "الحالة" : "Statut"}</th><th>{ar ? "الوسوم" : "Tags"}</th><th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((contact) => (
              <tr key={contact.id}>
                <td><Link className="admin-user-cell" href={`/${locale}/admin/crm/${orgId}/contacts/${contact.id}`}><strong>{contact.firstName} {contact.lastName}</strong></Link></td>
                <td>{contact.email ?? "—"}</td>
                <td>{contact.phone ?? "—"}</td>
                <td>{contact.status}</td>
                <td>{(tagsByContact.get(contact.id) ?? []).map((t) => t.name).join(", ") || "—"}</td>
                <td><Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}/contacts/${contact.id}`}>{ar ? "فتح" : "Ouvrir"}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.items.length ? (
        <div className="admin-empty-state"><strong>{ar ? "لا توجد نتائج" : "Aucun résultat"}</strong></div>
      ) : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}
