import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import {
  getOrCreateSocialAccountForOrg,
  getSocialConversations,
} from "@/server/queries/social-messaging";
import { instagramConfigured, messengerConfigured } from "@/server/social/config";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminSocialMessenger } from "@/components/admin/AdminSocialMessenger";

export const dynamic = "force-dynamic";

export default async function AdminMessengerCRMPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPermission(locale, "crm.read");
  const ar = locale === "ar";

  const organization = await getPrimaryOrganization();
  if (!organization) notFound();

  await getOrCreateSocialAccountForOrg(organization.id, "MESSENGER");
  const conversations = await getSocialConversations(organization.id, "MESSENGER");

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? "فيسبوك ماسنجر CRM — الرسائل والمحادثات" : "Facebook Messenger CRM — Discussions & Messages"}
        description={
          ar
            ? "لوحة محادثات فيسبوك ماسنجر الموحدة لخدمة العملاء والرد على استفسارات صفحة الأكاديمية."
            : "Centre de support Facebook Messenger pour répondre aux prospects et apprenants depuis votre page officielle."
        }
      />

      <AdminSocialMessenger
        organizationId={organization.id}
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
