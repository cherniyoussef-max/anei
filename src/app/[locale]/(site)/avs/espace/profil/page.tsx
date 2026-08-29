import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getAvsProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ProfessionalProfilePage } from "@/modules/personas/components/ProfessionalProfilePage";

export const dynamic = "force-dynamic";

export default async function AvsProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "AVS");
  const ar = locale === "ar";
  const [credential, profile, professional] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getAvsProfileForUser(session.user.id),
  ]);
  return <ProfessionalProfilePage locale={locale} roleLabel={ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} country={profile?.country} governorate={profile?.governorate} city={profile?.city} professionalTitle={ar ? "الخبرة في المرافقة" : "Expérience d’accompagnement"} professionalFacts={[
    { label: ar ? "المؤهل" : "Qualification", value: professional?.qualification },
    { label: ar ? "سنوات الخبرة" : "Années d’expérience", value: professional?.experienceYears },
    { label: ar ? "مجالات التدخل" : "Domaines d’accompagnement", value: professional?.interventionDomains?.join(ar ? "، " : ", ") },
  ]} hasCredential={Boolean(credential)}/>;
}
