import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthForm } from "@/components/interactive/AuthForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { env, googleAuthConfigured } from "@/server/env";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";

export const dynamic = "force-dynamic";

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));
  const ar = locale === "ar";
  const en = locale === "en";

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <AuthShowcase locale={locale} mode="login" />

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-badge">{ar ? "أكاديمية ANEI" : en ? "ANEI ACADEMY" : "ACADÉMIE ANEI"}</div>
            <h2>{ar ? "مرحبًا بعودتك" : en ? "Sign in to ANEI" : "Bon retour parmi nous"}</h2>
            <p>
              {ar
                ? "أدخل بياناتك للوصول إلى مساحتك ومتابعة تقدمك."
                : en
                  ? "Enter your credentials to access your learning space."
                  : "Accédez à votre espace apprenant et retrouvez vos formations."}
            </p>
          </div>

          <AuthForm
            locale={locale}
            mode="login"
            googleConfigured={googleAuthConfigured}
            googleClientId={googleAuthConfigured ? env.GOOGLE_CLIENT_ID : undefined}
            verificationRequired={env.AUTH_REQUIRE_EMAIL_VERIFICATION}
          />

          <div className="auth-switch">
            <span>{ar ? "ليس لديك حساب بعد؟" : en ? "Don't have an account yet?" : "Pas encore de compte ?"}</span>{" "}
            <Link href={`/${locale}/register`} className="auth-switch-link">
              {ar ? "أنشئ حسابك الآن ←" : en ? "Create an account →" : "Créer un compte →"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
