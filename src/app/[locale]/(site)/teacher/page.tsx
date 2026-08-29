import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedCoursesForTeacher, getAssignedLearnerCountForTeacher, getCohortCountForTeacher } from "@/server/queries/teacher-assignments";
import { getUpcomingAppointmentsForAssignee } from "@/server/queries/appointments";
import { getTeacherProfileForUser } from "@/server/services/persona-profiles";
import { Icon } from "@/components/ui/Icon";

export default async function TeacherPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "TEACHER");

  const [assignedCourses, learnerCount, cohortCount, upcomingAppointments, profile] = await Promise.all([
    getAssignedCoursesForTeacher(session.user.id),
    getAssignedLearnerCountForTeacher(session.user.id),
    getCohortCountForTeacher(session.user.id),
    getUpcomingAppointmentsForAssignee(session.user.id),
    getTeacherProfileForUser(session.user.id),
  ]);

  return (
    <>
      <div className="dashboard-heading dashboard-heading-human">
        <div className="dashboard-heading-copy">
          <span className="eyebrow">{ar ? "مساحة المكوّن" : "Espace formateur"}</span>
          <h1>{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
          <p>{ar ? "نظرة عامة على دوراتك والمتعلمين الموكلين إليك." : "Vue d'ensemble de vos cours attribués et des apprenants dans votre périmètre."}</p>
        </div>
      </div>

      <div className="dashboard-kpis">
        <div>
          <div className="kpi-icon"><Icon name="book" size={18} /></div>
          <div><strong>{assignedCourses.length}</strong><small>{ar ? "الدورات المسندة" : "Cours attribués"}</small></div>
        </div>
        <div>
          <div className="kpi-icon"><Icon name="users" size={18} /></div>
          <div><strong>{cohortCount}</strong><small>{ar ? "المجموعات" : "Cohortes"}</small></div>
        </div>
        <div>
          <div className="kpi-icon"><Icon name="graduation" size={18} /></div>
          <div><strong>{learnerCount}</strong><small>{ar ? "المتعلمون المصرَّح بهم" : "Apprenants autorisés"}</small></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-panel wide">
          <div className="panel-head">
            <h2>{ar ? "دوراتي" : "Mes cours"}</h2>
          </div>
          {assignedCourses.length === 0 ? (
            <p className="dashboard-empty-copy">
              {ar
                ? "لا توجد دورة مسندة إليك بعد. ستظهر دوراتك ومجموعاتك هنا فور إسناد تكليف لك."
                : "Aucun cours ne vous est encore attribué. Vos cours et groupes apparaîtront ici dès qu'une affectation sera effectuée."}
            </p>
          ) : (
            <ul className="learning-list">
              {assignedCourses.map(({ assignment, course }) => (
                <li key={assignment.id} className="learning-row">
                  <div className="learning-icon"><Icon name="book" size={18} /></div>
                  <div className="learning-main">
                    <strong>{ar ? course.titleAr : course.titleFr}</strong>
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
      </div>

      {profile && (profile.discipline || profile.qualification || profile.experienceYears != null || profile.professionalInstitution || (profile.levelsTaught?.length ?? 0) > 0) && (
        <div className="dashboard-panel wide">
          <div className="panel-head">
            <h2>{ar ? "ملفي المهني" : "Profil professionnel"}</h2>
          </div>
          <dl className="wizard-summary">
            {profile.discipline && (
              <div className="wizard-summary-row"><dt>{ar ? "التخصص" : "Discipline"}</dt><dd>{profile.discipline}</dd></div>
            )}
            {profile.qualification && (
              <div className="wizard-summary-row"><dt>{ar ? "المؤهل" : "Qualification"}</dt><dd>{profile.qualification}</dd></div>
            )}
            {profile.experienceYears != null && (
              <div className="wizard-summary-row"><dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd>{profile.experienceYears}</dd></div>
            )}
            {profile.levelsTaught && profile.levelsTaught.length > 0 && (
              <div className="wizard-summary-row"><dt>{ar ? "المستويات المُدرَّسة" : "Niveaux enseignés"}</dt><dd>{profile.levelsTaught.join(", ")}</dd></div>
            )}
            {profile.professionalInstitution && (
              <div className="wizard-summary-row"><dt>{ar ? "المؤسسة أو الهيئة الموظِّفة" : "Établissement / Employeur"}</dt><dd>{profile.professionalInstitution}</dd></div>
            )}
          </dl>
        </div>
      )}
    </>
  );
}
