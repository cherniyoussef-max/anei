import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOmnichannelCrm } from "@/components/admin/AdminOmnichannelCrm";
import type { Locale } from "@/types";

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

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل" : "Communication CRM"}
        title={ar ? "واتساب CRM — المحادثات وإعلانات Meta" : "WhatsApp CRM — Discussions & Meta Ads Leads"}
        description={
          ar
            ? "لوحة محادثات واتساب الموحدة لجميع المتعلمين والشركاء مع تتبع إعلانات Meta Click-to-WhatsApp ومسار التحويل."
            : "Centre de messagerie WhatsApp unifié pour les apprenants et prospects avec attribution Meta Ads (Click-to-WhatsApp) et pipeline commercial."
        }
      />

      <AdminOmnichannelCrm
        initialChannel="WHATSAPP"
        locale={locale as Locale}
      />
    </>
  );
}
