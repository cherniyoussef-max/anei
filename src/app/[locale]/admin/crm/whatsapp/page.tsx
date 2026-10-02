import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import {
  getOrCreateWhatsAppAccountForOrg,
  getWhatsAppConversations,
  getWhatsAppDirectoryContacts,
  listWhatsAppTemplates,
} from "@/server/queries/whatsapp";
import { whatsappConfigured } from "@/server/whatsapp/config";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminWhatsAppMessenger } from "@/components/admin/AdminWhatsAppMessenger";

export const dynamic = "force-dynamic";

export default async function AdminWhatsAppCRMPage({
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

  const account = await getOrCreateWhatsAppAccountForOrg(organization.id);
  const [templates, conversations, directory] = await Promise.all([
    listWhatsAppTemplates(organization.id),
    getWhatsAppConversations(organization.id),
    getWhatsAppDirectoryContacts(organization.id),
  ]);

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل" : "Communication CRM"}
        title={ar ? "واتساب CRM — المحادثات والأرقام" : "WhatsApp CRM — Discussions & Numéros"}
        description={
          ar
            ? "لوحة محادثات واتساب الموحدة لجميع المتعلمين والشركاء والمستخدمين مع الربط المباشر مع Meta."
            : "Centre de messagerie WhatsApp unifié pour tous les apprenants, formateurs, contacts CRM et intégration Meta Cloud API."
        }
      />

      <AdminWhatsAppMessenger
        organizationId={organization.id}
        locale={locale}
        initialConversations={conversations.map((c) => ({
          ...c,
          lastMessage: c.lastMessage
            ? {
                ...c.lastMessage,
                createdAt: c.lastMessage.createdAt.toISOString(),
              }
            : null,
        }))}
        initialDirectory={directory}
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          language: t.language,
          status: t.status,
          parameterCount: t.parameterCount,
        }))}
        account={
          account
            ? {
                phoneNumberId: account.phoneNumberId,
                businessAccountId: account.businessAccountId,
                displayPhoneNumber: account.displayPhoneNumber,
                status: account.status,
              }
            : null
        }
        metaConfigured={whatsappConfigured}
      />
    </>
  );
}
