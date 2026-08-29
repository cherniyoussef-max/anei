import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaPortalShell } from "@/modules/personas/components/PersonaPortalShell";

export const dynamic = "force-dynamic";

// Shell only: organizations/members/cohorts entities are Phase 2
// (docs/premium/ROADMAP.md); this establishes the route/authorization
// foundation only.
export default async function OrganizationLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "ORGANIZATION");
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} profileHref={`/${locale}/organization/profil`} items={[
    { href: `/${locale}/organization`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
  ]}>{children}</PersonaPortalShell>;
}
