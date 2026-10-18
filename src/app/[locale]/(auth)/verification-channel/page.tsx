import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { AuthShell } from "@/components/auth/AuthShell";
import { VerificationChannelForm } from "@/components/auth/VerificationChannelForm";

export const dynamic = "force-dynamic";

export default async function VerificationChannelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requirePrimaryUser(locale);
  const state = await resolveOnboardingState();
  if (state.state !== "ASSURANCE_REQUIRED") redirect(onboardingPathFor(locale, state));

  return (
    <AuthShell locale={locale} mode="login">
      <VerificationChannelForm locale={locale} />
    </AuthShell>
  );
}
