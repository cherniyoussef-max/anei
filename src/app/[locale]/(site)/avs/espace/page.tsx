import { notFound } from "next/navigation";
import { Users, User, CalendarDays, IdCard } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getAssignedStudentsForAvs } from "@/server/queries/relationships";
import { getUpcomingAppointmentsForAssignee } from "@/server/queries/appointments";
import { getAvsProfileForUser } from "@/server/services/persona-profiles";
import { LearnerEmptyState } from "@/components/student/LearnerPages";
import { PersonaMetricCard, PersonaPanel, PersonaRow } from "@/modules/personas/components/PersonaPages";

export default async function AvsPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "AVS");

  const [assignedStudents, upcomingAppointments, profile] = await Promise.all([
    getAssignedStudentsForAvs(session.user.id),
    getUpcomingAppointmentsForAssignee(session.user.id),
    getAvsProfileForUser(session.user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">{ar ? "مساحة مرافق الحياة المدرسية" : "Espace AVS"}</span>
        <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[#082D55] sm:text-3xl">{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
        <p className="mt-1 text-sm text-[#7a7261]">{ar ? "نظرة عامة على المتعلمين الموكلين إليك ومواعيدك." : "Vue d'ensemble des apprenants qui vous sont attribués et de vos rendez-vous."}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PersonaMetricCard icon={Users} tone="navy" label={ar ? "المتعلمون المسندون" : "Apprenants attribués"} value={assignedStudents.length} />
        <PersonaMetricCard icon={CalendarDays} tone="gold" label={ar ? "المواعيد القادمة" : "Prochains rendez-vous"} value={upcomingAppointments.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PersonaPanel title={ar ? "المتعلمون المسندون" : "Apprenants attribués"}>
            {assignedStudents.length === 0 ? (
              <LearnerEmptyState icon={Users} title={ar ? "لا يوجد متعلم مسند بعد" : "Aucun apprenant attribué pour le moment"} body={ar ? "لا يوجد متعلم مسند إليك حاليًا." : "Aucun apprenant ne vous est encore attribué."} />
            ) : (
              <ul>
                {assignedStudents.map(({ assignment, student }) => (
                  <PersonaRow
                    key={assignment.id}
                    icon={User}
                    title={student.name}
                    meta={`${ar ? "مرافقة منذ" : "Accompagnement depuis"} ${new Date(assignment.startDate).toLocaleDateString(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium" })}`}
                  />
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

      {profile && (profile.qualification || profile.experienceYears != null || (profile.interventionDomains?.length ?? 0) > 0) && (
        <PersonaPanel title={ar ? "ملفي المهني" : "Profil professionnel"}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {profile.qualification && (
              <div className="flex items-start gap-3">
                <IdCard size={18} strokeWidth={1.75} className="mt-0.5 flex-none text-[#a9752f]" />
                <div><dt className="text-xs text-[#7a7261]">{ar ? "المؤهل" : "Qualification"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.qualification}</dd></div>
              </div>
            )}
            {profile.experienceYears != null && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "سنوات الخبرة" : "Expérience"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.experienceYears}</dd></div>
            )}
            {profile.interventionDomains && profile.interventionDomains.length > 0 && (
              <div><dt className="text-xs text-[#7a7261]">{ar ? "مجالات التدخل" : "Domaines d'accompagnement"}</dt><dd className="text-sm font-semibold text-[#082D55]">{profile.interventionDomains.join(", ")}</dd></div>
            )}
          </dl>
        </PersonaPanel>
      )}
    </div>
  );
}
