import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getSpecialistProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

export const dynamic = "force-dynamic";

export default async function SpecialistProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "SPECIALIST");
  const ar = locale === "ar";
  const [credential, profile, specialistProfile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getSpecialistProfileForUser(session.user.id),
  ]);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الأخصائي" : "Espace spécialiste"}</span>
      <h1>{ar ? "الملف الشخصي والأمان" : "Profil et sécurité"}</h1>
    </div>
    {specialistProfile && (specialistProfile.specialty || specialistProfile.qualification || specialistProfile.experienceYears != null || specialistProfile.practiceStructure) && (
      <div className="dashboard-panel wide dashboard-panel-spaced">
        <div className="panel-head"><h2>{ar ? "ممارستي المهنية" : "Ma pratique professionnelle"}</h2></div>
        <dl className="wizard-summary">
          {specialistProfile.specialty && <div className="wizard-summary-row"><dt>{ar ? "التخصص الدقيق" : "Spécialité"}</dt><dd>{specialistProfile.specialty}</dd></div>}
          {specialistProfile.qualification && <div className="wizard-summary-row"><dt>{ar ? "المؤهل" : "Qualification"}</dt><dd>{specialistProfile.qualification}</dd></div>}
          {specialistProfile.experienceYears != null && <div className="wizard-summary-row"><dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd>{specialistProfile.experienceYears}</dd></div>}
          {specialistProfile.practiceStructure && <div className="wizard-summary-row"><dt>{ar ? "إطار الممارسة" : "Structure d'exercice"}</dt><dd>{specialistProfile.practiceStructure}</dd></div>}
          {specialistProfile.interventionDomains && specialistProfile.interventionDomains.length > 0 && <div className="wizard-summary-row"><dt>{ar ? "مجالات التدخل" : "Domaines d'intervention"}</dt><dd>{specialistProfile.interventionDomains.join(", ")}</dd></div>}
        </dl>
      </div>
    )}
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
