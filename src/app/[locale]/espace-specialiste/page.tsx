import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { auth } from "@/server/auth";
import {
  getSpecialistWorkspaceData,
  getShowcaseSpecialistWorkspaceData,
} from "@/server/services/inclusive-ecosystem";
import { SpecialistWorkspace } from "@/components/inclusive/SpecialistWorkspace";
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
    title: ar ? "فضاء الأخصائي والمستشار | ANEI" : "Espace Spécialiste & Psychologue scolaire | ANEI",
    description: ar
      ? "إدارة طلبات المدارس، برمجة المواعيد، ومشاركة التوجيهات البيداغوجية مع الأساتذة."
      : "Gestion des interventions auprès des établissements scolaires partenaires.",
  };
}

export default async function EspaceSpecialistePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const isAuthenticated = Boolean(session?.user);

  const { establishments, requests, tips } = isAuthenticated && session?.user?.id
    ? await getSpecialistWorkspaceData(session.user.id)
    : await getShowcaseSpecialistWorkspaceData();

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
    messages: (r.messages || []).map((m) => ({
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
    isPublished: t.isPublished,
    createdAt: t.createdAt,
  }));

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {!isAuthenticated && (
        <div className="bg-[#0A192F] text-white border-b border-slate-700/60 px-4 py-2.5 sm:px-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-center sm:text-start">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold text-[11px]">
                <Sparkles className="w-3 h-3 stroke-[2]" />
                {ar ? "وضع العرض والاستكشاف المتخصص" : "Aperçu & Démonstration Spécialiste"}
              </span>
              <span className="text-slate-300">
                {ar
                  ? "أنت في فضاء الأخصائيين والمستشارين. سجّل الدخول لإدارة تدخلاتك الفعلية ونشر توجيهاتك المعتمدة."
                  : "Explorez librement l'espace spécialiste. Connectez-vous pour traiter vos dossiers et publier des conseils pédagogiques."}
              </span>
            </div>
            <Link
              href={`/${locale}/connexion?callbackUrl=/${locale}/dashboard/specialiste`}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#0056D2] hover:bg-[#00419e] text-white font-medium transition-colors shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{ar ? "تسجيل الدخول للمتخصص" : "Espace Spécialiste Authentifié"}</span>
              <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <SpecialistWorkspace
          locale={locale}
          specialistName={session?.user?.name || (ar ? "د. أمل البوعزيزي" : "Dr. Amel Bouazizi")}
          initialEstablishments={formattedEstablishments}
          initialRequests={formattedRequests}
          initialTips={formattedTips}
        />
      </div>
    </div>
  );
}
