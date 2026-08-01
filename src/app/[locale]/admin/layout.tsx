import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminShell } from "@/modules/admin/components/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireAdminPermission(locale, "overview.read");
  return <AdminShell locale={locale} user={{
    name: session.user.name, email: session.user.email, role: String(session.user.role),
  }}>{children}</AdminShell>;
}
