import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listOrganizationsPage } from "@/server/queries/organizations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOrganizationCreateForm } from "@/components/admin/AdminOrganizationCreateForm";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "organizations.manage");
  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await listOrganizationsPage({ q, page });
  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/organizations?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "المؤسسات" : "Organisations"}
      title={ar ? "إدارة المؤسسات" : "Gestion des organisations"}
      description={ar ? `${data.total} مؤسسة.` : `${data.total} organisations.`} />
    <section className="admin-surface">
      <AdminOrganizationCreateForm locale={locale} />
    </section>
    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث" : "Recherche"}</span><input name="q" defaultValue={q} placeholder={ar ? "الاسم أو المعرف" : "Nom ou identifiant"} /></label>
      <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
    </form>
    <section className="admin-surface admin-list">
      {data.items.length === 0 ? <p className="admin-empty">{ar ? "لا توجد مؤسسات." : "Aucune organisation."}</p> : data.items.map((org) => (
        <article key={org.id}>
          <div><strong>{org.name}</strong><small>{org.slug} · {org.status}</small></div>
          <Link href={`/${locale}/admin/organizations/${org.id}`} className="btn btn-ghost btn-sm">{ar ? "إدارة الأعضاء" : "Gérer les membres"}</Link>
        </article>
      ))}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </section>
  </>;
}
