import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedStudentsForSpecialist } from "@/server/queries/relationships";

export default async function SpecialistPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "SPECIALIST");
  const assignedStudents = await getAssignedStudentsForSpecialist(session.user.id);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة الأخصائي" : "Espace spécialiste"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      {assignedStudents.length === 0 ? (
        <p>{ar
          ? "لا يوجد أشخاص مرتبطون بك حاليًا."
          : "Aucune personne ne vous est encore liée."}</p>
      ) : (
        <ul>
          {assignedStudents.map(({ assignment, student }) => (
            <li key={assignment.id}>{student.name}</li>
          ))}
        </ul>
      )}
    </div>
  </div>;
}
