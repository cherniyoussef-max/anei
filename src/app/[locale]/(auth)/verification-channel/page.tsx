import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { VerificationChannelForm } from "@/components/auth/VerificationChannelForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

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
        <AuthShowcase locale={locale} mode="register" stage="verify" />
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-badge">{ar ? "حماية الجلسة" : "SÉCURITÉ DE SESSION"}</div>
            <h2>{ar ? "رمز التحقق المؤقت" : "Code de vérification"}</h2>
            <p>
              {ar
                ? "اختر طريقة استلام رمز أمان لمرة واحدة صالح لمدة 5 دقائق لتأكيد جلستك."
                : "Choisissez un canal pour recevoir votre code à usage unique (valable 5 minutes)."}
            </p>
          </div>
          <VerificationChannelForm locale={locale} />
        </div>
      </div>
    </section>
  );
}
