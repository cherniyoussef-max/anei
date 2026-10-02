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

export default async function AdminInstagramCRMPage({
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

  await getOrCreateSocialAccountForOrg(organization.id, "INSTAGRAM");
  const conversations = await getSocialConversations(organization.id, "INSTAGRAM");

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? "إنستغرام Direct CRM — الرسائل والمحادثات" : "Instagram Direct CRM — Discussions & Messages"}
        description={
          ar
            ? "الرد المباشر وإدارة رسائل إنستغرام لجميع المتعلمين والمتابعين مع الربط بملفات العملاء في CRM."
            : "Centre de support Instagram Direct unifié pour les apprenants, prospects et communauté ANEI via Meta Graph API."
        }
      />

      <AdminSocialMessenger
        organizationId={organization.id}
        locale={locale}
        initialChannel="INSTAGRAM"
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
