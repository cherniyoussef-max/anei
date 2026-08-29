import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getTeacherProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

export const dynamic = "force-dynamic";

export default async function TeacherProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "TEACHER");
  const ar = locale === "ar";
  const [credential, profile, teacherProfile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getTeacherProfileForUser(session.user.id),
  ]);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة المكوّن" : "Espace formateur"}</span>
      <h1>{ar ? "الملف الشخصي والأمان" : "Profil et sécurité"}</h1>
    </div>
    {teacherProfile && (teacherProfile.discipline || teacherProfile.qualification || teacherProfile.experienceYears != null || teacherProfile.professionalInstitution || (teacherProfile.levelsTaught?.length ?? 0) > 0) && (
      <div className="dashboard-panel wide dashboard-panel-spaced">
        <div className="panel-head"><h2>{ar ? "ملفي المهني" : "Profil professionnel"}</h2></div>
        <dl className="wizard-summary">
          {teacherProfile.discipline && <div className="wizard-summary-row"><dt>{ar ? "التخصص" : "Discipline"}</dt><dd>{teacherProfile.discipline}</dd></div>}
          {teacherProfile.qualification && <div className="wizard-summary-row"><dt>{ar ? "المؤهل" : "Qualification"}</dt><dd>{teacherProfile.qualification}</dd></div>}
          {teacherProfile.experienceYears != null && <div className="wizard-summary-row"><dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd>{teacherProfile.experienceYears}</dd></div>}
          {teacherProfile.levelsTaught && teacherProfile.levelsTaught.length > 0 && <div className="wizard-summary-row"><dt>{ar ? "المستويات المُدرَّسة" : "Niveaux enseignés"}</dt><dd>{teacherProfile.levelsTaught.join(", ")}</dd></div>}
          {teacherProfile.professionalInstitution && <div className="wizard-summary-row"><dt>{ar ? "المؤسسة" : "Établissement"}</dt><dd>{teacherProfile.professionalInstitution}</dd></div>}
        </dl>
      </div>
    )}
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
