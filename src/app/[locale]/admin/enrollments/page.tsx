import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminEnrollmentsList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";

export const dynamic = "force-dynamic";

export default async function AdminEnrollmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "learning.read");

  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const status = typeof query.status === "string" ? query.status : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;

  const data = await getAdminEnrollmentsList({ q, status, page, limit: 25 });

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (status) next.set("status", status);
    next.set("page", String(targetPage));
    return `/${locale}/admin/enrollments?${next.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "التعلّم" : "Apprentissage"}
        title={ar ? "تسجيلات المتعلمين" : "Inscriptions aux formations"}
        description={
          ar
            ? `متابعة تقدم ${data.stats.total} تسجيلاً في الدورات الأكاديمية.`
            : `Suivi précis de la progression de ${data.stats.total} inscriptions pédagogiques.`
        }
        actions={
          <div className="admin-row-actions">
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/courses`}>
              {ar ? "كتالوج الدورات" : "Catalogue des formations"}
            </Link>
            <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/assessments`}>
              {ar ? "التقييمات" : "Évaluations"}
            </Link>
          </div>
        }
      />

      <section className="admin-kpi-grid" aria-label={ar ? "مؤشرات التسجيل" : "Indicateurs d'inscription"}>
        <article>
          <span>{ar ? "إجمالي التسجيلات" : "Inscriptions totales"}</span>
          <strong>{data.stats.total}</strong>
          <small>{ar ? "في جميع الدورات" : "tous parcours confondus"}</small>
        </article>
        <article>
          <span>{ar ? "قيد التعلّم" : "En cours"}</span>
          <strong>{data.stats.active}</strong>
          <small>{ar ? "نشطة حالياً" : "progression active"}</small>
        </article>
        <article>
          <span>{ar ? "الدورات المكتملة" : "Complétées"}</span>
          <strong>{data.stats.completed}</strong>
          <small>{ar ? "بنسبة إكمال 100%" : "parcours terminés"}</small>
        </article>
        <article>
          <span>{ar ? "متوسط التقدم" : "Progression moyenne"}</span>
          <strong>{data.stats.avg_progress}%</strong>
          <small>{ar ? "عبر جميع المتعلمين" : "tous apprenants"}</small>
        </article>
      </section>

      <form className="admin-filter-panel" method="get" role="search">
        <label>
          <span>{ar ? "البحث" : "Recherche"}</span>
          <input
            name="q"
            defaultValue={q}
            placeholder={ar ? "اسم المتعلم، البريد، أو الدورة..." : "Nom, email ou intitulé de formation..."}
          />
        </label>
        <label>
          <span>{ar ? "الحالة" : "Statut"}</span>
          <select name="status" defaultValue={status ?? "all"}>
            <option value="all">{ar ? "جميع الحالات" : "Tous les statuts"}</option>
            <option value="active">{ar ? "قيد التعلّم (نشط)" : "En cours (Actif)"}</option>
            <option value="completed">{ar ? "مكتمل" : "Complété"}</option>
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
                <th>{ar ? "المتعلم" : "Apprenant"}</th>
                <th>{ar ? "الدورة التكوينية" : "Formation"}</th>
                <th>{ar ? "التقدم" : "Progression"}</th>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>{ar ? "تاريخ التسجيل" : "Inscrit le"}</th>
                <th>{ar ? "تاريخ الإكمال" : "Achevé le"}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
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
                    <Link
                      href={`/${locale}/admin/courses/editor/${row.course_id}`}
                      className="hover:underline text-slate-900 font-medium"
                    >
                      {ar ? row.course_title_ar : row.course_title_fr}
                    </Link>
                  </td>
                  <td>
                    <div className="flex items-center gap-2" style={{ minWidth: 120 }}>
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#0056D2] h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, row.progress_percent))}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-slate-700">
                        {row.progress_percent}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`admin-status ${
                        row.status === "completed" ? "is-success" : "is-info"
                      }`}
                    >
                      {row.status === "completed"
                        ? ar
                          ? "مكتمل"
                          : "Terminé"
                        : ar
                        ? "قيد الإنجاز"
                        : "En cours"}
                    </span>
                  </td>
                  <td className="text-sm text-slate-600">{formatDate(row.enrolled_at, locale)}</td>
                  <td className="text-sm text-slate-600">
                    {row.completed_at ? formatDate(row.completed_at, locale) : "—"}
                  </td>
                  <td>
                    <Link
                      className="admin-row-link"
                      href={`/${locale}/admin/users/${row.user_id}?tab=learning`}
                    >
                      {ar ? "الملف" : "Fiche"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state">
            <strong>{ar ? "لا توجد تسجيلات مطابقة" : "Aucune inscription trouvée"}</strong>
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
              ? `صفحة ${data.page} من ${data.totalPages} (${data.total} تسجيل)`
              : `Page ${data.page} sur ${data.totalPages} (${data.total} inscriptions)`}
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
