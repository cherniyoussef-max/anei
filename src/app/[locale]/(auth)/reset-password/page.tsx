import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { ResetPasswordForm } from "@/components/interactive/ResetPasswordForm";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
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
        <AuthShowcase locale={locale} mode="recovery" stage="reset" />

        <div className="auth-card">
          <Suspense fallback={<p className="text-center py-6 text-slate-500">{ar ? "جارٍ التحميل..." : "Chargement..."}</p>}>
            <ResetPasswordForm locale={locale} />
          </Suspense>

          <div className="auth-switch">
            <span>{ar ? "تذكرت كلمة المرور القديمة؟" : en ? "Remember your old password?" : "Vous vous souvenez de votre mot de passe ?"}</span>{" "}
            <Link href={`/${locale}/login`} className="auth-switch-link">
              {ar ? "العودة لتسجيل الدخول ←" : "Retour à la connexion →"}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
