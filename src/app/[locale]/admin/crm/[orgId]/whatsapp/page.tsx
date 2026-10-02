import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { getOrganizationById } from "@/server/queries/organizations";
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

export default async function AdminWhatsAppPage({
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

  const account = await getOrCreateWhatsAppAccountForOrg(orgId);
  const [templates, conversations, directory] = await Promise.all([
    listWhatsAppTemplates(orgId),
    getWhatsAppConversations(orgId),
    getWhatsAppDirectoryContacts(orgId),
  ]);

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل" : "Communication CRM"}
        title={ar ? `واتساب CRM — ${organization.name}` : `WhatsApp CRM — ${organization.name}`}
        description={
          ar
            ? "لوحة محادثات واتساب الموحدة لجميع المتعلمين والشركاء والمستخدمين مع الربط المباشر مع Meta."
            : "Centre de messagerie WhatsApp unifié pour tous les apprenants, formateurs, contacts CRM et intégration Meta Cloud API."
        }
        actions={
          <Link className="btn btn-secondary btn-sm" href={`/${locale}/admin/crm/${orgId}`}>
            {ar ? "ملف المؤسسة" : "Fiche organisation"}
          </Link>
        }
      />

      <AdminWhatsAppMessenger
        organizationId={orgId}
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