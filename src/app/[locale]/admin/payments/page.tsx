import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatMillimes, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminPaymentsList } from "@/modules/admin/queries/admin-operations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
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

  const data = await getAdminPaymentsList({ q, status, page, limit: 25 });

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    next.set("page", String(targetPage));
    return `/${locale}/admin/payments?${next.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "العمليات المالية" : "Finance & Passerelles"}
        title={ar ? "معاملات الدفع الإلكتروني" : "Transactions de paiement"}
        description={
          ar
            ? `متابعة بوابات الدفع (Flouci) وحركات التحصيل بإجمالي ${formatMillimes(data.stats.total_amount, locale)}.`
            : `Contrôle des flux monétiques (Flouci, Mock) pour un total encaissé de ${formatMillimes(data.stats.total_amount, locale)}.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link className="admin-secondary-button" href={`/${locale}/admin/orders`}>
              {ar ? "سجل الطلبات" : "Commandes"}
            </Link>
            <Link className="admin-secondary-button" href={`/${locale}/admin/marketing`}>
              {ar ? "تحليلات المبيعات" : "Marketing & Ventes"}
            </Link>
          </div>
        }
      />

      <section className="admin-kpi-grid" aria-label={ar ? "مؤشرات الدفع" : "Indicateurs monétiques"}>
        <article>
          <span>{ar ? "إجمالي المعاملات" : "Transactions"}</span>
          <strong>{data.stats.total}</strong>
          <small>{ar ? "عبر جميع البوابات" : "toutes passerelles"}</small>
        </article>
        <article>
          <span>{ar ? "مدفوعة ومؤكدة" : "Règlements validés"}</span>
          <strong>{data.stats.paid}</strong>
          <small>{ar ? "تحصيل ناجح" : "fonds confirmés"}</small>
        </article>
        <article>
          <span>{ar ? "قيد الانتظار" : "En cours"}</span>
          <strong>{data.stats.pending}</strong>
          <small>{ar ? "في انتظار التأكيد" : "en cours d'autorisation"}</small>
        </article>
        <article>
          <span>{ar ? "حجم التحصيل" : "Volume total"}</span>
          <strong>{formatMillimes(data.stats.total_amount, locale)}</strong>
          <small>{ar ? "بالدينار التونسي" : "en TND validé"}</small>
        </article>
      </section>

      <AdminSectionCard
        title={ar ? "البحث والتصفية" : "Filtres des transactions"}
        subtitle={ar ? "البحث بمعرف المعاملة أو البوابة أو العميل" : "Rechercher par référence, passerelle monétique ou identifiant client"}
        bodyClassName="p-4"
      >
        <form className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end" method="get" role="search">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">{ar ? "البحث" : "Recherche"}</span>
            <input
              name="q"
              defaultValue={q}
              placeholder={ar ? "معرف المعاملة، معرف البوابة، أو البريد..." : "ID transaction, réf. externe ou client..."}
              className="h-9 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-[#0056D2]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-600">{ar ? "الحالة" : "Statut"}</span>
            <select
              name="status"
              defaultValue={status ?? "all"}
              className="h-9 px-3 rounded-md border border-slate-200 text-sm bg-white focus:outline-none focus:border-[#0056D2]"
            >
              <option value="all">{ar ? "جميع الحالات" : "Tous les statuts"}</option>
              <option value="paid">{ar ? "مؤكد (مدفوع)" : "Payé (Confirmé)"}</option>
              <option value="pending">{ar ? "قيد المعالجة" : "En attente"}</option>
              <option value="failed">{ar ? "فاشل / ملغى" : "Échoué / Annulé"}</option>
            </select>
          </label>
          <button type="submit" className="admin-primary-button h-9 justify-center">
            {ar ? "تصفية" : "Filtrer"}
          </button>
        </form>
      </AdminSectionCard>

      <AdminSectionCard
        title={ar ? "سجل المدفوعات" : "Journal des transactions"}
        subtitle={ar ? `${data.total} معاملة مسجلة` : `${data.total} transaction(s) enregistrée(s)`}
        bodyClassName="p-0"
      >
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "معرف المعاملة" : "Réf. transaction"}</th>
                <th>{ar ? "البوابة" : "Passerelle"}</th>
                <th>{ar ? "العميل" : "Client"}</th>
                <th>{ar ? "المنتج المرتبط" : "Objet"}</th>
                <th>{ar ? "المبلغ" : "Montant"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="mono text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded block">
                      #{row.id.slice(0, 8)}
                    </span>
                    {row.external_payment_id ? (
                      <small className="mono text-xs text-slate-400 block mt-0.5" title={row.external_payment_id}>
                        ext: {row.external_payment_id.slice(0, 16)}...
                      </small>
                    ) : null}
                  </td>
                  <td>
                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-700 uppercase">
                      {row.provider}
                    </span>
                  </td>
                  <td>
                    <Link
                      href={`/${locale}/admin/users/${row.user_id}`}
                      className="hover:underline font-semibold text-[#0056D2] block"
                    >
                      {row.user_name}
                    </Link>
                    <small className="admin-cell-subtitle block text-xs text-slate-500">{row.user_email}</small>
                  </td>
                  <td>
                    <span className="font-medium text-slate-900">{row.item_label}</span>
                  </td>
                  <td>
                    <strong className="text-slate-900 tabular-nums">
                      {formatMillimes(row.amount_millimes, locale)}
                    </strong>
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
                          ? "مقبول"
                          : "Payé"
                        : row.status === "pending"
                        ? ar
                          ? "قيد التحقق"
                          : "En attente"
                        : ar
                        ? "مرفوض"
                        : "Rejeté"}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600">{formatDate(row.created_at, locale)}</td>
                  <td>
                    <Link
                      className="admin-row-link"
                      href={`/${locale}/admin/orders?q=${row.order_id}`}
                    >
                      {ar ? "الطلب" : "Commande"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد معاملات مطابقة" : "Aucune transaction trouvée"}</strong>
            <p className="text-sm text-slate-500 mt-1">
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
              ? `صفحة ${data.page} من ${data.totalPages} (${data.total} معاملة)`
              : `Page ${data.page} sur ${data.totalPages} (${data.total} transactions)`}
          </span>
          <Link
            aria-disabled={data.page >= data.totalPages}
            tabIndex={data.page >= data.totalPages ? -1 : undefined}
            href={buildHref(Math.min(data.totalPages, data.page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </AdminSectionCard>

      <AdminFooter locale={locale} />
    </>
  );
}
