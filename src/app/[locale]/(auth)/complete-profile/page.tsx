import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requirePrimaryUser } from "@/server/auth/session";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";
import { getUserPersonas } from "@/server/queries/personas";
import { CompleteProfileForm } from "@/components/auth/CompleteProfileForm";
import type { Persona } from "@/modules/personas/domain/permissions";

export const dynamic = "force-dynamic";

export default async function CompleteProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await requirePrimaryUser(locale);
  const state = await resolveOnboardingState();
  if (state.state !== "PROFILE_INCOMPLETE") redirect(onboardingPathFor(locale, state));

  // A primary persona membership already exists only when it was created
  // eagerly at credentials sign-up (see databaseHooks.user.create.after) -
  // that reflects real registration-time intent. OAuth/Google-created
  // accounts have no such membership yet, so they must choose explicitly
  // instead of the form silently defaulting to STUDENT.
  const memberships = await getUserPersonas(session.user.id);
  const initialPersona = (memberships.find((row) => row.isPrimary)?.persona as Persona | undefined) ?? null;

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
          <CompleteProfileForm locale={locale} email={session.user.email} name={session.user.name} initialPersona={initialPersona} />
        </div>
      </div>
    </section>
  );
}
