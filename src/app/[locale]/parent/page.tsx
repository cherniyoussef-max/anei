import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";

export default async function ParentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  await requireActivePersona(locale, "PARENT");
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      <p>{ar
        ? "قريبًا: متابعة أبنائك المرتبطين بحسابك من هذه المساحة."
        : "Bientôt disponible : le suivi de vos enfants liés à votre compte, directement depuis cet espace."}</p>
    </div>
  </div>;
}
