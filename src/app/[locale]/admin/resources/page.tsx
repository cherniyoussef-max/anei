import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listResourcesAdminPage } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminResourceForm } from "@/components/admin/AdminResourceForm";
import { AdminResourceRow } from "@/components/admin/AdminResourceRow";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "resources.manage");
  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await listResourcesAdminPage({ q, page });
  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/resources?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "المكتبة" : "Bibliothèque"}
      title={ar ? "إدارة الموارد" : "Gestion des ressources"}
      description={ar ? `${data.total} مورد.` : `${data.total} ressources.`} />
    <details className="admin-editor-create-panel" style={{ marginBottom: 24 }}>
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 15,
          padding: "14px 18px",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#0284c7", fontSize: 18, fontWeight: 800 }}>+</span>
          {ar ? "إضافة مورد جديد إلى المكتبة (Guides, Fiches, Outils...)" : "Ajouter une nouvelle ressource à la bibliothèque"}
        </span>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
          {ar ? "انقر للفتح / الإغلاق" : "Cliquer pour ouvrir le formulaire"}
        </span>
      </summary>
      <div style={{ marginTop: 12 }} className="admin-surface">
        <AdminResourceForm locale={locale} />
      </div>
    </details>
    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث" : "Recherche"}</span><input name="q" defaultValue={q} placeholder={ar ? "العنوان أو المعرف" : "Titre ou identifiant"} /></label>
      <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
    </form>
    <div className="admin-table-surface">
      <div className="admin-table-scroll"><table className="admin-data-table">
        <thead><tr><th>{ar ? "العنوان" : "Titre"}</th><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "المستوى" : "Niveau"}</th><th>{ar ? "السعر" : "Prix"}</th><th>{ar ? "الحالة" : "Statut"}</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{data.items.map((item) => <AdminResourceRow key={item.id} locale={locale} resource={item} />)}</tbody>
      </table></div>
      {!data.items.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"}</strong></div> : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}
