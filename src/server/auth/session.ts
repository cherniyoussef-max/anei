import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import type { Locale } from "@/types";
import { hasAdminPermission, type AdminPermission } from "@/modules/admin/domain/permissions";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { getUserPersonas } from "@/server/queries/personas";
import { getSessionAssurance } from "@/server/auth/assurance";
import { getImpersonationSession, getImpersonatedTargetUser } from "@/server/auth/impersonation";

/**
 * Request-scoped memoization of getSessionAssurance, keyed implicitly by
 * sessionId via React's cache(). getFreshSession() and requireAdmin()/
 * requireAdminPermission() each need the assurance row for the same
 * session within the same request (page + layout, or a helper calling
 * getFreshSession then re-checking assurance) — without this wrapper that
 * was a second, uncached DB round trip on every admin page render. This
 * does not change freshness semantics: cache() resets every request, so a
 * newly-completed or newly-expired assurance is still read correctly on
 * the next request.
 */
const getCachedSessionAssurance = cache((sessionId: string) => getSessionAssurance(sessionId));

const getAssuredSessionState = cache(async () => {
  let reqHeaders: Headers;
  try {
    reqHeaders = await headers();
  } catch {
    return { session: null, assurance: null };
  }

  const impersonation = await getImpersonationSession(reqHeaders);
  if (impersonation) {
    const targetUser = await getImpersonatedTargetUser(impersonation.targetUserId);

    if (targetUser) {
      const syntheticSession = {
        session: {
          id: `impersonated-${targetUser.id}`,
          userId: targetUser.id,
          expiresAt: new Date(impersonation.expiresAt),
          createdAt: new Date(impersonation.startedAt),
          updatedAt: new Date(),
          token: "impersonated",
          ipAddress: null,
          userAgent: null,
        },
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          emailVerified: targetUser.emailVerified,
          role: targetUser.role ?? "USER",
          locale: targetUser.locale ?? "fr",
          profileType: targetUser.profileType ?? "learner",
          createdAt: targetUser.createdAt,
          updatedAt: targetUser.updatedAt,
        },
        impersonation: {
          active: true,
          impersonatorId: impersonation.impersonatorId,
          impersonatorName: impersonation.impersonatorName,
          impersonatorEmail: impersonation.impersonatorEmail,
        },
      };

      return {
        session: syntheticSession as unknown as (typeof auth.$Infer.Session) & {
          impersonation?: {
            active: boolean;
            impersonatorId: string;
            impersonatorName: string;
            impersonatorEmail: string;
          };
        },
        assurance: {
          id: "impersonated-assurance",
          sessionId: `impersonated-${targetUser.id}`,
          userId: targetUser.id,
          method: "EMAIL" as const,
          verifiedAt: new Date(impersonation.startedAt),
          completedAt: new Date(impersonation.startedAt),
          expiresAt: new Date(impersonation.expiresAt),
          createdAt: new Date(impersonation.startedAt),
          updatedAt: new Date(impersonation.startedAt),
        },
      };
    }
  }

  const current = await auth.api.getSession({ headers: reqHeaders });
  if (!current) return { session: null, assurance: null };
  const assurance = await getCachedSessionAssurance(current.session.id);
  return { session: current, assurance };
});

export async function getSession() {
  const { session, assurance } = await getAssuredSessionState();
  return assurance ? session : null;
}

export async function getSessionWithAssurance() {
  return getAssuredSessionState();
}

/**
 * Same as getSession(), but bypasses Better Auth's cookieCache and reads the
 * session + role straight from the database. cookieCache (session.cookieCache,
 * maxAge 60s) can otherwise keep serving a role that was true up to 60 seconds
 * ago, which is not acceptable for authorization decisions: a demoted
 * ADMIN/SUPER_ADMIN must lose elevated access on their very next request, not
 * after the cache happens to expire. Every admin authorization path
 * (getAdminSession/getSuperAdminSession/getAdminSessionFor, requireAdmin,
 * requireAdminPermission) must go through this, not getSession().
 * Wrapped in React's cache() so a single request (e.g. an admin layout and
 * page both authorizing) only pays for one DB round trip.
 */
export const getFreshSession = cache(async () => {
  const current = await auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
  if (!current) return null;
  const assurance = await getCachedSessionAssurance(current.session.id);
  return assurance ? current : null;
});

/**
 * Deletes every Better Auth session row for a user via Better Auth's internal
 * (non-public) adapter API — better-auth does not expose per-user session
 * revocation outside its optional Admin plugin, which ANEI does not enable.
 * This is defense in depth only: it shortens how long an old browser session
 * stays valid at all, but authorization correctness after a role change comes
 * from getFreshSession() above, not from this call succeeding. Covered by
 * tests/integration/admin-role-session.test.ts against a real database.
 */
export async function revokeUserSessions(userId: string) {
  const context = await auth.$context;
  await context.internalAdapter.deleteUserSessions(userId);
}

async function resolveCurrentProtectedPath(locale: Locale, explicitTarget?: string): Promise<string> {
  if (explicitTarget) return explicitTarget;
  try {
    const reqHeaders = await headers();
    const pathname = reqHeaders.get("x-anei-pathname");
    const search = reqHeaders.get("x-anei-search") ?? "";
    if (pathname && pathname.startsWith(`/${locale}/`)) {
      return `${pathname}${search}`;
    }
  } catch {
    // headers() might not be available in non-request contexts
  }
  return `/${locale}/dashboard`;
}

export async function requireUser(locale: Locale, targetPath?: string) {
  const { session: current, assurance } = await getSessionWithAssurance();
  const target = await resolveCurrentProtectedPath(locale, targetPath);
  const nextParam = `?next=${encodeURIComponent(target)}`;
  if (!current) redirect(`/${locale}/login${nextParam}`);
  if (!assurance) redirect(`/${locale}/verification-channel${nextParam}`);
  return current;
}

export async function requirePrimaryUser(locale: Locale, targetPath?: string) {
  const current = await auth.api.getSession({ headers: await headers() });
  const target = await resolveCurrentProtectedPath(locale, targetPath);
  const nextParam = `?next=${encodeURIComponent(target)}`;
  if (!current) redirect(`/${locale}/login${nextParam}`);
  return current;
}

export async function requireAdmin(locale: Locale) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  const assurance = await getCachedSessionAssurance(current.session.id);
  if (!assurance) redirect(`/${locale}/verification-channel?next=${encodeURIComponent(`/${locale}/admin`)}`);
  const role = current.user.role as string | undefined;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  return current;
}

export async function requireAdminPermission(locale: Locale, permission: AdminPermission) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin`)}`);
  const assurance = await getCachedSessionAssurance(current.session.id);
  if (!assurance) redirect(`/${locale}/verification-channel?next=${encodeURIComponent(`/${locale}/admin`)}`);
  if (!hasAdminPermission(String(current.user.role), permission)) redirect(`/${locale}/dashboard`);
  return current;
}

/**
 * Server-side portal gate: verifies the authenticated user genuinely holds
 * the given persona with ACTIVE status, straight from the DB (never trusts
 * client state, nav visibility, or URL naming). Missing persona → user's primary portal or dashboard;
 * present but not yet ACTIVE (PENDING_REVIEW/SUSPENDED/REJECTED) →
 * pending-review page, never the portal itself.
 */
export async function requireActivePersona(locale: Locale, persona: Persona) {
  const portalPath = `/${locale}${personaPortalPath[persona]}`;
  const current = await requireUser(locale, portalPath);
  if (["ADMIN", "SUPER_ADMIN"].includes(String(current.user.role))) return current;
  const memberships = await getUserPersonas(current.user.id);
  const membership = memberships.find((row) => row.persona === persona);
  if (!membership) {
    const primary = memberships.find((row) => row.isPrimary);
    if (primary && primary.persona !== "STUDENT" && primary.status === "ACTIVE") {
      redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}`);
    }
    redirect(`/${locale}/dashboard`);
  }
  if (membership.status !== "ACTIVE") redirect(`/${locale}/pending-review`);
  return current;
}
