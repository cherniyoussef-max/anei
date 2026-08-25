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
  return <PersonaPortalShell locale={locale} user={{ name: session.user.name, email: session.user.email }} items={[
    { href: `/${locale}/teacher`, icon: "chart", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    { href: `/${locale}/teacher/cohortes`, icon: "graduation", fr: "Mes cohortes", ar: "مجموعاتي" },
    { href: `/${locale}/teacher/ressources`, icon: "book", fr: "Ressources", ar: "الموارد" },
  ]}>{children}</PersonaPortalShell>;
}
