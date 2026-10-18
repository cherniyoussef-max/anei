import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { getUserPersonas } from "@/server/queries/personas";
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm";
import { AuthShell } from "@/components/auth/AuthShell";
import type { Persona } from "@/modules/personas/domain/permissions";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requirePrimaryUser(locale);
  const state = await resolveOnboardingState();
  if (state.state !== "PROFILE_INCOMPLETE") redirect(onboardingPathFor(locale, state));

  const memberships = await getUserPersonas(session.user.id);
  const initialPersona = (memberships.find((row) => row.isPrimary)?.persona as Persona | undefined) ?? null;

  return (
    <AuthShell locale={locale} mode="register">
      <div className="w-full">
        <CompleteProfileForm locale={locale} email={session.user.email} name={session.user.name} initialPersona={initialPersona} />
      </div>
    </AuthShell>
  );
}
