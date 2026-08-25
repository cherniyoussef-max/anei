import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import { getWhatsAppAccountForOrg, listWhatsAppTemplates, searchWhatsappMessages } from "@/server/queries/whatsapp";
import { whatsappConfigured } from "@/server/whatsapp/config";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminWhatsAppAccountForm } from "@/components/admin/AdminWhatsAppAccountForm";
import { AdminWhatsAppSendForm } from "@/components/admin/AdminWhatsAppSendForm";

export const dynamic = "force-dynamic";

function value(query: Record<string, string | string[] | undefined>, key: string) {
  return typeof query[key] === "string" ? (query[key] as string) : undefined;
}

export default async function AdminWhatsAppPage({ params, searchParams }: {
  params: Promise<{ locale: string; orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, orgId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  const query = await searchParams;
  const direction = value(query, "direction");
  const status = value(query, "status");
  const page = Number(value(query, "page") || 1);
  const [account, templates, data] = await Promise.all([
    getWhatsAppAccountForOrg(orgId),
    listWhatsAppTemplates(orgId),
    searchWhatsappMessages(
      {
        organizationId: orgId,
        direction: direction === "INBOUND" || direction === "OUTBOUND" ? direction : undefined,
        status: status === "QUEUED" || status === "SENT" || status === "DELIVERED" || status === "READ" || status === "FAILED" ? status : undefined,
        page,
        pageSize: 25,
      },
      { column: "createdAt", direction: "desc" },
    ),
  ]);

  const href = (p: number) => {
    const next = new URLSearchParams();
    for (const key of ["direction", "status"]) {
      const item = value(query, key);
      if (item) next.set(key, item);
    }
    next.set("page", String(p));
    return `/${locale}/admin/crm/${orgId}/whatsapp?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "واتساب" : "WhatsApp"}
      title={organization.name}
      description={ar ? "قناة التواصل عبر واتساب" : "Canal de communication WhatsApp"}
      actions={<>
        <Link className="admin-row-link" href={`/${locale}/admin/crm/${orgId}`}>{ar ? "العملاء" : "Contacts"}</Link>
      </>} />

    <section className="admin-surface">
      <h3>{ar ? "إعدادات الحساب" : "Configuration du compte"}</h3>
      {!whatsappConfigured ? (
        <p className="admin-error">{ar ? "واتساب غير مفعل في هذا التثبيت." : "WhatsApp n’est pas configuré sur cette installation."}</p>
      ) : (
        <AdminWhatsAppAccountForm organizationId={orgId} locale={locale} account={account ? {
          phoneNumberId: account.phoneNumberId,
          businessAccountId: account.businessAccountId,
          displayPhoneNumber: account.displayPhoneNumber,
          status: account.status,
        } : null} />
      )}
    </section>

    <section className="admin-surface">
      <h3>{ar ? "الرسائل" : "Messages"}</h3>
      <form className="admin-filter-panel" method="get" role="search">
        <label><span>{ar ? "الاتجاه" : "Direction"}</span>
          <select name="direction" defaultValue={value(query, "direction") ?? ""}>
            <option value="">{ar ? "الكل" : "Tous"}</option>
            <option value="OUTBOUND">{ar ? "صادر" : "Sortant"}</option>
            <option value="INBOUND">{ar ? "وارد" : "Entrant"}</option>
          </select>
        </label>
        <label><span>{ar ? "الحالة" : "Statut"}</span>
          <select name="status" defaultValue={value(query, "status") ?? ""}>
            <option value="">{ar ? "الكل" : "Tous"}</option>
            <option value="QUEUED">{ar ? "في الانتظار" : "En attente"}</option>
            <option value="SENT">{ar ? "مرسل" : "Envoyé"}</option>
            <option value="DELIVERED">{ar ? "تم التسليم" : "Livré"}</option>
            <option value="READ">{ar ? "مقروء" : "Lu"}</option>
            <option value="FAILED">{ar ? "فشل" : "Échec"}</option>
          </select>
        </label>
        <button className="admin-primary-button">{ar ? "تطبيق" : "Appliquer"}</button>
      </form>

      <div className="admin-table-surface">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "الجهة" : "Contact"}</th>
                <th>{ar ? "الاتجاه" : "Direction"}</th>
                <th>{ar ? "النوع" : "Type"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>{ar ? "القالب" : "Modèle"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.contactFirstName || row.contactLastName ? `${row.contactFirstName ?? ""} ${row.contactLastName ?? ""}`.trim() : (row.toPhone ?? row.fromPhone ?? "—")}</td>
                  <td>{row.direction}</td>
                  <td>{row.messageType}</td>
                  <td>{row.status}</td>
                  <td>{row.templateName ?? (row.textPreview ? (row.textPreview.length > 40 ? `${row.textPreview.slice(0, 40)}…` : row.textPreview) : "—")}</td>
                  <td>{row.createdAt?.toLocaleDateString(locale === "ar" ? "ar-TN" : "fr-FR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.rows.length ? (
          <div className="admin-empty-state"><strong>{ar ? "لا توجد رسائل" : "Aucun message"}</strong></div>
        ) : null}
        <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
          <Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={href(Math.max(1, page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
          <span>{ar ? `صفحة ${page}` : `Page ${page}`}</span>
          <Link aria-disabled={data.rows.length < 25} tabIndex={data.rows.length < 25 ? -1 : undefined} href={href(page + 1)}>{ar ? "التالي" : "Suivant"}</Link>
        </nav>
      </div>
    </section>

    <section className="admin-surface">
      <h3>{ar ? "إرسال رسالة قالب" : "Envoyer un message modèle"}</h3>
      {account ? <AdminWhatsAppSendForm organizationId={orgId} locale={locale} templates={templates} /> : (
        <p>{ar ? "قم بتهيئة حساب واتساب أولاً." : "Configurez d’abord un compte WhatsApp."}</p>
      )}
    </section>
  </>;
}