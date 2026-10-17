import { notFound } from "next/navigation";
import { desc } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireAdminPermission } from "@/server/auth/session";
import { db } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { AdminContactsManager } from "@/components/admin/AdminContactsManager";

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
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">
          {ar ? "الدعم الفني والمراسلات" : "Support & Relation Familles"}
        </span>
        <h1 className="mt-1 font-sans text-2xl font-bold tracking-tight text-[#082D55] sm:text-3xl">
          {ar ? "رسائل الاتصال والدعم الأكاديمي" : "Messages & Demandes de Contact"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {ar
            ? "متابعة ومعالجة رسائل واستفسارات أولياء الأمور والمؤسسات الواردة عبر النموذج الرسمي."
            : "Suivi opérationnel, traitement et réponse aux messages reçus via le formulaire de contact officiel."}
        </p>
      </div>

      <AdminContactsManager locale={locale} initialMessages={messages} />
    </div>
  );
}
