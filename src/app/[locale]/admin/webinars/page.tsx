import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listWebinarsAdminPage } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminWebinarForm } from "@/components/admin/AdminWebinarForm";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export const dynamic = "force-dynamic";

export default async function AdminWebinarsPage({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "webinars.manage");
  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await listWebinarsAdminPage({ q, page });
  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/webinars?${next}`;
  };

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "الندوات" : "Webinaires"}
      title={ar ? "إدارة الندوات" : "Gestion des webinaires"}
      description={ar ? `${data.total} ندوة.` : `${data.total} webinaires.`} />
    <section className="admin-surface">
      <h2>{ar ? "إضافة ندوة جديدة" : "Ajouter un nouveau webinaire"}</h2>
      <AdminWebinarForm locale={locale} />
    </section>
    <form className="admin-filter-panel" method="get" role="search">
      <label><span>{ar ? "البحث" : "Recherche"}</span><input name="q" defaultValue={q} placeholder={ar ? "العنوان أو المعرف" : "Titre ou identifiant"} /></label>
      <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
    </form>
    <div className="admin-table-surface">
      <div className="admin-table-scroll"><table className="admin-data-table">
        <thead><tr><th>{ar ? "العنوان" : "Titre"}</th><th>{ar ? "المدرب" : "Intervenant"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "الحالة" : "Statut"}</th><th><span className="sr-only">{ar ? "إجراءات" : "Actions"}</span></th></tr></thead>
        <tbody>{data.items.map((item) => <tr key={item.id}>
          <td><strong>{ar ? item.titleAr : item.titleFr}</strong><br /><small className="mono">{item.slug}</small></td>
          <td>{item.trainerName}</td>
          <td>{formatDate(item.startsAt, locale)}</td>
          <td>{item.published ? (ar ? "منشور" : "Publié") : (ar ? "مؤرشف" : "Archivé")}</td>
          <td>{item.published ? <AdminDeleteButton locale={locale} endpoint={`/api/admin/webinars/${item.id}`} confirmMessage={ar ? "هل تريد أرشفة هذه الندوة؟" : "Archiver ce webinaire ?"} label={ar ? "أرشفة" : "Archiver"} /> : null}</td>
        </tr>)}</tbody>
      </table></div>
      {!data.items.length ? <div className="admin-empty-state"><strong>{ar ? "لا توجد ندوات بعد" : "Aucun webinaire pour le moment"}</strong></div> : null}
      <nav className="admin-pagination" aria-label={ar ? "ترقيم الصفحات" : "Pagination"}>
        <Link aria-disabled={data.page <= 1} tabIndex={data.page <= 1 ? -1 : undefined} href={href(Math.max(1, data.page - 1))}>{ar ? "السابق" : "Précédent"}</Link>
        <span>{ar ? `صفحة ${data.page} من ${data.totalPages}` : `Page ${data.page} sur ${data.totalPages}`}</span>
        <Link aria-disabled={data.page >= data.totalPages} tabIndex={data.page >= data.totalPages ? -1 : undefined} href={href(Math.min(data.totalPages, data.page + 1))}>{ar ? "التالي" : "Suivant"}</Link>
      </nav>
    </div>
  </>;
}
