import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCertificatesList } from "@/modules/admin/queries/admin-learning";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSectionCard } from "@/modules/admin/components/AdminSectionCard";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function AdminCertificatesPage({
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
  const page = typeof query.page === "string" ? Number(query.page) : 1;

  const data = await getAdminCertificatesList({ q, page, limit: 25 });

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(targetPage));
    return `/${locale}/admin/certificates?${next.toString()}`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "التعلّم والاعتماد" : "Certification & Réussite"}
        title={ar ? "الشهادات الصادرة" : "Certificats officiels délivrés"}
        description={
          ar
            ? `إدارة وتحقق من صحة ${data.total} شهادة معتمدة تم إصدارها على المنصة.`
            : `Gestion et contrôle d'authenticité de ${data.total} certificats sécurisés délivrés.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link className="admin-secondary-button" href={`/${locale}/admin/courses`}>
              {ar ? "كتالوج الدورات" : "Formations"}
            </Link>
            <Link className="admin-secondary-button" href={`/${locale}/admin/assessments`}>
              {ar ? "نتائج التقييمات" : "Résultats quiz"}
            </Link>
          </div>
        }
      />

      <section className="admin-kpi-grid" aria-label={ar ? "مؤشرات الشهادات" : "Indicateurs de certification"}>
        <article>
          <span>{ar ? "إجمالي الشهادات" : "Certificats délivrés"}</span>
          <strong>{data.total}</strong>
          <small>{ar ? "شهادات موثقة بالرمز" : "avec code unique"}</small>
        </article>
        <article>
          <span>{ar ? "حالة التحقق" : "Vérification publique"}</span>
          <strong>100%</strong>
          <small>{ar ? "قابلة للتحقق الفوري" : "authentification en ligne"}</small>
        </article>
      </section>

      <AdminSectionCard
        title={ar ? "البحث والتحقق" : "Recherche de certificats"}
        subtitle={ar ? "البحث برمز الشهادة، اسم المتعلم، أو البريد" : "Vérifiez un certificat par son code unique ou par apprenant"}
        bodyClassName="p-4"
      >
        <form className="flex items-center gap-3" method="get" role="search">
          <input
            name="q"
            defaultValue={q}
            placeholder={ar ? "رمز الشهادة (مثال: ANEI-...) أو اسم المتعلم..." : "Code (ex: ANEI-...), nom ou email de l'apprenant..."}
            className="flex-1 h-9 px-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:border-[#0056D2]"
          />
          <button type="submit" className="admin-primary-button h-9">
            {ar ? "بحث" : "Rechercher"}
          </button>
        </form>
      </AdminSectionCard>

      <AdminSectionCard
        title={ar ? "سجل الشهادات الرسمية" : "Registre officiel des certificats"}
        subtitle={ar ? `${data.total} شهادة مسجلة وموثوقة` : `${data.total} certificat(s) au total`}
        bodyClassName="p-0"
      >
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "رمز الشهادة" : "Code certificat"}</th>
                <th>{ar ? "المتعلم" : "Bénéficiaire"}</th>
                <th>{ar ? "الدورة التكوينية" : "Formation certifiée"}</th>
                <th>{ar ? "تاريخ الإصدار" : "Délivré le"}</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="mono font-semibold text-slate-800 text-xs px-2 py-1 bg-slate-100 rounded border border-slate-200 block">
                      {row.code}
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
                    <Link
                      href={`/${locale}/admin/courses/editor/${row.course_id}`}
                      className="hover:underline text-slate-900 font-medium block"
                    >
                      {ar ? row.course_title_ar : row.course_title_fr}
                    </Link>
                  </td>
                  <td className="text-sm text-slate-600">{formatDate(row.issued_at, locale)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Link
                        className="admin-row-link"
                        href={`/${locale}/certificats/verify/${row.code}`}
                        target="_blank"
                      >
                        {ar ? "تحقق علني" : "Vérifier"}
                      </Link>
                      {row.file_url ? (
                        <a
                          className="admin-row-link"
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ar ? "تحميل PDF" : "PDF"}
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state p-8 text-center">
            <strong className="text-slate-800">{ar ? "لا توجد شهادات مطابقة" : "Aucun certificat trouvé"}</strong>
            <p className="text-sm text-slate-500 mt-1">
              {ar
                ? "يتم إصدار الشهادات تلقائياً عند إكمال المتعلم للدورة واجتياز التقييم النهائي بنجاح."
                : "Les certificats sont générés automatiquement lorsqu'un apprenant termine sa formation avec succès."}
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
              ? `صفحة ${data.page} من ${data.totalPages} (${data.total} شهادة)`
              : `Page ${data.page} sur ${data.totalPages} (${data.total} certificats)`}
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
