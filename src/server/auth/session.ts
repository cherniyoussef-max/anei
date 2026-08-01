import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import type { Locale } from "@/types";
import { hasAdminPermission, type AdminPermission } from "@/modules/admin/domain/permissions";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser(locale: Locale) {
  const current = await getSession();
  if (!current) redirect(`/${locale}/login?next=/${locale}/dashboard`);
  return current;
}

export async function requireAdmin(locale: Locale) {
  const current = await requireUser(locale);
  const role = current.user.role as string | undefined;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") redirect(`/${locale}/dashboard`);
  return current;
}

export async function requireAdminPermission(locale: Locale, permission: AdminPermission) {
  const current = await requireUser(locale);
  if (!hasAdminPermission(String(current.user.role), permission)) redirect(`/${locale}/dashboard`);
  return current;
}
