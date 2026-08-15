import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";

export default async function OrganizationPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  await requireActivePersona(locale, "ORGANIZATION");
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة المؤسسة" : "Espace organisation"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      <p>{ar
        ? "قريبًا: متابعة عضويتك في المؤسسات من هذه المساحة."
        : "Bientôt disponible : le suivi de vos organisations, directement depuis cet espace."}</p>
    </div>
  </div>;
}
