export const adminPermissions = [
  "overview.read",
  "users.read",
  "users.manage",
  "users.role.change",
  "personas.manage",
  "organizations.manage",
  "relationships.manage",
  "courses.read",
  "courses.create",
  "courses.update",
  "courses.publish",
  "courses.delete",
  "enrollments.read",
  "learning.read",
  "certificates.read",
  "webinars.read",
  "webinars.manage",
  "resources.read",
  "resources.manage",
  "news.read",
  "news.manage",
  "orders.read",
  "payments.read",
  "payments.reconcile",
  "contacts.read",
  "contacts.manage",
  "audit.read",
  "system.read",
] as const;

export type AdminPermission = (typeof adminPermissions)[number];
export type AdminRole = "USER" | "ADMIN" | "SUPER_ADMIN";

const adminCapabilities = new Set<AdminPermission>([
  "overview.read", "users.read", "users.manage", "personas.manage", "organizations.manage", "relationships.manage", "courses.read", "courses.create",
  "courses.update", "courses.publish", "enrollments.read", "learning.read",
  "certificates.read", "webinars.read", "webinars.manage", "resources.read",
  "resources.manage", "news.read", "news.manage", "orders.read", "payments.read",
  "payments.reconcile", "contacts.read", "contacts.manage", "audit.read", "system.read",
]);

export function hasAdminPermission(role: string | null | undefined, permission: AdminPermission) {
  if (role === "SUPER_ADMIN") return true;
  return role === "ADMIN" && adminCapabilities.has(permission);
}
