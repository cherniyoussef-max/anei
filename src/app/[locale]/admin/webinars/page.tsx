import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { listWebinarsAdminPage } from "@/server/queries/catalog";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminWebinarForm } from "@/components/admin/AdminWebinarForm";
import { AdminWebinarTable } from "@/components/admin/AdminWebinarTable";
import type { Locale } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminWebinarsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "webinars.manage");
  const ar = locale === "ar";
  const query = await searchParams;
  const q = typeof query.q === "string" ? query.q : undefined;
  const page = typeof query.page === "string" ? Number(query.page) : 1;
  const data = await listWebinarsAdminPage({ q, page });

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "الندوات والاجتماعات المباشرة" : "Webinaires & Réunions"}
        title={ar ? "إدارة الندوات الافتراضية" : "Gestion des webinaires"}
        description={ar ? `${data.total} ندوة مسجلة.` : `${data.total} webinaires enregistrés.`}
      />

      <section className="admin-surface">
        <h2>{ar ? "إضافة ندوة جديدة (Google Meet / Teams)" : "Ajouter un nouveau webinaire"}</h2>
        <AdminWebinarForm locale={locale as Locale} />
      </section>

      <form className="admin-filter-panel" method="get" role="search">
        <label>
          <span>{ar ? "البحث" : "Recherche"}</span>
          <input name="q" defaultValue={q} placeholder={ar ? "العنوان أو المعرف" : "Titre ou identifiant"} />
        </label>
        <button className="admin-primary-button">{ar ? "بحث" : "Rechercher"}</button>
      </form>

      <AdminWebinarTable
        items={data.items}
        locale={locale as Locale}
        page={data.page}
        totalPages={data.totalPages}
        q={q}
      />
    </>
  );
}
