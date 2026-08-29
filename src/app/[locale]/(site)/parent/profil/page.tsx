import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ProfessionalProfilePage } from "@/modules/personas/components/ProfessionalProfilePage";

export const dynamic = "force-dynamic";

export default async function ParentProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "PARENT");
  const ar = locale === "ar";
  const [credential, profile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
  ]);
  return <ProfessionalProfilePage locale={locale} roleLabel={ar ? "مساحة الأولياء" : "Espace parent"} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} country={profile?.country} governorate={profile?.governorate} city={profile?.city} professionalTitle={ar ? "معلومات الملف" : "Informations du profil"} professionalFacts={[]} hasCredential={Boolean(credential)}/>;
}
