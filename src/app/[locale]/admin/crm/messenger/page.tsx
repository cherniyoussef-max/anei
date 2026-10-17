import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOmnichannelCrm } from "@/components/admin/AdminOmnichannelCrm";
import type { Locale } from "@/types";

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

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? "فيسبوك ماسنجر CRM — الرسائل وإعلانات Meta" : "Facebook Messenger CRM — Discussions & Meta Ads"}
        description={
          ar
            ? "لوحة محادثات فيسبوك ماسنجr الموحدة لخدمة العملاء وتتبع إعلانات Facebook Ads والتحويل."
            : "Centre de support Facebook Messenger pour répondre aux prospects issus des publicités Meta Ads et gérer les inscriptions."
        }
      />

      <AdminOmnichannelCrm
        initialChannel="MESSENGER"
        locale={locale as Locale}
      />
    </>
  );
}
