import "server-only";
import { headers } from "next/headers";
import type { Locale } from "@/types";
import { env } from "@/server/env";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { getUserProfile, isOnboardingCompleted } from "@/server/auth/profile";
import { getUserPersonas } from "@/server/queries/personas";
import { safeAppRedirect } from "@/lib/security/safe-redirect";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";

/**
 * Authoritative onboarding state, derived only from server/DB data (Better
 * Auth session, emailVerified, AUTH_REQUIRE_EMAIL_VERIFICATION, userProfile,
 * persona membership, session assurance). Never trusts query params,
 * localStorage, or any client-claimed profileType/verification/persona
 * status. Single source of truth for onboarding routing - pages must call
 * this instead of independently re-deriving the same state, to avoid drift
 * and redirect loops.
 */
export type OnboardingState =
  | { state: "UNAUTHENTICATED" }
  | { state: "EMAIL_VERIFICATION_REQUIRED" }
  | { state: "PROFILE_INCOMPLETE" }
  | { state: "ASSURANCE_REQUIRED" }
  | { state: "PERSONA_PENDING_APPROVAL" }
  | { state: "READY"; persona: Persona | null };

export async function resolveOnboardingState(): Promise<OnboardingState> {
  // Uses the raw, assurance-independent session (like requirePrimaryUser),
  // never getSession()/getSessionWithAssurance() - those return a null
  // session whenever assurance is missing, which would misclassify a real,
  // authenticated-but-unassured user as UNAUTHENTICATED here and send them
  // back to login instead of through PROFILE_INCOMPLETE/ASSURANCE_REQUIRED.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { state: "UNAUTHENTICATED" };

  // ADMIN/SUPER_ADMIN accounts are provisioned out-of-band and are never
  // routed through learner/persona onboarding - existing admin authorization
  // (requireAdmin/requireAdminPermission) remains the sole gate for /admin.
  const role = session.user.role as string | undefined;
  if (role === "ADMIN" || role === "SUPER_ADMIN") return { state: "READY", persona: null };

  // In production AUTH_REQUIRE_EMAIL_VERIFICATION is always enabled, and
  // Better Auth already blocks sign-in / skips auto-sign-in for unverified
  // credential users, making this state effectively unreachable there. Kept
  // as defense-in-depth for non-production configs and for any future
  // session-issuing path that does not go through those checks.
  if (env.AUTH_REQUIRE_EMAIL_VERIFICATION && !session.user.emailVerified) {
    return { state: "EMAIL_VERIFICATION_REQUIRED" };
  }

  const profile = await getUserProfile(session.user.id);
  if (!isOnboardingCompleted(profile)) return { state: "PROFILE_INCOMPLETE" };

  const assurance = await getSessionAssurance(session.session.id);
  if (!assurance) return { state: "ASSURANCE_REQUIRED" };

  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  if (primary && primary.status !== "ACTIVE") return { state: "PERSONA_PENDING_APPROVAL" };

  return { state: "READY", persona: (primary?.persona as Persona | undefined) ?? null };
}

/** Maps a resolved state to the correct in-app path. `next` is only ever used for the UNAUTHENTICATED->login case, and always goes through safeAppRedirect. */
export function onboardingPathFor(locale: Locale, result: OnboardingState, next?: string | null): string {
  switch (result.state) {
    case "UNAUTHENTICATED": {
      const target = next ? safeAppRedirect(next, locale) : `/${locale}/dashboard`;
      return `/${locale}/login?next=${encodeURIComponent(target)}`;
    }
    case "EMAIL_VERIFICATION_REQUIRED":
      return `/${locale}/login`;
    case "PROFILE_INCOMPLETE":
      return `/${locale}/complete-profile`;
    case "ASSURANCE_REQUIRED":
      return `/${locale}/verification-channel`;
    case "PERSONA_PENDING_APPROVAL":
      return `/${locale}/pending-review`;
    case "READY":
      return result.persona ? `/${locale}${personaPortalPath[result.persona]}` : `/${locale}/dashboard`;
  }
}
