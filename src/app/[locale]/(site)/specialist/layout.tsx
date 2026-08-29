import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaPortalShell } from "@/modules/personas/components/PersonaPortalShell";

export const dynamic = "force-dynamic";

export default async function SpecialistLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "SPECIALIST");
  {/* Assigned learners ("Suivis") are already shown on the overview page itself;
      a dedicated appointments view has no safe existing query to scope to this
      persona yet, so neither gets a separate nav entry until backed by real data. */}
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} profileHref={`/${locale}/specialist/profil`} items={[
    { href: `/${locale}/specialist`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
  ]}>{children}</PersonaPortalShell>;
}
