import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { getOrganizationProfileForUser } from "@/server/services/persona-profiles";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

export const dynamic = "force-dynamic";

export default async function OrganizationProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "ORGANIZATION");
  const ar = locale === "ar";
  const [credential, profile, organizationProfile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
    getOrganizationProfileForUser(session.user.id),
  ]);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة المؤسسة" : "Espace organisation"}</span>
      <h1>{ar ? "الملف الشخصي والأمان" : "Profil et sécurité"}</h1>
    </div>
    {organizationProfile && (organizationProfile.organizationName || organizationProfile.organizationType || organizationProfile.representativeRole) && (
      <div className="dashboard-panel wide dashboard-panel-spaced">
        <div className="panel-head"><h2>{ar ? "معلومات المؤسسة" : "Informations de l'organisation"}</h2></div>
        <dl className="wizard-summary">
          {organizationProfile.organizationName && <div className="wizard-summary-row"><dt>{ar ? "اسم المؤسسة" : "Nom de l'organisation"}</dt><dd>{organizationProfile.organizationName}</dd></div>}
          {organizationProfile.organizationType && <div className="wizard-summary-row"><dt>{ar ? "نوع المؤسسة" : "Type"}</dt><dd>{organizationProfile.organizationType}</dd></div>}
          {organizationProfile.representativeRole && <div className="wizard-summary-row"><dt>{ar ? "صفة الممثل" : "Rôle du représentant"}</dt><dd>{organizationProfile.representativeRole}</dd></div>}
        </dl>
      </div>
    )}
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
