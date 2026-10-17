import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminOmnichannelCrm } from "@/components/admin/AdminOmnichannelCrm";
import type { Locale } from "@/types";

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

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "إدارة التواصل الاجتماعي" : "Communication Sociale CRM"}
        title={ar ? "إنستغرام Direct CRM — الرسائل وإعلانات Meta" : "Instagram Direct CRM — Discussions & Meta Ads"}
        description={
          ar
            ? "الرد المباشر وإدارة رسائل إنستغرام لجميع المتعلمين والمتابعين مع تتبع الإعلانات ومسار التحويل."
            : "Centre de support Instagram Direct unifié avec attribution des campagnes Meta Ads et gestion du pipeline."
        }
      />

      <AdminOmnichannelCrm
        initialChannel="INSTAGRAM"
        locale={locale as Locale}
      />
    </>
  );
}
