import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthForm } from "@/components/interactive/AuthForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";
import { env, googleAuthConfigured } from "@/server/env";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));
  const ar = locale === "ar";
  const en = locale === "en";

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <AuthShowcase locale={locale} mode="register" />

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{ar ? "إنشاء حساب جديد" : en ? "Create an Account" : "Créer un compte"}</h2>
            <p>
              {ar
                ? "انضم إلى مجتمع ANEI وابدأ رحلتك التعليمية اليوم."
                : en
                  ? "Join the ANEI community and start learning today."
                  : "Rejoignez la communauté ANEI et commencez votre parcours dès aujourd'hui."}
            </p>
          </div>

          <AuthForm
            locale={locale}
            mode="register"
            googleConfigured={googleAuthConfigured}
            googleClientId={googleAuthConfigured ? env.GOOGLE_CLIENT_ID : undefined}
            verificationRequired={env.AUTH_REQUIRE_EMAIL_VERIFICATION}
          />

          <div className="auth-switch">
            <span>{ar ? "لديك حساب بالفعل؟" : en ? "Already registered?" : "Vous avez déjà un compte ?"}</span>{" "}
            <Link href={`/${locale}/login`} className="auth-switch-link">
              {ar ? "تسجيل الدخول ←" : en ? "Sign in →" : "Se connecter →"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
