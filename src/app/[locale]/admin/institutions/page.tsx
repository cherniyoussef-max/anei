import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";
import { AdminInstitutionsTable } from "@/components/admin/AdminInstitutionsTable";
import { getSpecialistWorkspaceData } from "@/server/services/inclusive-ecosystem";

export const dynamic = "force-dynamic";

export default async function AdminInstitutionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireAdminPermission(locale, "organizations.manage");

  const { establishments, requests, tips } = await getSpecialistWorkspaceData();
  const ar = locale === "ar";

  const formattedEstablishments = establishments.map((e) => ({
    id: e.id,
    name: e.name,
    level: e.level,
    region: e.region,
    studentCount: e.studentCount,
    needsBreakdownJson: (e.needsBreakdownJson as Record<string, number>) || {},
    partnershipStage: e.partnershipStage,
    conventionSignedAt: e.conventionSignedAt,
    createdAt: e.createdAt,
  }));

  const formattedRequests = requests.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    establishmentName: r.establishmentName || "Établissement",
    serviceType: r.serviceType,
    urgency: r.urgency,
    concernedCount: r.concernedCount,
    situationDescription: r.situationDescription,
    stage: r.stage,
    scheduledRdvJson: r.scheduledRdvJson,
    createdAt: r.createdAt,
  }));

  const formattedTips = tips.map((t) => ({
    id: t.id,
    authorName: t.authorName,
    difficultyKey: t.difficultyKey,
    situationTitle: t.situationTitle,
    whatToDo: t.whatToDo,
    whatToAvoid: t.whatToAvoid || "",
    createdAt: t.createdAt,
  }));

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "الشبكة المدرسية والتدخلات" : "Réseau scolaire & Conventions"}
        title={ar ? "المؤسسات الشريكة وطلبات الدعم" : "Établissements partenaires & Demandes"}
        description={
          ar
            ? "الإشراف الشامل على المدارس والإعداديات الشريكة، متابعة طلبات التدخل البيداغوجي وتوجيهات الأخصائيين."
            : "Supervision centrale des conventions d'établissements, des demandes de service tripartite et des fiches réflexes publiées."
        }
      />

      <div className="p-4 sm:p-6 lg:p-8">
        <AdminInstitutionsTable
          locale={locale}
          establishments={formattedEstablishments}
          requests={formattedRequests}
          tips={formattedTips}
        />
      </div>

      <AdminFooter locale={locale} />
    </>
  );
}
