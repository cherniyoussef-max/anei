import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";

export default async function TeacherPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة المكوّن" : "Espace formateur"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      <p>{ar
        ? "قريبًا: إدارة مجموعاتك ومتابعة تقدم المتعلمين من هذه المساحة."
        : "Bientôt disponible : la gestion de vos cohortes et le suivi de la progression des apprenants, directement depuis cet espace."}</p>
    </div>
  </div>;
}
