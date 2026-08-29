import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getOrganizationProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ProfessionalProfilePage } from "@/modules/personas/components/ProfessionalProfilePage";

export const dynamic = "force-dynamic";

export default async function OrganizationProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "ORGANIZATION");
  const ar = locale === "ar";
  const [credential, profile, professional] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getOrganizationProfileForUser(session.user.id),
  ]);
  return <ProfessionalProfilePage locale={locale} roleLabel={ar ? "مساحة المؤسسة" : "Espace organisation"} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} country={profile?.country} governorate={profile?.governorate} city={profile?.city} professionalTitle={ar ? "هوية المؤسسة" : "Identité de l’organisation"} professionalFacts={[
    { label: ar ? "اسم المؤسسة" : "Nom de l’organisation", value: professional?.organizationName },
    { label: ar ? "نوع المؤسسة" : "Type d’organisation", value: professional?.organizationType },
    { label: ar ? "صفة الممثل" : "Rôle du représentant", value: professional?.representativeRole },
  ]} hasCredential={Boolean(credential)}/>;
}
