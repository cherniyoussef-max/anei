import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizations } from "@/server/queries/organizations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOrganizationCreateForm } from "@/components/admin/AdminOrganizationCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "organizations.manage");
  const ar = locale === "ar";
  const organizations = await listOrganizations();

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "المؤسسات" : "Organisations"}
      title={ar ? "إدارة المؤسسات" : "Gestion des organisations"}
      description={ar ? "إنشاء المؤسسات وإدارة عضويتها." : "Créer des organisations et gérer leur adhésion."} />
    <section className="admin-surface">
      <AdminOrganizationCreateForm locale={locale} />
    </section>
    <section className="admin-surface admin-list">
      {organizations.length === 0 ? <p className="admin-empty">{ar ? "لا توجد مؤسسات." : "Aucune organisation."}</p> : organizations.map((org) => (
        <article key={org.id}>
          <div><strong>{org.name}</strong><small>{org.slug} · {org.status}</small></div>
          <Link href={`/${locale}/admin/organizations/${org.id}`} className="btn btn-ghost btn-sm">{ar ? "إدارة الأعضاء" : "Gérer les membres"}</Link>
        </article>
      ))}
    </section>
  </>;
}
