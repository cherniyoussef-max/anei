import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaPortalShell } from "@/modules/personas/components/PersonaPortalShell";

export const dynamic = "force-dynamic";

// Placed at /avs/espace, not /avs: `/avs` is already the existing public,
// unauthenticated AVS directory listing page and must keep working
// unchanged. This is the authenticated AVS persona portal, a separate
// concern from the public directory profile (`avsProfiles`).
export default async function AvsPortalLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "AVS");
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} profileHref={`/${locale}/avs/espace/profil`} items={[
    { href: `/${locale}/avs/espace`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    { href: `/${locale}/avs`, icon: "users", fr: "Annuaire public", ar: "الدليل العام" },
  ]}>{children}</PersonaPortalShell>;
}
