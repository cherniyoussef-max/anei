import { getSession } from "@/server/auth/session";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { hasAdminPermission, type AdminPermission } from "@/modules/admin/domain/permissions";

export async function getAdminSession() {
  const session = await getSession();
  return session && ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role)) ? session : null;
}

export async function getSuperAdminSession() {
  const session = await getSession();
  return session && String(session.user.role) === "SUPER_ADMIN" ? session : null;
}

export async function getAdminSessionFor(permission: AdminPermission) {
  const session = await getSession();
  return session && hasAdminPermission(String(session.user.role), permission) ? session : null;
}

/**
 * Authenticated administrative traffic is still rate-limited. This protects the
 * database and audit log from compromised sessions or accidental automation.
 */
export function adminMutationRateLimit(userId: string) {
  return consumeRateLimit(`admin:${userId}`, 120, 60);
}
