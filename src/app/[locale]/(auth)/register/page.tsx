import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { AuthShell } from "@/components/auth/AuthShell";
import { RegisterWizard } from "@/components/auth/RegisterWizard";
import { googleAuthConfigured } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));

  return (
    <AuthShell locale={locale} mode="register">
      <RegisterWizard locale={locale} googleConfigured={googleAuthConfigured} />
    </AuthShell>
  );
}
