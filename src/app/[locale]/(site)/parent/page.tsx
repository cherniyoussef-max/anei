import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, User, CalendarDays, Mail, ArrowRight } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import { getLinkedStudentsForParent, getLinkedStudentsProgressForParent } from "@/server/queries/relationships";
import { getNextAppointmentForStudent } from "@/server/queries/appointments";
import { LearnerEmptyState } from "@/components/student/LearnerPages";
import { PersonaMetricCard, PersonaPanel, PersonaRow } from "@/modules/personas/components/PersonaPages";

export default async function ParentPortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");
  const [linkedStudents, progressRows] = await Promise.all([
    getLinkedStudentsForParent(session.user.id),
    getLinkedStudentsProgressForParent(session.user.id),
  ]);

  // Group the bounded progress rows per child for display.
  const progressByStudent = new Map<string, { studentName: string; items: { title: string; progressPercent: number }[] }>();
  for (const row of progressRows) {
    const entry = progressByStudent.get(row.studentId) ?? { studentName: row.studentName, items: [] };
    if (!progressByStudent.has(row.studentId)) progressByStudent.set(row.studentId, entry);
    entry.items.push({ title: ar ? row.courseTitleAr : row.courseTitleFr, progressPercent: row.progressPercent });
  }

  // Each child's own CRM contact — never a client-supplied id — is already
  // authorized via getLinkedStudentsForParent's active-link scoping above.
  const nextSessions = await Promise.all(
    linkedStudents.map(({ student }) => getNextAppointmentForStudent(student.id)),
  );
  const nextSessionByStudent = new Map(linkedStudents.map(({ student }, index) => [student.id, nextSessions[index]]));

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-[#a9752f]">{ar ? "مساحة الوالدين" : "Espace parent"}</span>
        <h1 className="mt-1 font-[family-name:var(--font-fraunces)] text-2xl font-semibold tracking-tight text-[#082D55] sm:text-3xl">{ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}</h1>
        <p className="mt-1 text-sm text-[#7a7261]">{ar ? "تابع مسار أبنائك المرتبطين بحسابك." : "Suivez le parcours des enfants liés à votre compte."}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PersonaMetricCard icon={Users} tone="navy" label={ar ? "الأبناء المرتبطون" : "Enfants liés"} value={linkedStudents.length} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <PersonaPanel
            title={ar ? "أبنائي" : "Mes enfants"}
            action={linkedStudents.length > 0 ? (
              <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#082D55] hover:text-[#a9752f]" href={`/${locale}/parent/enfants`}>
                {ar ? "عرض التفاصيل" : "Voir le détail"}<ArrowRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />
              </Link>
            ) : undefined}
          >
            {linkedStudents.length === 0 ? (
              <LearnerEmptyState
                icon={Users}
                title={ar ? "لا يوجد طفل مرتبط بعد" : "Aucun enfant associé pour le moment"}
                body={ar
                  ? "لا يوجد بعد أي طفل مرتبط بحسابك. يمكنكم التواصل مع فريق الأكاديمية لربط أبنائكم بشكل آمن بعد التحقق."
                  : "Vous pourrez associer votre enfant depuis votre espace Parent après vérification par l'équipe ANEI — contactez l'Académie pour lancer cette démarche sécurisée."}
              />
            ) : (
              <ul>
                {linkedStudents.map(({ link, student }) => {
                  const progress = progressByStudent.get(student.id);
                  const nextSession = nextSessionByStudent.get(student.id);
                  return (
                    <PersonaRow
                      key={link.id}
                      icon={User}
                      title={student.name}
                      meta={
                        <div className="space-y-2">
                          <span>{ar ? "الصلة" : "Relation"} · {link.relationshipType}</span>
                          {progress && progress.items.length > 0 ? (
                            <div className="space-y-1">
                              {progress.items.map((item, index) => (
                                <div key={index} className="flex items-center justify-between gap-3">
                                  <span className="truncate">{item.title}</span>
                                  <span className="flex-none rounded-full bg-[#F6F1E7] px-2 py-0.5 text-[11px] font-bold text-[#a9752f]" dir="ltr">{item.progressPercent}%</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p>{ar ? "لا يوجد تسجيل في دورة بعد." : "Aucune inscription à un cours pour le moment."}</p>
                          )}
                          {nextSession ? (
                            <p className="flex items-center gap-1.5 text-[#082D55]">
                              <CalendarDays size={14} strokeWidth={1.75} />
                              {ar ? "الموعد القادم" : "Prochain rendez-vous"}
                              {" · "}
                              {new Date(nextSession.appointment.startAt).toLocaleString(ar ? "ar-TN" : "fr-TN", { dateStyle: "medium", timeStyle: "short" })}
                              {" · "}
                              {ar ? `مع ${nextSession.assigneeName}` : `avec ${nextSession.assigneeName}`}
                            </p>
                          ) : null}
                        </div>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </PersonaPanel>
        </div>

        <div className="lg:col-span-5">
          <PersonaPanel title={ar ? "بحاجة إلى مساعدة؟" : "Besoin d'aide ?"}>
            <p className="text-sm text-[#7a7261]">
              {ar
                ? "لفريق المتابعة في ANEI للأسئلة المتعلقة بحساب طفلك أو ربط طفل إضافي."
                : "L'équipe ANEI reste disponible pour toute question sur le compte de votre enfant ou pour associer un enfant supplémentaire."}
            </p>
            <Link className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#082D55] px-5 py-2.5 text-sm font-semibold text-[#082D55] transition-all duration-200 ease-in-out hover:bg-[#082D55] hover:text-white" href={`/${locale}/contact`}>
              <Mail size={16} strokeWidth={1.75} />{ar ? "التواصل مع الفريق" : "Contacter l'équipe"}
            </Link>
          </PersonaPanel>
        </div>
      </div>
    </div>
  );
}
