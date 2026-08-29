import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getTeacherProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ProfessionalProfilePage } from "@/modules/personas/components/ProfessionalProfilePage";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "TEACHER");
  const ar = locale === "ar";
  const [credential, profile, professional] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getTeacherProfileForUser(session.user.id),
  ]);
  return <ProfessionalProfilePage locale={locale} roleLabel={ar ? "مساحة المدرّس" : "Espace enseignant"} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} country={profile?.country} governorate={profile?.governorate} city={profile?.city} professionalTitle={ar ? "المسار المهني" : "Parcours professionnel"} professionalFacts={[
    { label: ar ? "المادة" : "Discipline", value: professional?.discipline },
    { label: ar ? "المؤهل" : "Qualification", value: professional?.qualification },
    { label: ar ? "سنوات الخبرة" : "Années d’expérience", value: professional?.experienceYears },
    { label: ar ? "المستويات المُدرَّسة" : "Niveaux enseignés", value: professional?.levelsTaught?.join(ar ? "، " : ", ") },
    { label: ar ? "المؤسسة" : "Établissement", value: professional?.professionalInstitution },
  ]} hasCredential={Boolean(credential)}/>;
}
