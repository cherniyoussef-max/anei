import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";

export default async function AvsPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  await requireActivePersona(locale, "AVS");
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      <p>{ar
        ? "قريبًا: متابعة الطلاب المُسندين إليك من هذه المساحة."
        : "Bientôt disponible : le suivi des élèves qui vous sont assignés, directement depuis cet espace."}</p>
    </div>
  </div>;
}
