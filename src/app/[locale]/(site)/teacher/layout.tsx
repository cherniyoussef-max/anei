import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaPortalShell } from "@/modules/personas/components/PersonaPortalShell";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "TEACHER");
  {/* "Mes cohortes"/"Ressources" are Phase 11 scope (see src/server/queries/teacher-assignments.ts):
      the underlying query exists but the UI isn't wired yet, so no nav entry points there until it is. */}
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} profileHref={`/${locale}/teacher/profil`} items={[
    { href: `/${locale}/teacher`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
  ]}>{children}</PersonaPortalShell>;
}
