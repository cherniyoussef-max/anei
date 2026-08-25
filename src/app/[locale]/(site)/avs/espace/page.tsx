import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedStudentsForAvs } from "@/server/queries/relationships";

export default async function AvsPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "AVS");
  const assignedStudents = await getAssignedStudentsForAvs(session.user.id);
  return <div className="dashboard-heading dashboard-heading-human">
    <div className="dashboard-heading-copy">
      <span className="eyebrow">{ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"}</span>
      <h1>{ar ? "مرحبًا بك في مساحتك" : "Bienvenue dans votre espace"}</h1>
      {assignedStudents.length === 0 ? (
        <p>{ar
          ? "لا يوجد طلاب مرتبطون بك حاليًا. يمكنك تعديل ملفك في الدليل العام من الرابط المخصص."
          : "Aucun élève ne vous est encore assigné. Votre profil dans l’annuaire public reste modifiable depuis le lien dédié."}</p>
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
