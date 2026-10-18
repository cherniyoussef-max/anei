import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { VerifyEmailPendingForm } from "@/components/auth/VerifyEmailPendingForm";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";
import { ArrowLeft, ArrowRight, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

const KNOWN_ERRORS = new Set(["TOKEN_EXPIRED", "INVALID_TOKEN", "USER_NOT_FOUND"]);

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { error, email } = await searchParams;
  const ar = locale === "ar";
  const ArrowIcon = ar ? ArrowLeft : ArrowRight;

  if (error && KNOWN_ERRORS.has(error)) {
    const isExpired = error === "TOKEN_EXPIRED";
    return (
      <AuthShell locale={locale} mode="register">
        <div className="w-full">
          <AuthWizardProgress
            currentStep={2}
            totalSteps={2}
            stepTitle={isExpired ? (ar ? "انتهت صلاحية الرابط" : "Lien de vérification expiré") : (ar ? "رابط غير صالح" : "Lien non valide")}
            stepSubtitle={
              isExpired
                ? (ar
                  ? "لحماية أمان حسابك، تنتهي صلاحية الروابط تلقائياً بعد فترة محددة."
                  : "Pour garantir la sécurité de votre compte, les liens de vérification ont une durée limitée.")
                : (ar
                  ? "هذا الرابط غير صالح أو تم استخدامه مسبقًا. يرجى تسجيل الدخول أو طلب رابط جديد."
                  : "Ce lien est incorrect ou a déjà été utilisé. Vous pouvez demander un nouveau lien.")
            }
            locale={locale}
          />

          <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 mx-auto my-6 shadow-xs">
            <ShieldAlert className="w-7 h-7" />
          </div>

          {isExpired && email ? (
            <VerifyEmailPendingForm locale={locale} email={email} hideHeader />
          ) : (
            <div className="pt-2">
              <Link
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-semibold transition-all shadow-xs"
                href={`/${locale}/login`}
              >
                <span>{ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}</span>
                <ArrowIcon className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </AuthShell>
    );
  }

  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));

  if (!email) redirect(`/${locale}/login`);

  return (
    <AuthShell locale={locale} mode="register">
      <VerifyEmailPendingForm locale={locale} email={email} />
    </AuthShell>
  );
}
