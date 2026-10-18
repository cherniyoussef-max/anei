import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { AdminContactsManager } from "@/components/admin/AdminContactsManager";
import { AdminPageHeader } from "@/modules/admin/components/AdminPageHeader";
import { AdminFooter } from "@/modules/admin/components/AdminFooter";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  await requireAdminPermission(locale, "contacts.read");

  const messages = await db
    .select({
      id: contactMessages.id,
      name: contactMessages.name,
      email: contactMessages.email,
      subject: contactMessages.subject,
      message: contactMessages.message,
      status: contactMessages.status,
      createdAt: contactMessages.createdAt,
    })
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));

  const ar = locale === "ar";

  return (
    <>
      <AdminPageHeader
        locale={locale}
        eyebrow={ar ? "الدعم الفني والمراسلات" : "Support & Relation Familles"}
        title={ar ? "رسائل الاتصال والدعم الأكاديمي" : "Messages & Demandes de Contact"}
        description={
          ar
            ? "متابعة ومعالجة رسائل واستفسارات أولياء الأمور والمؤسسات الواردة عبر النموذج الرسمي."
            : "Suivi opérationnel, traitement et réponse aux messages reçus via le formulaire de contact officiel."
        }
      />

      <AdminContactsManager locale={locale} initialMessages={messages} />

      <AdminFooter locale={locale} />
    </>
  );
}
