import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById, getOrganizationMembers } from "@/server/queries/organizations";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOrganizationMembers } from "@/components/admin/AdminOrganizationMembers";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(id).success) notFound();
  await requireAdminPermission(locale, "organizations.manage");
  const ar = locale === "ar";
  const [organization, members] = await Promise.all([getOrganizationById(id), getOrganizationMembers(id)]);
  if (!organization) notFound();

  return <>
    <AdminPageHeader locale={locale} eyebrow={ar ? "المؤسسة" : "Organisation"}
      title={organization.name}
      description={organization.slug} />
    <section className="admin-surface">
      <AdminOrganizationMembers organizationId={id} locale={locale}
        members={members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, status: m.status }))} />
    </section>
  </>;
}
