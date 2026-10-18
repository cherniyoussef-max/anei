import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCareRelationships } from "@/server/queries/care-relationships";
import { getAdminCareAccessLogs } from "@/server/queries/care-notes-documents";
import { AdminCareTable } from "@/components/admin/AdminCareTable";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function AdminCarePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireAdminPermission(locale, "care.relationships.manage");
  const [data, accessLogs] = await Promise.all([
    getAdminCareRelationships({ limit: 100 }),
    getAdminCareAccessLogs(100),
  ]);

  const ar = locale === "ar";

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة الرعاية والوساطة" : "Accompagnement & Suivis"}
        title={ar ? "متابعات المختصين والأولياء" : "Relations de suivi spécialistes"}
        description={
          ar
            ? "نظرة شاملة على طلبات المتابعة والملفات النشطة وإدارتها على المنصة."
            : "Supervision des demandes d'accompagnement, des suivis actifs et des clôtures administratives."
        }
      />

      <AdminCareTable
        locale={locale}
        initialRelationships={data.relationships}
        totalCount={data.total}
        accessLogs={accessLogs}
      />

      <AdminFooter locale={locale} />
    </>
  );
}
