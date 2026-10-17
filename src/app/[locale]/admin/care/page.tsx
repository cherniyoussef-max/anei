import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getAdminCareRelationships } from "@/server/queries/care-relationships";
import { getAdminCareAccessLogs } from "@/server/queries/care-notes-documents";
import { AdminCareTable } from "@/components/admin/AdminCareTable";

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
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">
          {ar ? "إدارة الرعاية والوساطة" : "Accompagnement & Suivis"}
        </span>
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[#082D55] sm:text-3xl">
          {ar ? "متابعات المختصين والأولياء" : "Relations de suivi spécialistes"}
        </h1>
        <p className="mt-1 text-sm text-[#7a7261]">
          {ar
            ? "نظرة شاملة على طلبات المتابعة والملفات النشطة وإدارتها على المنصة."
            : "Supervision des demandes d'accompagnement, des suivis actifs et des clôtures administratives."}
        </p>
      </div>

      <AdminCareTable
        locale={locale}
        initialRelationships={data.relationships}
        totalCount={data.total}
        accessLogs={accessLogs}
      />
    </div>
  );
}
