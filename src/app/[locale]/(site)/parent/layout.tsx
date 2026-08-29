import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaPortalShell } from "@/modules/personas/components/PersonaPortalShell";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "PARENT");
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} profileHref={`/${locale}/parent/profil`} items={[
    { href: `/${locale}/parent`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    { href: `/${locale}/parent/enfants`, icon: "users", fr: "Mes enfants", ar: "أبنائي" },
  ]}>{children}</PersonaPortalShell>;
}
