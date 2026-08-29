import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getUserPersonas } from "@/server/queries/personas";
import { personaPortalPath, type Persona } from "@/modules/personas/domain/permissions";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";
import { LearnerProfileForm } from "@/components/student/LearnerProfileForm";
import { LearnerPageHeader } from "@/components/student/LearnerPages";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);

  if (["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role))) redirect(`/${locale}/admin`);

  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((row) => row.isPrimary);
  if (primary && primary.persona !== "STUDENT") {
    if (primary.status === "ACTIVE") redirect(`/${locale}${personaPortalPath[primary.persona as Persona]}/profil`);
    redirect(`/${locale}/pending-review`);
  }

  const ar = locale === "ar";
  const [credential, profile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
  ]);

  return <div className="learner-page learner-profile-page"><LearnerPageHeader title={ar ? "الملف الشخصي والأمان" : "Profil et sécurité"} description={ar ? "حدّث معلومات التعلم وراجع وسائل الاتصال وأمان حسابك." : "Mettez à jour votre profil d’apprentissage et contrôlez la sécurité du compte."} />
    {profile ? <section className="learner-settings-section" aria-labelledby="personal-title"><div className="learner-settings-heading"><h2 id="personal-title">{ar ? "المعلومات الشخصية والتعلم" : "Informations personnelles et apprentissage"}</h2><p>{ar ? "يمكن تعديل الحقول العادية فقط. تغيير الهاتف أو البريد يتطلب مسار تحقق مخصصًا." : "Seuls les champs ordinaires sont modifiables ici. Le téléphone et l’email utilisent un parcours de vérification dédié."}</p></div><LearnerProfileForm locale={locale} values={{ firstName: profile.firstName, lastName: profile.lastName, country: profile.country ?? "Tunisie", governorate: profile.governorate ?? "Tunis", city: profile.city ?? "", preferredLocale: profile.preferredLocale, educationLevel: profile.educationLevel ?? "", institutionName: profile.institutionName ?? "" }} /></section> : null}
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
