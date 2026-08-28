import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { VerificationChannelForm } from "@/components/auth/VerificationChannelForm";

export const dynamic = "force-dynamic";

export default async function VerificationChannelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requirePrimaryUser(locale);
  const state = await resolveOnboardingState();
  if (state.state !== "ASSURANCE_REQUIRED") redirect(onboardingPathFor(locale, state));

  const ar = locale === "ar";
  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-intro">
          <span className="eyebrow">{ar ? "التحقق" : "Vérification"}</span>
          <h1>{ar ? "اختر طريقة استلام رمز التحقق" : "Choisissez votre canal de vérification"}</h1>
          <p>{ar ? "رمز واحد صالح لمدة 5 دقائق يؤكد جلسة الدخول الحالية فقط." : "Un code à 6 chiffres, valable 5 minutes, confirme uniquement cette session."}</p>
        </div>
        <div className="auth-card">
          <VerificationChannelForm locale={locale} />
        </div>
      </div>
    </section>
  );
}
