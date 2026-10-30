import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getSpecialistWorkspaceData } from "@/server/services/inclusive-ecosystem";
import { SpecialistWorkspace } from "@/components/inclusive/SpecialistWorkspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "فضاء الأخصائي والمستشار | ANEI" : "Espace Spécialiste & Psychologue scolaire | ANEI",
    description: ar
      ? "إدارة طلبات المدارس، برمجة المواعيد، ومشاركة التوجيهات البيداغوجية مع الأساتذة."
      : "Gestion des interventions auprès des établissements scolaires partenaires.",
  };
}

export default async function SpecialistDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requireUser(locale, `/${locale}/dashboard/specialiste`);

  const { establishments, requests, tips } = await getSpecialistWorkspaceData(session.user.id);

  const formattedEstablishments = establishments.map((e) => ({
    id: e.id,
    name: e.name,
    level: e.level,
    region: e.region,
    partnershipStage: e.partnershipStage,
    needsBreakdownJson: (e.needsBreakdownJson as Record<string, number>) || {},
  }));

  const formattedRequests = requests.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
    establishmentId: r.establishmentId,
    establishmentName: r.establishmentName,
    establishmentLevel: r.establishmentLevel,
    establishmentRegion: r.establishmentRegion,
    serviceType: r.serviceType,
    urgency: r.urgency,
    concernedCount: r.concernedCount,
    situationDescription: r.situationDescription,
    stage: r.stage,
    scheduledRdvJson: r.scheduledRdvJson,
    createdAt: r.createdAt,
    messages: r.messages.map((m) => ({
      id: m.id,
      senderRole: m.senderRole,
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt,
    })),
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <SpecialistWorkspace
        locale={locale}
        initialRequests={formattedRequests}
        initialEstablishments={formattedEstablishments}
        initialTips={formattedTips}
        specialistName={session.user.name || "Dr. Spécialiste Référent"}
      />
    </div>
  );
}
