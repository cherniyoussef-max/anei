import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import { getOrCreatePartnerEstablishment } from "@/server/services/inclusive-ecosystem";
import { EstablishmentWorkspace } from "@/components/inclusive/EstablishmentWorkspace";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar ? "فضاء المؤسسة الشريكة | ANEI" : "Espace Établissement partenaire | ANEI",
    description: ar
      ? "إدارة الشراكة المؤسساتية ومتابعة طلبات التدخل والتكوين وأداة التقييم الذاتي للشمول."
      : "Espace institutionnel pour les collèges, lycées et écoles partenaires d'ANEI.",
  };
}

export default async function EstablishmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    redirect(`/${locale}/connexion?callbackUrl=/${locale}/dashboard/etablissement`);
  }

  const { establishment, requests, registeredEventIds, newsItems } = await getOrCreatePartnerEstablishment(session.user.id);

  const formattedEstablishment = {
    id: establishment.id,
    name: establishment.name,
    level: establishment.level,
    region: establishment.region,
    studentCount: establishment.studentCount,
    needsBreakdownJson: (establishment.needsBreakdownJson as Record<string, number>) || {},
    existingResourcesJson: (establishment.existingResourcesJson as string[]) || [],
    constraintsJson: (establishment.constraintsJson as string[]) || [],
    partnershipStage: establishment.partnershipStage,
    conventionSignedAt: establishment.conventionSignedAt,
    selfEvalAnswersJson: establishment.selfEvalAnswersJson,
    selfEvalScorePercent: establishment.selfEvalScorePercent,
  };

  const formattedRequests = requests.map((r) => ({
    id: r.id,
    referenceCode: r.referenceCode,
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <EstablishmentWorkspace
        locale={locale}
        initialEstablishment={formattedEstablishment}
        initialRequests={formattedRequests}
        initialRegisteredEventIds={registeredEventIds}
        initialNewsItems={newsItems}
      />
    </div>
  );
}
