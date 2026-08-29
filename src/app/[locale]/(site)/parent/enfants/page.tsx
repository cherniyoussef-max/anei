import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent } from "@/server/queries/relationships";

export const dynamic = "force-dynamic";

export default async function ParentChildrenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const linkedStudents = await getLinkedStudentsForParent(session.user.id);

  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
      <h1>{ar ? "أبنائي" : "Mes enfants"}</h1>
      {linkedStudents.length === 0 ? (
        <p>{ar
          ? "لا يوجد أي متعلم مرتبط بحسابك حاليًا. لا يمكن ربط الأبناء إلا عبر فريق الأكاديمية."
          : "Aucun apprenant lié à votre compte. Le lien avec un enfant ne peut être établi que par l’équipe de l’Académie."}</p>
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
