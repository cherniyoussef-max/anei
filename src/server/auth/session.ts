import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import type { Locale } from "@/types";
import { hasAdminPermission, type AdminPermission } from "@/modules/admin/domain/permissions";
import type { Persona } from "@/modules/personas/domain/permissions";
import { getUserPersonas } from "@/server/queries/personas";
import { getSessionAssurance } from "@/server/auth/assurance";

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
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) return { session: null, assurance: null };
  const assurance = await getCachedSessionAssurance(current.session.id);
  return { session: assurance ? current : null, assurance };
});

export async function getSession() {
  return (await getAssuredSessionState()).session;
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

export async function requireUser(locale: Locale) {
  const { session: current, assurance } = await getSessionWithAssurance();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  if (!assurance) redirect(`/${locale}/verification-channel`);
  return current;
}

export async function requirePrimaryUser(locale: Locale) {
  const current = await auth.api.getSession({ headers: await headers() });
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  return current;
}

export async function requireAdmin(locale: Locale) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  const assurance = await getCachedSessionAssurance(current.session.id);
  if (!assurance) redirect(`/${locale}/verification-channel`);
  const role = current.user.role as string | undefined;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  return current;
}

export async function requireAdminPermission(locale: Locale, permission: AdminPermission) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  const assurance = await getCachedSessionAssurance(current.session.id);
  if (!assurance) redirect(`/${locale}/verification-channel`);
  if (!hasAdminPermission(String(current.user.role), permission)) redirect(`/${locale}/dashboard`);
  return current;
}

/**
 * Server-side portal gate: verifies the authenticated user genuinely holds
 * the given persona with ACTIVE status, straight from the DB (never trusts
 * client state, nav visibility, or URL naming). Missing persona → dashboard;
 * present but not yet ACTIVE (PENDING_REVIEW/SUSPENDED/REJECTED) →
 * pending-review page, never the portal itself.
 */
export async function requireActivePersona(locale: Locale, persona: Persona) {
  const current = await requireUser(locale);
  const memberships = await getUserPersonas(current.user.id);
  const membership = memberships.find((row) => row.persona === persona);
  if (!membership) redirect(`/${locale}/dashboard`);
  if (membership.status !== "ACTIVE") redirect(`/${locale}/pending-review`);
  return current;
}
