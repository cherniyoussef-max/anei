import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedStudentsForSpecialist } from "@/server/queries/relationships";
import { getUpcomingAppointmentsForAssignee } from "@/server/queries/appointments";
import { getSpecialistProfileForUser } from "@/server/services/persona-profiles";
import { Icon } from "@/components/ui/Icon";

export default async function SpecialistPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "SPECIALIST");

  const [assignedStudents, upcomingAppointments, profile] = await Promise.all([
    getAssignedStudentsForSpecialist(session.user.id),
    getUpcomingAppointmentsForAssignee(session.user.id),
    getSpecialistProfileForUser(session.user.id),
  ]);

  return (
    <>
      <div className="dashboard-heading dashboard-heading-human">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">{ar ? "مساحة الأخصائي" : "Espace spécialiste"}</span>
          <h1>{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
          <p>{ar ? "نظرة عامة على المتابَعين والمواعيد القادمة." : "Vue d'ensemble des apprenants suivis et de vos prochains rendez-vous."}</p>
        </div>
      </div>

      <div className="dashboard-kpis">
        <div>
          <div className="kpi-icon"><Icon name="users" size={18} /></div>
          <div><strong>{assignedStudents.length}</strong><small>{ar ? "المتعلمون المسندون" : "Apprenants attribués"}</small></div>
        </div>
        <div>
          <div className="kpi-icon"><Icon name="calendar" size={18} /></div>
          <div><strong>{upcomingAppointments.length}</strong><small>{ar ? "المواعيد القادمة" : "Prochains rendez-vous"}</small></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel wide">
          <div className="panel-head">
            <h2>{ar ? "المتعلمون المسندون" : "Apprenants attribués"}</h2>
          </div>
          {assignedStudents.length === 0 ? (
            <p className="dashboard-empty-copy">{ar ? "لا يوجد متعلم مسند إليك حاليًا." : "Aucun apprenant ne vous est encore attribué."}</p>
          ) : (
            <ul className="learning-list">
              {assignedStudents.map(({ assignment, student }) => (
                <li key={assignment.id} className="learning-row">
                  <div className="learning-icon"><Icon name="user" size={18} /></div>
                  <div className="learning-main">
                    <strong>{student.name}</strong>
                    <small>
                      {ar ? "متابعة منذ" : "Suivi depuis"}{" "}
                      {new Date(assignment.startDate).toLocaleDateString(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium" })}
                    </small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-panel">
          <div className="panel-head">
            <h2>{ar ? "المواعيد القادمة" : "Prochains rendez-vous"}</h2>
          </div>
          {upcomingAppointments.length === 0 ? (
            <p className="dashboard-empty-copy">{ar ? "لا توجد مواعيد قادمة." : "Aucun rendez-vous à venir."}</p>
          ) : (
            <ul className="learning-list">
              {upcomingAppointments.map(({ appointment, contact }) => (
                <li key={appointment.id} className="dashboard-event">
                  <div className="date-dot"><Icon name="calendar" size={16} /></div>
                  <div>
                    <strong>{contact.firstName} {contact.lastName}</strong>
                    <small>{new Date(appointment.startAt).toLocaleString(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium", timeStyle: "short" })}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {profile && (profile.specialty || profile.qualification || profile.experienceYears != null || profile.practiceStructure) && (
          <div className="dashboard-panel wide">
            <div className="panel-head">
              <h2>{ar ? "ممارستي المهنية" : "Ma pratique professionnelle"}</h2>
            </div>
            <dl className="wizard-summary">
              {profile.specialty && (
                <div className="wizard-summary-row"><dt>{ar ? "التخصص الدقيق" : "Spécialité"}</dt><dd>{profile.specialty}</dd></div>
              )}
              {profile.qualification && (
                <div className="wizard-summary-row"><dt>{ar ? "المؤهل" : "Qualification"}</dt><dd>{profile.qualification}</dd></div>
              )}
              {profile.experienceYears != null && (
                <div className="wizard-summary-row"><dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd>{profile.experienceYears}</dd></div>
              )}
              {profile.practiceStructure && (
                <div className="wizard-summary-row"><dt>{ar ? "إطار الممارسة" : "Structure d'exercice"}</dt><dd>{profile.practiceStructure}</dd></div>
              )}
              {profile.interventionDomains && profile.interventionDomains.length > 0 && (
                <div className="wizard-summary-row"><dt>{ar ? "مجالات التدخل" : "Domaines d'intervention"}</dt><dd>{profile.interventionDomains.join(", ")}</dd></div>
              )}
            </dl>
          </div>
        )}
      </div>
    </>
  );
}
