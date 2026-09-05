import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaShell } from "@/modules/personas/components/PersonaShell";
import "../../(learner)/dashboard/student-dashboard.css";

export const dynamic = "force-dynamic";

export default async function SpecialistLayout({ children, params }: {
  children: React.ReactNode; params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireActivePersona(locale, "SPECIALIST");
  const ar = locale === "ar";
  {/* Assigned learners ("Suivis") are already shown on the overview page itself;
      a dedicated appointments view has no safe existing query to scope to this
      persona yet, so neither gets a separate nav entry until backed by real data. */}
  return <PersonaShell
    locale={locale}
    roleLabel={ar ? "مساحة الأخصائي" : "Espace spécialiste"}
    user={{ name: session.user.name, email: session.user.email }}
    profileHref={`/${locale}/specialist/profil`}
    base={`/${locale}/specialist`}
    items={[
      { href: `/${locale}/specialist`, icon: "LayoutDashboard", fr: "Vue d’ensemble", ar: "نظرة عامة" },
    ]}
  >{children}</PersonaShell>;
}
