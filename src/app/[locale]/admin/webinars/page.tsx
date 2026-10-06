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
            <span style={{ color: "#00796B", fontSize: 18, fontWeight: 800 }}>+</span>
            {ar ? "إضافة ندوة جديدة (Google Meet / Teams / حضوري)" : "Ajouter un nouveau webinaire (Créer une session)"}
          </span>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>
            {ar ? "انقر للفتح / الإغلاق" : "Cliquer pour ouvrir le formulaire"}
          </span>
        </summary>
        <div style={{ marginTop: 12 }} className="admin-surface">
          <AdminWebinarForm locale={locale as Locale} />
        </div>
      </details>

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
