import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminOrdersList } from "@/modules/admin/queries/admin-operations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "orders.read");

  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const status = typeof query.status === "string" ? query.status : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;

  const data = await getAdminOrdersList({ q, status, page, limit: 25 });

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    next.set("page", String(targetPage));
    return `/${locale}/admin/orders?${next.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "العمليات التجارية" : "Commerce & Ventes"}
        title={ar ? "إدارة الطلبات" : "Commandes clients"}
        description={
          ar
            ? `متابعة ${data.stats.total} طلباً وإيرادات إجمالية قدرها ${formatMillimes(data.stats.total_revenue, locale)}.`
            : `Gestion des ${data.stats.total} commandes et encaissements pour un volume de ${formatMillimes(data.stats.total_revenue, locale)}.`
        }
        actions={
          <div className="admin-row-actions">
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/payments`}>
              {ar ? "سجل المدفوعات" : "Transactions de paiement"}
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/marketing`}>
              {ar ? "تحليلات الجمهور" : "Audience & Ventes"}
            </Link>
          </div>
        }
      />

      <section className="admin-kpi-grid" aria-label={ar ? "مؤشرات التجارة" : "Indicateurs commerciaux"}>
        <article>
          <span>{ar ? "إجمالي الطلبات" : "Commandes totales"}</span>
          <strong>{data.stats.total}</strong>
          <small>{ar ? "جميع العمليات" : "toutes commandes"}</small>
        </article>
        <article>
          <span>{ar ? "الطلبات المدفوعة" : "Commandes payées"}</span>
          <strong>{data.stats.paid}</strong>
          <small>{ar ? "مؤكدة ومحصلة" : "encaissées avec succès"}</small>
        </article>
        <article>
          <span>{ar ? "قيد الانتظار" : "En attente"}</span>
          <strong>{data.stats.pending}</strong>
          <small>{ar ? "بانتظار التأكيد" : "en cours de paiement"}</small>
        </article>
        <article>
          <span>{ar ? "إجمالي الإيرادات" : "Chiffre d'affaires"}</span>
          <strong>{formatMillimes(data.stats.total_revenue, locale)}</strong>
          <small>{ar ? "محصل بالدينار التونسي" : "encaissé en TND"}</small>
        </article>
      </section>

      <form className="admin-filter-panel" method="get" role="search">
        <label>
          <span>{ar ? "البحث" : "Recherche"}</span>
          <input
            name="q"
            defaultValue={q}
            placeholder={ar ? "معرف الطلب، المشتري، أو العنصر..." : "ID commande, nom du client ou libellé produit..."}
          />
        </label>
        <label>
          <span>{ar ? "الحالة" : "Statut"}</span>
          <select name="status" defaultValue={status ?? "all"}>
            <option value="all">{ar ? "جميع الحالات" : "Tous les statuts"}</option>
            <option value="paid">{ar ? "مدفوعة" : "Payée"}</option>
            <option value="pending">{ar ? "قيد الانتظار" : "En attente"}</option>
            <option value="failed">{ar ? "ملغاة / فاشلة" : "Échouée / Annulée"}</option>
          </select>
        </label>
        <button type="submit" className="admin-primary-button">
          {ar ? "تصفية" : "Filtrer"}
        </button>
      </form>

      <div className="admin-table-surface">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "معرف الطلب" : "Réf. commande"}</th>
                <th>{ar ? "العميل" : "Client"}</th>
                <th>{ar ? "المنتج / العنصر" : "Article"}</th>
                <th>{ar ? "المبلغ" : "Montant"}</th>
                <th>{ar ? "طريقة الدفع" : "Passerelle"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="mono text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded" title={row.id}>
                      #{row.id.slice(0, 8)}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/${locale}/admin/users/${row.user_id}`}
                      className="hover:underline font-semibold text-[#0056D2]"
                    >
                      {row.user_name}
                    </Link>
                    <small className="admin-cell-subtitle block text-xs text-slate-500">{row.user_email}</small>
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{row.item_label}</div>
                    <span className="text-xs uppercase px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                      {row.item_type === "course" ? (ar ? "دورة" : "Formation") : (ar ? "مورد" : "Ressource")}
                    </span>
                  </td>
                  <td>
                    <strong className="text-slate-900 tabular-nums">
                      {formatMillimes(row.amount_millimes, locale)}
                    </strong>
                  </td>
                  <td>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-700 uppercase">
                      {row.provider}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-status ${
                        row.status === "paid"
                          ? "is-success"
                          : row.status === "pending"
                          ? "is-warning"
                          : "is-danger"
                      }`}
                    >
                      {row.status === "paid"
                        ? ar
                          ? "مدفوعة"
                          : "Payée"
                        : row.status === "pending"
                        ? ar
                          ? "معلقة"
                          : "En attente"
                        : ar
                        ? "فاشلة"
                        : "Échouée"}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600">{formatDate(row.created_at, locale)}</td>
                  <td>
                    <Link
                      className="admin-row-link"
                      href={`/${locale}/admin/users/${row.user_id}`}
                    >
                      {ar ? "العميل" : "Client"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state">
            <strong>{ar ? "لا توجد طلبات مطابقة" : "Aucune commande trouvée"}</strong>
            <p>
              {ar
                ? "جرّب تغيير كلمات البحث أو معايير التصفية."
                : "Modifiez votre recherche ou réinitialisez les filtres."}
            </p>
          </div>
        ) : null}

        <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
          <Link
            aria-disabled={data.page <= 1}
            tabIndex={data.page <= 1 ? -1 : undefined}
            href={buildHref(Math.max(1, data.page - 1))}
          >
            {ar ? "السابق" : "Précédent"}
          </Link>
          <span>
            {ar
              ? `صفحة ${data.page} من ${data.totalPages} (${data.total} طلب)`
              : `Page ${data.page} sur ${data.totalPages} (${data.total} commandes)`}
          </span>
          <Link
            aria-disabled={data.page >= data.totalPages}
            tabIndex={data.page >= data.totalPages ? -1 : undefined}
            href={buildHref(Math.min(data.totalPages, data.page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </div>
    </>
  );
}
