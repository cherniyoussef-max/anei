import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { getSessionAssurance } from "@/server/auth/assurance";
import { getUserProfile, isOnboardingCompleted } from "@/server/auth/profile";
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requirePrimaryUser(locale);
  const profile = await getUserProfile(session.user.id);
  const assurance = await getSessionAssurance(session.session.id);

  if (isOnboardingCompleted(profile) && assurance) redirect(`/${locale}/dashboard`);
  if (isOnboardingCompleted(profile)) redirect(`/${locale}/verification-channel`);

  const ar = locale === "ar";
  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-intro">
          <span className="eyebrow">{ar ? "الملف الشخصي" : "Profil"}</span>
          <h1>{ar ? "أكمل ملفك الشخصي للمتابعة" : "Complétez votre profil pour continuer"}</h1>
          <p>{ar ? "نستخدم معلوماتك لتفعيل المسارات المناسبة دون منح صلاحيات إدارية." : "Ces informations servent uniquement à l'onboarding et aux parcours, jamais à l'attribution de privilèges."}</p>
        </div>
        <div className="auth-card">
          <CompleteProfileForm locale={locale} email={session.user.email} name={session.user.name} />
        </div>
      </div>
    </section>
  );
}
