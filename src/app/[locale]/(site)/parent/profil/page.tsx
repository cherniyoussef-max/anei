import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

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
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
      <h1>{ar ? "الملف الشخصي والأمان" : "Profil et sécurité"}</h1>
    </div>
    <AccountSecurityPanel locale={locale} name={session.user.name} email={session.user.email} phoneNumber={profile?.phoneNumber} phoneVerifiedAt={profile?.phoneVerifiedAt} hasCredential={Boolean(credential)} />
  </div>;
}
