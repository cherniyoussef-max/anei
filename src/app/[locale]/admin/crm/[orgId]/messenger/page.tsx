import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
import {
  getOrCreateSocialAccountForOrg,
  getSocialConversations,
} from "@/server/queries/social-messaging";
import { instagramConfigured, messengerConfigured } from "@/server/social/config";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSocialMessenger } from "@/components/admin/AdminSocialMessenger";

export const dynamic = "force-dynamic";

export default async function AdminOrgMessengerCRMPage({
  params,
}: {
  params: Promise<{ locale: string; orgId: string }>;
}) {
  const { locale, orgId } = await params;
  if (!isLocale(locale) || !z.string().uuid().safeParse(orgId).success) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getOrganizationById(orgId);
  if (!organization) notFound();

  await getOrCreateSocialAccountForOrg(orgId, "MESSENGER");
  const conversations = await getSocialConversations(orgId, "MESSENGER");

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? `فيسبوك ماسنجر CRM — ${organization.name}` : `Facebook Messenger CRM — ${organization.name}`}
        description={
          ar
            ? "لوحة محادثات فيسبوك ماسنجر الموحدة لخدمة العملاء والرد على استفسارات صفحة الأكاديمية."
            : "Centre de support Facebook Messenger pour répondre aux prospects et apprenants depuis votre page officielle."
        }
        actions={
          <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/crm/${orgId}`}>
            {ar ? "ملف المؤسسة" : "Fiche organisation"}
          </Link>
        }
      />

      <AdminSocialMessenger
        organizationId={orgId}
        locale={locale}
        initialChannel="MESSENGER"
        initialConversations={conversations.map((c) => ({
          ...c,
          lastMessage: c.lastMessage
            ? {
                ...c.lastMessage,
                createdAt: c.lastMessage.createdAt.toISOString(),
              }
            : null,
        }))}
        metaConfigured={{
          instagram: instagramConfigured,
          messenger: messengerConfigured,
        }}
      />
    </>
  );
}
