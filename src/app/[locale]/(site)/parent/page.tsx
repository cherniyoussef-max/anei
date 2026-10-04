import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Users,
  User,
  CalendarDays,
  Mail,
  ArrowRight,
  Target,
  GraduationCap,
  BookOpen,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { isLocale, formatMillimes } from "@/lib/i18n";
import { requireActivePersona } from "@/server/auth/session";
import {
  getLinkedStudentsForParent,
  getLinkedStudentsProgressForParent,
} from "@/server/queries/relationships";
import { getNextAppointmentForStudent } from "@/server/queries/appointments";
import {
  getLearnerCoursesPage,
  getLearnerResourcesPage,
} from "@/server/queries/account";
import {
  searchPublishedCourses,
  searchPublishedResources,
} from "@/server/queries/catalog";
import { PersonaMetricCard, PersonaPanel } from "@/modules/personas/components/PersonaPages";
import { AddChildButton } from "@/components/parent/AddChildButton";
import { UnlinkChildButton } from "@/components/parent/UnlinkChildButton";

export const dynamic = "force-dynamic";

export default async function ParentPortalPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const session = await requireActivePersona(locale, "PARENT");

  // Parallel data fetching for parent dashboard
  const [
    linkedStudents,
    progressRows,
    enrolledCourses,
    purchasedResources,
    featuredCoursesData,
    featuredResourcesData,
  ] = await Promise.all([
    getLinkedStudentsForParent(session.user.id),
    getLinkedStudentsProgressForParent(session.user.id),
    getLearnerCoursesPage(session.user.id),
    getLearnerResourcesPage(session.user.id),
    searchPublishedCourses({ pageSize: 3, sort: "newest" }),
    searchPublishedResources({ pageSize: 3, sort: "newest" }),
  ]);

  // Group child progress rows
  const progressByStudent = new Map<
    string,
    { studentName: string; items: { title: string; progressPercent: number }[] }
  >();
  for (const row of progressRows) {
    const entry = progressByStudent.get(row.studentId) ?? {
      studentName: row.studentName,
      items: [],
    };
    if (!progressByStudent.has(row.studentId)) {
      progressByStudent.set(row.studentId, entry);
    }
    entry.items.push({
      title: ar ? row.courseTitleAr : row.courseTitleFr,
      progressPercent: row.progressPercent,
    });
  }

  // Next appointments for each linked child
  const nextSessions = await Promise.all(
    linkedStudents.map(({ student }) => getNextAppointmentForStudent(student.id))
  );
  const nextSessionByStudent = new Map(
    linkedStudents.map(({ student }, index) => [student.id, nextSessions[index]])
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0056D2]">
            {ar ? "مساحة الوالدين · لوحة القيادة" : "Espace Famille · Vue d'ensemble"}
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            {ar ? `مرحبًا، ${session.user.name}` : `Bonjour, ${session.user.name}`}
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {ar
              ? "تابع مسار أبنائك المرتبطين بحسابك، ملفاتهم التربوية (PPS)، وتكويناتك ومواردك التربوية."
              : "Suivez le parcours de vos enfants, leurs dossiers PPS, vos formations et vos ressources pratiques."}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AddChildButton
            locale={locale}
            label={ar ? "+ إضافة طفل" : "+ Ajouter un enfant"}
          />
        </div>
      </div>

      {/* 4-Bento Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PersonaMetricCard
          icon={Users}
          label={ar ? "الأبناء المرتبطون" : "Enfants liés"}
          value={linkedStudents.length}
        />
        <PersonaMetricCard
          icon={Target}
          label={ar ? "الخطط التربوية (PPS)" : "Dossiers PPS actifs"}
          value={linkedStudents.length}
        />
        <PersonaMetricCard
          icon={GraduationCap}
          label={ar ? "دوراتي المسجلة" : "Formations inscrites"}
          value={enrolledCourses.length}
        />
        <PersonaMetricCard
          icon={BookOpen}
          label={ar ? "الموارد والأدلة المقتناة" : "Ressources débloquées"}
          value={purchasedResources.length}
        />
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Mes Enfants */}
          <PersonaPanel
            title={ar ? "أبنائي ومسار المتابعة" : "Mes enfants & suivi"}
            action={
              linkedStudents.length > 0 ? (
                <Link
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0056D2] hover:underline"
                  href={`/${locale}/parent/enfants`}
                >
                  {ar ? "عرض التفاصيل الكاملة" : "Voir tous les dossiers"}
                  <ArrowRight size={13} className="rtl:rotate-180" />
                </Link>
              ) : undefined
            }
          >
            {linkedStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F6FF] text-[#0056D2]">
                  <Users size={24} />
                </div>
                <h3 className="mt-3 text-base font-semibold text-[#0F172A]">
                  {ar ? "لا يوجد طفل مرتبط بحسابك حالياً" : "Aucun enfant associé à votre compte"}
                </h3>
                <p className="mt-1 text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                  {ar
                    ? "أضف ملف طفلك الآن لتفعيل ملفه التربوي الفردي (PPS)، متابعة حصص الدعم، والتواصل مع المختصين."
                    : "Associez dès maintenant le profil de votre enfant pour activer son Projet Personnalisé de Scolarisation (PPS) et coordonner son équipe pluridisciplinaire."}
                </p>
                <div className="mt-5 flex justify-center">
                  <AddChildButton
                    locale={locale}
                    label={ar ? "+ إضافة طفلي الأول الآن" : "+ Associer mon premier enfant"}
                  />
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {linkedStudents.map(({ link, student }) => {
                  const progress = progressByStudent.get(student.id);
                  const nextSession = nextSessionByStudent.get(student.id);
                  return (
                    <li
                      key={link.id}
                      className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs hover:border-[#0056D2]/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-[#F0F6FF] text-[#0056D2] font-semibold text-sm">
                            <User size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-sm text-[#0F172A]">
                                {student.name}
                              </h4>
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-[#0056D2]">
                                {link.relationshipType}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                <CheckCircle2 size={10} />
                                {ar ? "PPS نشط" : "PPS Actif"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[#64748B]">
                              {student.email}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <Link
                            href={`/${locale}/parent/enfants`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
                          >
                            <Target size={13} />
                            <span>{ar ? "ملف PPS والمتابعة" : "Dossier PPS"}</span>
                          </Link>
                          <UnlinkChildButton
                            linkId={link.id}
                            childName={student.name}
                            locale={locale}
                          />
                        </div>
                      </div>

                      {/* Progress / Next session details */}
                      <div className="mt-3.5 border-t border-[#E2E8F0] pt-3 text-xs text-[#64748B] space-y-1.5">
                        {nextSession ? (
                          <div className="flex items-center gap-1.5 text-[#0F172A] font-medium">
                            <CalendarDays size={14} className="text-[#0056D2]" />
                            <span>{ar ? "الموعد القادم:" : "Prochaine séance :"}</span>
                            <span>
                              {new Date(nextSession.appointment.startAt).toLocaleString(
                                ar ? "ar-TN" : "fr-TN",
                                { dateStyle: "medium", timeStyle: "short" }
                              )}
                            </span>
                            <span>· {ar ? `مع ${nextSession.assigneeName}` : `avec ${nextSession.assigneeName}`}</span>
                          </div>
                        ) : null}

                        {progress && progress.items.length > 0 ? (
                          <div className="space-y-1.5 pt-1">
                            {progress.items.slice(0, 2).map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="truncate max-w-[80%] text-[#334155]">{item.title}</span>
                                <span className="font-semibold text-[#0056D2]" dir="ltr">
                                  {item.progressPercent}%
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </PersonaPanel>

          {/* Section 2: Formations Recommandées pour les Parents */}
          <PersonaPanel
            title={ar ? "دورات وورشات موجهة للأولياء" : "Formations & Ateliers pour parents"}
            action={
              <Link
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline"
                href={`/${locale}/parent/formations`}
              >
                {ar ? "عرض جميع الدورات" : "Voir tout le catalogue"}
                <ArrowRight size={13} className="rtl:rotate-180" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {featuredCoursesData.items.map((c) => {
                const isEnrolled = enrolledCourses.some((e) => e.course.id === c.id);
                return (
                  <div
                    key={c.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs hover:border-[#0056D2]/40 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1.5 font-semibold">
                        <span className="text-[#0056D2]">{c.category}</span>
                        {isEnrolled ? (
                          <span className="text-emerald-700">{ar ? "مسجل" : "Inscrit"}</span>
                        ) : (
                          <span className="text-[#0F172A]">{formatMillimes(c.priceMillimes, locale)}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-xs text-[#0F172A] line-clamp-2 leading-snug">
                        {ar ? c.titleAr : c.titleFr}
                      </h4>
                      <p className="mt-1 text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                        {ar ? c.summaryAr : c.summaryFr}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between">
                      {c.durationMinutes && (
                        <span className="flex items-center gap-1 text-[10px] text-[#64748B]">
                          <Clock size={11} className="text-[#0056D2]" />
                          <span>{Math.round(c.durationMinutes / 60)}h</span>
                        </span>
                      )}
                      <Link
                        href={`/${locale}/parent/formations`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0056D2] hover:underline"
                      >
                        <span>{isEnrolled ? (ar ? "متابعة" : "Continuer") : (ar ? "تفاصيل" : "Découvrir")}</span>
                        <ArrowRight size={11} className="rtl:rotate-180" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </PersonaPanel>

          {/* Section 3: Bibliothèque & Outils */}
          <PersonaPanel
            title={ar ? "المكتبة التربوية وأدوات المرافقة" : "Bibliothèque & Guides pratiques"}
            action={
              <Link
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline"
                href={`/${locale}/parent/bibliotheque`}
              >
                {ar ? "استكشاف المكتبة" : "Accéder à la bibliothèque"}
                <ArrowRight size={13} className="rtl:rotate-180" />
              </Link>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {featuredResourcesData.items.map((r) => {
                const isOwned = purchasedResources.some((p) => p.resource.id === r.id);
                return (
                  <div
                    key={r.id}
                    className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs hover:border-[#0056D2]/40 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1.5 font-semibold">
                        <span className="text-[#0056D2]">{r.type}</span>
                        {isOwned ? (
                          <span className="text-emerald-700">{ar ? "متاح للتحميل" : "Débloqué"}</span>
                        ) : (
                          <span className="text-[#0F172A]">{formatMillimes(r.priceMillimes, locale)}</span>
                        )}
                      </div>
                      <h4 className="font-semibold text-xs text-[#0F172A] line-clamp-2 leading-snug">
                        {ar ? r.titleAr : r.titleFr}
                      </h4>
                      <p className="mt-1 text-[11px] text-[#64748B] line-clamp-2 leading-relaxed">
                        {ar ? r.descriptionAr : r.descriptionFr}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex items-center justify-between">
                      <span className="text-[10px] text-[#64748B]">
                        {r.audienceAr && ar ? r.audienceAr : r.audienceFr}
                      </span>
                      {isOwned ? (
                        <a
                          href={`/api/resources/${r.id}/download`}
                          download
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                        >
                          <Download size={11} />
                          <span>{ar ? "تحميل" : "Télécharger"}</span>
                        </a>
                      ) : (
                        <Link
                          href={`/${locale}/parent/bibliotheque`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0056D2] hover:underline"
                        >
                          <span>{ar ? "اقتناء" : "Acheter"}</span>
                          <ArrowRight size={11} className="rtl:rotate-180" />
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </PersonaPanel>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Panel: Accompagnement & Spécialistes */}
          <PersonaPanel
            title={ar ? "فريق المتابعة والتأهيل" : "Accompagnement & spécialistes"}
            action={
              <Link
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056D2] hover:underline"
                href={`/${locale}/parent/specialistes`}
              >
                {ar ? "الدليل" : "Annuaire"}
                <ArrowRight size={12} className="rtl:rotate-180" />
              </Link>
            }
          >
            <p className="text-xs text-[#64748B] leading-relaxed">
              {ar
                ? "تواصل مع أخصائيي النطق، العلاج الحركي، ومرافقي الدمج المدرسي (AVS) المعتمدين لمتابعة تطور طفلك."
                : "Consultez l'annuaire des professionnels certifiés ANEI, échangez via la messagerie sécurisée et suivez les séances."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/${locale}/parent/specialistes`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0056D2] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#00419E] transition shadow-xs"
              >
                <span>{ar ? "البحث عن مختص" : "Trouver un spécialiste"}</span>
              </Link>
              <Link
                href={`/${locale}/parent/messages`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] transition"
              >
                <span>{ar ? "الرسائل" : "Messagerie"}</span>
              </Link>
            </div>
          </PersonaPanel>

          {/* Panel: Engagement Qualité & Droits */}
          <PersonaPanel title={ar ? "ميثاق الجودة والمتابعة" : "Garantie & accompagnement"}>
            <div className="space-y-3 text-xs text-[#64748B]">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-[#0056D2] flex-none mt-0.5" />
                <p>
                  {ar
                    ? "بيانات طفلك وملاحظات الحصص محمية بالكامل وتخضع للسرية المهنية."
                    : "Les données de votre enfant et les comptes-rendus sont strictement protégés et confidentiels."}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Target size={16} className="text-[#0056D2] flex-none mt-0.5" />
                <p>
                  {ar
                    ? "الخطة التربوية الفردية تتوافق مع المعايير الدولية GEVA-Sco والتكيفات المدرسية."
                    : "Le projet personnalisé s'appuie sur le référentiel GEVA-Sco et les adaptations scolaires reconnues."}
                </p>
              </div>
            </div>
          </PersonaPanel>

          {/* Panel: Contact Support */}
          <PersonaPanel title={ar ? "بحاجة إلى مساعدة؟" : "Besoin d'aide ?"}>
            <p className="text-xs text-[#64748B] leading-relaxed">
              {ar
                ? "فريق أكاديمية أني مستعد للإجابة عن أسئلتكم ومساعدتكم في كل خطوة لدعم طفلكم."
                : "L'équipe ANEI reste disponible pour vous accompagner dans la constitution du dossier ou le choix des spécialistes."}
            </p>
            <Link
              className="mt-3.5 inline-flex items-center gap-2 rounded-lg border border-[#0056D2] px-3.5 py-2 text-xs font-semibold text-[#0056D2] transition hover:bg-[#0056D2] hover:text-white"
              href={`/${locale}/contact`}
            >
              <Mail size={14} />
              <span>{ar ? "التواصل مع الفريق" : "Contacter l'équipe"}</span>
            </Link>
          </PersonaPanel>
        </div>
      </div>
    </div>
  );
}
