import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listNewsAdminPage } from "@/server/queries/news";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminNewsForm } from "@/components/admin/AdminNewsForm";
import { AdminNewsActions } from "@/components/admin/AdminNewsActions";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<string, { fr: string; ar: string; bg: string; text: string }> = {
  FORMATION: { fr: "Formation", ar: "تكوين", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" },
  CERTIFICATION: { fr: "Certification", ar: "مصادقة", bg: "bg-amber-50 border-amber-200", text: "text-amber-800" },
  PARTENARIAT: { fr: "Partenariat", ar: "شراكة", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  EVENEMENT: { fr: "Événement", ar: "فعاليات", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" },
  COMMUNIQUE: { fr: "Communiqué", ar: "بلاغ", bg: "bg-slate-100 border-slate-200", text: "text-slate-700" },
};

export default async function AdminNewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "news.manage");

  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const editId = typeof query.edit === "string" ? query.edit : undefined;

  const data = await listNewsAdminPage({ q, page });
  const editingPost = editId ? data.items.find((item) => item.id === editId) : undefined;

  const href = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    next.set("page", String(p));
    return `/${locale}/admin/news?${next}`;
  };

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "المركز الإعلامي" : "Centre de Presse"}
        title={ar ? "إدارة الأخبار والمستجدات" : "Gestion des actualités"}
        description={
          ar
            ? `${data.total} مقال في قاعدة البيانات. يمكن نشر المقالات وتعيين الخبر الرئيسي (À LA UNE) بنقرة واحدة.`
            : `${data.total} actualités enregistrées. Gérez les publications et désignez l'article à la une en un clic.`
        }
      />

      {/* Formulaire de création / édition */}
      <section className="admin-surface">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
          <h2 className="text-lg font-bold text-slate-900">
            {editingPost
              ? ar
                ? `تعديل المقال: ${editingPost.titleAr}`
                : `Modifier l'actualité : ${editingPost.titleFr}`
              : ar
              ? "إضافة خبر جديد"
              : "Ajouter une nouvelle actualité"}
          </h2>
          {editingPost && (
            <Link
              href={`/${locale}/admin/news`}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline"
            >
              {ar ? "إلغاء التعديل والعودة للإضافة" : "Annuler la modification"}
            </Link>
          )}
        </div>
        <AdminNewsForm
          locale={locale}
          initialPost={
            editingPost
              ? {
                  id: editingPost.id,
                  slug: editingPost.slug,
                  category: editingPost.category || "FORMATION",
                  coverImageUrl: editingPost.coverImageUrl,
                  isFeatured: editingPost.isFeatured,
                  tagFr: editingPost.tagFr,
                  tagAr: editingPost.tagAr,
                  titleFr: editingPost.titleFr,
                  titleAr: editingPost.titleAr,
                  excerptFr: editingPost.excerptFr,
                  excerptAr: editingPost.excerptAr,
                  contentFr: editingPost.contentFr,
                  contentAr: editingPost.contentAr,
                  published: editingPost.published,
                }
              : undefined
          }
        />
      </section>

      {/* Barre de recherche */}
      <form className="admin-filter-panel" method="get" role="search">
        <label>
          <span>{ar ? "البحث في الأخبار" : "Rechercher une actualité"}</span>
          <input
            name="q"
            defaultValue={q}
            placeholder={ar ? "العنوان، الفئة أو المعرف (slug)..." : "Titre, catégorie ou slug..."}
          />
        </label>
        <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
        {q && (
          <Link
            href={`/${locale}/admin/news`}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 self-center"
          >
            {ar ? "إعادة تعيين" : "Réinitialiser"}
          </Link>
        )}
      </form>

      {/* Table des actualités */}
      <div className="admin-table-surface">
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "المقال" : "Article"}</th>
                <th>{ar ? "الفئة" : "Catégorie"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "الحالة والتمييز" : "Statut & À la une"}</th>
                <th>
                  <span className="sr-only">{ar ? "إجراءات" : "Actions"}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const catMeta = CATEGORY_LABELS[item.category || "FORMATION"] || CATEGORY_LABELS.FORMATION;
                return (
                  <tr key={item.id} className={item.isFeatured ? "bg-amber-50/20" : undefined}>
                    {/* Colonne Article */}
                    <td>
                      <div className="flex flex-col">
                        <strong className="text-slate-900 font-semibold text-sm">
                          {ar ? item.titleAr : item.titleFr}
                        </strong>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {item.slug}
                          </code>
                          <Link
                            href={`/${locale}/actualites/${item.slug}`}
                            target="_blank"
                            className="text-[11px] text-[#0056D2] hover:underline"
                          >
                            {ar ? "معاينة ↗" : "Voir sur le site ↗"}
                          </Link>
                        </div>
                      </div>
                    </td>

                    {/* Catégorie */}
                    <td>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${catMeta.bg} ${catMeta.text}`}
                      >
                        {ar ? catMeta.ar : catMeta.fr}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(item.publishedAt ?? item.createdAt, locale)}
                    </td>

                    {/* Statut & À la une (Quick 1-click toggles) */}
                    <td>
                      <AdminNewsActions
                        id={item.id}
                        isFeatured={item.isFeatured}
                        published={item.published}
                        locale={locale}
                      />
                    </td>

                    {/* Actions d'édition & suppression */}
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/${locale}/admin/news?edit=${item.id}`}
                          className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        >
                          {ar ? "تعديل" : "Modifier"}
                        </Link>
                        <AdminDeleteButton
                          locale={locale}
                          endpoint={`/api/admin/news/${item.id}`}
                          confirmMessage={
                            ar
                              ? "هل تريد حذف هذا المقال نهائيًا؟"
                              : "Supprimer définitivement cette actualité ?"
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!data.items.length ? (
          <div className="admin-empty-state">
            <strong>{ar ? "لا توجد أخبار مسجلة بعد" : "Aucune actualité enregistrée pour le moment"}</strong>
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
            {ar
              ? `صفحة ${data.page} من ${data.totalPages}`
              : `Page ${data.page} sur ${data.totalPages}`}
          </span>
          <Link
            aria-disabled={data.page >= data.totalPages}
            tabIndex={data.page >= data.totalPages ? -1 : undefined}
            href={href(Math.min(data.totalPages, data.page + 1))}
          >
            {ar ? "التالي" : "Suivant"}
          </Link>
        </nav>
      </div>
    </>
  );
}
