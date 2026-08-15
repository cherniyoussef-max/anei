import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminCrmOrganizationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";
  const organizations = await listOrganizations();

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "إدارة العملاء" : "CRM"}
      title={ar ? "اختر مؤسسة" : "Choisir une organisation"}
      description={ar ? "بيانات CRM مرتبطة بكل مؤسسة على حدة." : "Les données CRM sont propres à chaque organisation."} />
    <div className="admin-list">
      {organizations.map((org) => (
        <article key={org.id}>
          <div><strong>{org.name}</strong><small>{org.slug}</small></div>
          <Link className="admin-row-link" href={`/${locale}/admin/crm/${org.id}`}>{ar ? "فتح" : "Ouvrir"}</Link>
        </article>
      ))}
      {!organizations.length ? (
        <div className="admin-empty-state">
          <strong>{ar ? "لا توجد مؤسسات بعد" : "Aucune organisation pour le moment"}</strong>
          <p>{ar ? "أنشئ مؤسسة أولاً من قسم المؤسسات." : "Créez d’abord une organisation dans la section Organisations."}</p>
        </div>
      ) : null}
    </div>
  </>;
}
