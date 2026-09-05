import { notFound } from "next/navigation";
import { BookOpen, Users, GraduationCap, CalendarDays, IdCard } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedCoursesForTeacher, getAssignedLearnerCountForTeacher, getCohortCountForTeacher } from "@/server/queries/teacher-assignments";
import { getUpcomingAppointmentsForAssignee } from "@/server/queries/appointments";
import { getTeacherProfileForUser } from "@/server/services/persona-profiles";
import { LearnerEmptyState } from "@/components/student/LearnerPages";
import { PersonaMetricCard, PersonaPanel, PersonaRow } from "@/modules/personas/components/PersonaPages";

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
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">{ar ? "مساحة المكوّن" : "Espace formateur"}</span>
        <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[#082D55] sm:text-3xl">{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
        <p className="mt-1 text-sm text-[#7a7261]">{ar ? "نظرة عامة على دوراتك والمتعلمين الموكلين إليك." : "Vue d'ensemble de vos cours attribués et des apprenants dans votre périmètre."}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PersonaMetricCard icon={BookOpen} tone="navy" label={ar ? "الدورات المسندة" : "Cours attribués"} value={assignedCourses.length} />
        <PersonaMetricCard icon={Users} tone="gold" label={ar ? "المجموعات" : "Cohortes"} value={cohortCount} />
        <PersonaMetricCard icon={GraduationCap} tone="cream" label={ar ? "المتعلمون المصرَّح بهم" : "Apprenants autorisés"} value={learnerCount} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PersonaPanel title={ar ? "دوراتي" : "Mes cours"}>
            {assignedCourses.length === 0 ? (
              <LearnerEmptyState
                icon={BookOpen}
                title={ar ? "لا توجد دورة مسندة بعد" : "Aucun cours attribué pour le moment"}
                body={ar
                  ? "لا توجد دورة مسندة إليك بعد. ستظهر دوراتك ومجموعاتك هنا فور إسناد تكليف لك."
                  : "Vos cours et groupes apparaîtront ici dès qu'une affectation sera effectuée."}
              />
            ) : (
              <ul>
                {assignedCourses.map(({ assignment, course }) => (
                  <PersonaRow key={assignment.id} icon={BookOpen} title={ar ? course.titleAr : course.titleFr} />
                ))}
              </ul>
            )}
          </PersonaPanel>
        </div>

        <div className="lg:col-span-5">
          <PersonaPanel title={ar ? "المواعيد القادمة" : "Prochains rendez-vous"}>
            {upcomingAppointments.length === 0 ? (
              <LearnerEmptyState icon={CalendarDays} title={ar ? "لا يوجد موعد قريب" : "Aucun rendez-vous à venir"} body={ar ? "لا توجد مواعيد قادمة." : "Vos prochains rendez-vous apparaîtront ici."} />
            ) : (
              <ul>
                {upcomingAppointments.map(({ appointment, contact }) => (
                  <PersonaRow
                    key={appointment.id}
                    icon={CalendarDays}
                    title={`${contact.firstName} ${contact.lastName}`}
                    meta={new Date(appointment.startAt).toLocaleString(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium", timeStyle: "short" })}
                  />
                ))}
              </ul>
            )}
          </PersonaPanel>
        </div>
      </div>

      {profile && (profile.discipline || profile.qualification || profile.experienceYears != null || profile.professionalInstitution || (profile.levelsTaught?.length ?? 0) > 0) && (
        <PersonaPanel title={ar ? "ملفي المهني" : "Profil professionnel"}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {profile.discipline && (
              <div className="flex items-start gap-3">
                <IdCard size={18} strokeWidth={1.75} className="mt-0.5 flex-none text-[#a9752f]" />
                <div><dt className="text-xs text-[#7a7261]">{ar ? "التخصص" : "Discipline"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.discipline}</dd></div>
              </div>
            )}
            {profile.qualification && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "المؤهل" : "Qualification"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.qualification}</dd></div>
            )}
            {profile.experienceYears != null && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.experienceYears}</dd></div>
            )}
            {profile.levelsTaught && profile.levelsTaught.length > 0 && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "المستويات المُدرَّسة" : "Niveaux enseignés"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.levelsTaught.join(", ")}</dd></div>
            )}
            {profile.professionalInstitution && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "المؤسسة أو الهيئة الموظِّفة" : "Établissement / Employeur"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.professionalInstitution}</dd></div>
            )}
          </dl>
        </PersonaPanel>
      )}
    </div>
  );
}
