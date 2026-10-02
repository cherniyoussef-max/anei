import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { isLocale } from "@/lib/i18n";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { VerifyEmailPendingForm } from "@/components/auth/VerifyEmailPendingForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

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
    const isExpired = error === "TOKEN_EXPIRED";
    return (
      <section className="auth-section">
        <div className="container auth-grid">
          <AuthShowcase locale={locale} mode="register" stage="verify" />
          <div className="auth-card">
            <div className="auth-card-header">
              <div className="auth-card-badge">{ar ? "أمان الحساب" : "SÉCURITÉ DU COMPTE"}</div>
              <h2>{isExpired ? (ar ? "انتهت صلاحية الرابط" : "Lien de vérification expiré") : (ar ? "رابط غير صالح" : "Lien non valide")}</h2>
              <p>
                {isExpired
                  ? (ar
                    ? "لحماية حسابك، تنتهي صلاحية روابط التحقق بعد فترة وجيزة. يرجى طلب رابط جديد للمتابعة."
                    : "Pour garantir la sécurité de votre compte, les liens de vérification ont une durée limitée.")
                  : (ar
                    ? "هذا الرابط غير صالح أو تم استخدامه مسبقًا. يمكنك تسجيل الدخول للتحقق من حسابك."
                    : "Ce lien est incorrect ou a déjà été utilisé. Connectez-vous pour vérifier votre statut.")}
              </p>
            </div>

            {isExpired && email ? (
              <VerifyEmailPendingForm locale={locale} email={email} />
            ) : (
              <div className="auth-missing-token" style={{ padding: "8px 0" }}>
                <Link className="btn btn-primary btn-block auth-submit-btn" href={`/${locale}/login`}>
                  {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
                </Link>
              </div>
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
        <AuthShowcase locale={locale} mode="register" stage="verify" />
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-badge">{ar ? "تأكيد الحساب" : "VÉRIFICATION DU COMPTE"}</div>
            <h2>{ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez votre boîte e-mail"}</h2>
            <p>
              {ar
                ? "أرسلنا رابط تفعيل آمن لتأكيد هويتك وتمكين الوصول إلى منصة التربية الدامجة."
                : "Un lien de confirmation sécurisé vous a été envoyé pour finaliser votre inscription."}
            </p>
          </div>
          <VerifyEmailPendingForm locale={locale} email={email} />
        </div>
      </div>
    </section>
  );
}
