import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listResourcesAdminPage } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminResourceForm } from "@/components/admin/AdminResourceForm";
import { AdminResourceRow } from "@/components/admin/AdminResourceRow";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function AdminResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "المكتبة الرقمية" : "Bibliothèque Pédagogique"}
        title={ar ? "إدارة الموارد الرقمية" : "Gestion des ressources"}
        description={ar ? `${data.total} مورد مسجل.` : `${data.total} ressources enregistrées dans le catalogue.`}
      />

      <AdminSectionCard
        title={ar ? "إضافة مورد جديد" : "Ajouter une nouvelle ressource"}
        subtitle={ar ? "أدلة تدريبية، ملخصات، وأدوات رقمية" : "Guides pratiques, fiches pédagogiques, kits téléchargeables"}
      >
        <AdminResourceForm locale={locale} />
      </AdminSectionCard>

      <AdminSectionCard
        title={ar ? "قائمة الموارد" : "Catalogue des ressources"}
        subtitle={ar ? `${data.total} مورد متاح` : `${data.total} ressource(s) au total`}
        headerActions={
          <form className="flex items-center gap-2" method="get" role="search">
            <input
              name="q"
              defaultValue={q}
              placeholder={ar ? "العنوان أو المعرف..." : "Titre ou référence..."}
              className="h-8 px-2.5 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#0056D2]"
            />
            <button className="admin-primary-button h-8 px-2.5 text-xs">{ar ? "بحث" : "Filtrer"}</button>
          </form>
        }
        bodyClassName="p-0"
      >
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "العنوان" : "Titre"}</th>
                <th>{ar ? "النوع" : "Type"}</th>
                <th>{ar ? "المستوى" : "Niveau"}</th>
                <th>{ar ? "السعر" : "Prix"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <AdminResourceRow key={item.id} locale={locale} resource={item} />
              ))}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد موارد بعد" : "Aucune ressource pour le moment"}</strong>
          </div>
        ) : null}

        <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
          <Link
            aria-disabled={data.page <= 1}
            tabIndex={data.page <= 1 ? -1 : undefined}
            href={href(Math.max(1, data.page - 1))}
          >
            {ar ? "السابق" : "Précédent"}
          </Link>
          <span>
            {ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}
          </span>
          <Link
            aria-disabled={data.page >= data.totalPages}
            tabIndex={data.page >= data.totalPages ? -1 : undefined}
            href={href(Math.min(data.totalPages, data.page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </AdminSectionCard>

      <AdminFooter locale={locale} />
    </>
  );
}
