import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent } from "@/server/queries/relationships";

export default async function ParentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const linkedStudents = await getLinkedStudentsForParent(session.user.id);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      {linkedStudents.length === 0 ? (
        <p>{ar
          ? "لا يوجد أبناء مرتبطون بحسابك حاليًا. تواصل مع فريق الأكاديمية لربط أبنائك."
          : "Aucun enfant n’est encore lié à votre compte. Contactez l’équipe de l’Académie pour lier vos enfants."}</p>
      ) : (
        <ul>
          {linkedStudents.map(({ link, student }) => (
            <li key={link.id}>{student.name} — {link.relationshipType}</li>
          ))}
        </ul>
      )}
    </div>
  </div>;
}
