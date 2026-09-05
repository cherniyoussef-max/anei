import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaShell } from "@/modules/personas/components/PersonaShell";
import "../../(learner)/dashboard/student-dashboard.css";

export const dynamic = "force-dynamic";

export default async function ParentLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "PARENT");
  const ar = locale === "ar";
  return <PersonaShell
    locale={locale}
    roleLabel={ar ? "مساحة الوالدين" : "Espace parent"}
    user={{ name: session.user.name, email: session.user.email }}
    profileHref={`/${locale}/parent/profil`}
    base={`/${locale}/parent`}
    items={[
      { href: `/${locale}/parent`, icon: "LayoutDashboard", fr: "Vue d’ensemble", ar: "نظرة عامة" },
      { href: `/${locale}/parent/enfants`, icon: "Users", fr: "Mes enfants", ar: "أبنائي" },
    ]}
  >{children}</PersonaShell>;
}
