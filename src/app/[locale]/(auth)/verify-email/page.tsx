import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { VerifyEmailPendingForm } from "@/components/auth/VerifyEmailPendingForm";

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

  if (error && KNOWN_ERRORS.has(error)) {
    return (
      <section className="auth-section">
        <div className="container auth-grid">
          <div className="auth-intro">
            <span className="eyebrow">{ar ? "التحقق" : "Vérification"}</span>
          </div>
          <div className="auth-card">
            {error === "TOKEN_EXPIRED" ? (
              <>
                <h2>{ar ? "انتهت صلاحية رابط التحقق" : "Ce lien de vérification a expiré"}</h2>
                {email ? (
                  <VerifyEmailPendingForm locale={locale} email={email} />
                ) : (
                  <Link className="btn btn-primary btn-block" href={`/${locale}/login`}>
                    {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
                  </Link>
                )}
              </>
            ) : (
              <>
                <h2>{ar ? "رابط التحقق غير صالح" : "Ce lien de vérification n’est pas valide"}</h2>
                <Link className="btn btn-primary btn-block" href={`/${locale}/login`}>
                  {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));

  if (!email) redirect(`/${locale}/login`);

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-intro">
          <span className="eyebrow">{ar ? "التحقق" : "Vérification"}</span>
          <h1>{ar ? "تحقق من بريدك الإلكتروني للمتابعة" : "Vérifiez votre e-mail pour continuer"}</h1>
        </div>
        <div className="auth-card">
          <VerifyEmailPendingForm locale={locale} email={email} />
        </div>
      </div>
    </section>
  );
}
