import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaShell } from "@/modules/personas/components/PersonaShell";
import "../../(learner)/dashboard/student-dashboard.css";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "TEACHER");
  const ar = locale === "ar";
  {/* "Mes cohortes"/"Ressources" are Phase 11 scope (see src/server/queries/teacher-assignments.ts):
      the underlying query exists but the UI isn't wired yet, so no nav entry points there until it is. */}
  return <PersonaShell
    locale={locale}
    roleLabel={ar ? "مساحة المكوّن" : "Espace formateur"}
    user={{ name: session.user.name, email: session.user.email }}
    profileHref={`/${locale}/teacher/profil`}
    base={`/${locale}/teacher`}
    items={[
      { href: `/${locale}/teacher`, icon: "LayoutDashboard", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    ]}
  >{children}</PersonaShell>;
}
