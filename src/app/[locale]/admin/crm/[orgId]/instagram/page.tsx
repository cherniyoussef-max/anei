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

export default async function AdminOrgInstagramCRMPage({
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

  await getOrCreateSocialAccountForOrg(orgId, "INSTAGRAM");
  const conversations = await getSocialConversations(orgId, "INSTAGRAM");

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? `إنستغرام Direct CRM — ${organization.name}` : `Instagram Direct CRM — ${organization.name}`}
        description={
          ar
            ? "الرد المباشر وإدارة رسائل إنستغرام لجميع المتعلمين والمتابعين مع الربط بملفات العملاء في CRM."
            : "Centre de support Instagram Direct unifié pour les apprenants, prospects et communauté ANEI via Meta Graph API."
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
