import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PasswordRecoveryForm } from "@/components/interactive/PasswordRecoveryForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <AuthShowcase locale={locale} mode="recovery" />

        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-card-badge">{ar ? "استرجاع الحساب" : "RÉCUPÉRATION DU COMPTE"}</div>
            <h2>{ar ? "استرجاع كلمة المرور" : en ? "Reset your password" : "Mot de passe oublié ?"}</h2>
            <p>
              {ar
                ? "أدخل بريدك الإلكتروني المسجل وسنرسل لك رمز أمان مؤقت لإعادة ضبط حسابك بأمان."
                : en
                  ? "Enter your registered email and we will send you a temporary security code to reset your account."
                  : "Renseignez votre e-mail enregistré pour recevoir un code temporaire et réinitialiser votre accès."}
            </p>
          </div>

          <PasswordRecoveryForm locale={locale} />

          <div className="auth-switch">
            <span>{ar ? "تذكرت كلمة المرور؟" : en ? "Remember your password?" : "Vous vous souvenez de votre mot de passe ?"}</span>{" "}
            <Link href={`/${locale}/login`} className="auth-switch-link">
              {ar ? "العودة لتسجيل الدخول ←" : "Retour à la connexion →"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
