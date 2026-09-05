import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { PersonaShell } from "@/modules/personas/components/PersonaShell";
import "../../../(learner)/dashboard/student-dashboard.css";

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
  const ar = locale === "ar";
  return <PersonaShell
    locale={locale}
    roleLabel={ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"}
    user={{ name: session.user.name, email: session.user.email }}
    profileHref={`/${locale}/avs/espace/profil`}
    base={`/${locale}/avs/espace`}
    items={[
      { href: `/${locale}/avs/espace`, icon: "LayoutDashboard", fr: "Vue d’ensemble", ar: "نظرة عامة" },
      { href: `/${locale}/avs`, icon: "Contact", fr: "Annuaire public", ar: "الدليل العام" },
    ]}
  >{children}</PersonaShell>;
}
