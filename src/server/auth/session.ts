import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import type { Locale } from "@/types";
import { hasAdminPermission, type AdminPermission } from "@/modules/admin/domain/permissions";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
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
  return auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } });
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
  const current = await getSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  return current;
}

export async function requireAdmin(locale: Locale) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  const role = current.user.role as string | undefined;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  return current;
}

export async function requireAdminPermission(locale: Locale, permission: AdminPermission) {
  const current = await getFreshSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  if (!hasAdminPermission(String(current.user.role), permission)) redirect(`/${locale}/dashboard`);
  return current;
}
