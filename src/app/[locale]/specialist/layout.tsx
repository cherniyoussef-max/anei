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
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} items={[
    { href: `/${locale}/specialist`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    { href: `/${locale}/specialist/suivis`, icon: "users", fr: "Suivis", ar: "المتابعات" },
    { href: `/${locale}/specialist/rendez-vous`, icon: "calendar", fr: "Rendez-vous", ar: "المواعيد" },
  ]}>{children}</PersonaPortalShell>;
}
