import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import {
  getOrCreatePartnerEstablishment,
  getShowcaseEstablishmentProfile,
} from "@/server/services/inclusive-ecosystem";
import { EstablishmentWorkspace } from "@/components/inclusive/EstablishmentWorkspace";
import { Sparkles, ArrowRight, LogIn } from "lucide-react";

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

export default async function EspaceEtablissementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const isAuthenticated = Boolean(session?.user);

  const { establishment, requests } = isAuthenticated && session?.user?.id
    ? await getOrCreatePartnerEstablishment(session.user.id)
    : await getShowcaseEstablishmentProfile();

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
    messages: (r.messages || []).map((m) => ({
      id: m.id,
      senderRole: m.senderRole,
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt,
    })),
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {!isAuthenticated && (
        <div className="bg-[#0A192F] text-white border-b border-slate-700/60 px-4 py-2.5 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-center sm:text-start">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold text-[11px]">
                <Sparkles className="w-3 h-3 stroke-[2]" />
                {ar ? "وضع العرض والاستكشاف المؤسساتي" : "Aperçu Institutionnel Partenaire"}
              </span>
              <span className="text-slate-300">
                {ar
                  ? "أنت في فضاء المؤسسة الشريكة. سجّل الدخول لإيداع طلبات التدخل وإجراء التقييم الذاتي المعتمد."
                  : "Explorez librement l'espace établissement. Connectez-vous pour déposer des demandes d'intervention et enregistrer l'auto-évaluation."}
              </span>
            </div>
            <Link
              href={`/${locale}/connexion?callbackUrl=/${locale}/dashboard/etablissement`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0056D2] hover:bg-[#00419e] text-white font-medium transition-colors shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{ar ? "تسجيل الدخول للمؤسسة" : "Espace Établissement Authentifié"}</span>
              <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <EstablishmentWorkspace
          locale={locale}
          initialEstablishment={formattedEstablishment}
          initialRequests={formattedRequests}
        />
      </div>
    </div>
  );
}
