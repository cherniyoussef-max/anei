import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getAvsProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

export const dynamic = "force-dynamic";

export default async function AvsProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "AVS");
  const ar = locale === "ar";
  const [credential, profile, avsProfile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getAvsProfileForUser(session.user.id),
  ]);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"}</span>
      <h1>{ar ? "الملف الشخصي والأمان" : "Profil et sécurité"}</h1>
    </div>
    {avsProfile && (avsProfile.qualification || avsProfile.experienceYears != null || (avsProfile.interventionDomains?.length ?? 0) > 0) && (
      <div className="dashboard-panel wide dashboard-panel-spaced">
        <div className="panel-head"><h2>{ar ? "ملفي المهني" : "Profil professionnel"}</h2></div>
        <dl className="wizard-summary">
          {avsProfile.qualification && <div className="wizard-summary-row"><dt>{ar ? "المؤهل" : "Qualification"}</dt><dd>{avsProfile.qualification}</dd></div>}
          {avsProfile.experienceYears != null && <div className="wizard-summary-row"><dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd>{avsProfile.experienceYears}</dd></div>}
          {avsProfile.interventionDomains && avsProfile.interventionDomains.length > 0 && <div className="wizard-summary-row"><dt>{ar ? "مجالات التدخل" : "Domaines d'accompagnement"}</dt><dd>{avsProfile.interventionDomains.join(", ")}</dd></div>}
        </dl>
      </div>
    )}
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
