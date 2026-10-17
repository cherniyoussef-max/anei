import { redirect, notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminCrmOrganizationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "crm.read");

  redirect(`/${locale}/admin/crm/whatsapp`);
}
