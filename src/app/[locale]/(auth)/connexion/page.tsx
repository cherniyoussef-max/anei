import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginWizard } from "@/components/auth/LoginWizard";
import { googleAuthConfigured } from "@/server/env";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const ar = locale === "ar";
  return {
    title: ar
      ? "تسجيل الدخول إلى الفضاء التعليمي | ANEI"
      : "Connexion à votre espace d'apprentissage | ANEI",
    description: ar
      ? "سجّل دخولك للوصول إلى دوراتك وشهاداتك المعتمدة ولوحة متابعة المرافقين المدرسيين."
      : "Accédez à vos formations certifiantes, vos attestations et votre tableau de bord sur l'Académie ANEI.",
    alternates: {
      canonical: `/${locale}/connexion`,
      languages: { fr: "/fr/connexion", ar: "/ar/connexion" },
    },
  };
}

export default async function ConnexionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));

  return (
    <AuthShell locale={locale} mode="login">
      <LoginWizard locale={locale} googleConfigured={googleAuthConfigured} />
    </AuthShell>
  );
}
