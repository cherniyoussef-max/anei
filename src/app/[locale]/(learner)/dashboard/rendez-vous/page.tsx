import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerAppointments } from "@/server/queries/account";
import { AppointmentCalendar } from "@/components/student/AppointmentCalendar";
import { AppointmentActions, AppointmentBooking } from "@/components/student/AppointmentBooking";
import { getLearnerAvailability } from "@/server/services/learner-appointments";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";

const AppointmentCancelButton = AppointmentActions;

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, { en: string; fr: string; ar: string }> = {
  ASSESSMENT: { en: "Assessment", fr: "Évaluation", ar: "تقييم" }, INFO_MEETING: { en: "Information meeting", fr: "Réunion d’information", ar: "لقاء معلومات" }, FOLLOW_UP: { en: "Follow-up", fr: "Suivi", ar: "متابعة" }, OTHER: { en: "Appointment", fr: "Rendez-vous", ar: "موعد" },
};
const STATUS_LABELS: Record<string, { en: string; fr: string; ar: string }> = {
  SCHEDULED: { en: "Scheduled", fr: "Planifié", ar: "مبرمج" }, CONFIRMED: { en: "Confirmed", fr: "Confirmé", ar: "مؤكد" }, COMPLETED: { en: "Completed", fr: "Terminé", ar: "مكتمل" }, CANCELLED: { en: "Cancelled", fr: "Annulé", ar: "ملغى" }, NO_SHOW: { en: "No show", fr: "Absent", ar: "غياب" },
};

export default async function LearnerAppointmentsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ vue?: string; replanifier?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const query = await searchParams;
  const history = query.vue === "historique";
  const from = new Date();
  const to = new Date(from.getTime() + 42 * 86_400_000);
  const [upcoming, rows, slots] = await Promise.all([getLearnerAppointments(session.user.id, false, 12), getLearnerAppointments(session.user.id, history, 20), history ? Promise.resolve([]) : getLearnerAvailability(session.user.id, from, to)]);
  const formatter = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Tunis" });

  return <div className="learner-page"><LearnerPageHeader title={ar ? "مواعيدي" : "Mes rendez-vous"} description={ar ? "راجع جلساتك ومواعيد المتابعة المرتبطة بملفك." : "Consultez vos sessions et rendez-vous de suivi liés à votre profil."} />
    <nav className="learner-tabs" aria-label={ar ? "عرض المواعيد" : "Afficher les rendez-vous"}><Link className={!history ? "is-active" : undefined} aria-current={!history ? "page" : undefined} href={`/${locale}/dashboard/rendez-vous`}>{ar ? "القادمة" : "À venir"}</Link><Link className={history ? "is-active" : undefined} aria-current={history ? "page" : undefined} href={`/${locale}/dashboard/rendez-vous?vue=historique`}>{ar ? "السجل" : "Historique"}</Link></nav>
    {!history ? <><AppointmentCalendar locale={locale} appointments={upcoming} /><AppointmentBooking locale={locale} slots={slots} rescheduleId={query.replanifier} /></> : null}
    <section className="learner-appointment-list" aria-labelledby="appointment-list-title"><h2 id="appointment-list-title">{history ? (ar ? "المواعيد السابقة" : "Rendez-vous passés") : (ar ? "المواعيد القادمة" : "Prochains rendez-vous")}</h2>{rows.length ? <div>{rows.map((row) => <article key={row.id}><span className="learner-appointment-date" aria-hidden="true"><CalendarDays size={21} strokeWidth={1.75} /></span><div><div className="learner-object-meta"><span>{TYPE_LABELS[row.type]?.[locale] ?? row.type}</span><span>{STATUS_LABELS[row.status]?.[locale] ?? row.status}</span></div><h3>{formatter.format(row.startAt)}</h3><p>{ar ? "مع" : "Avec"} {row.assignedToName}</p><small dir="ltr">Africa/Tunis · {Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60000)} min</small>{!history && row.meetingUrl && ["SCHEDULED", "CONFIRMED"].includes(row.status) ? <div className="appointment-confirmed-links"><a href={row.meetingUrl} target="_blank" rel="noreferrer" className="student-secondary-action">{ar ? "رابط الاجتماع" : "Lien de la réunion"}</a><a href={`https://calendar.google.com/calendar/render?${new URLSearchParams({ action: "TEMPLATE", text: ar ? "موعد ANEI" : "Rendez-vous ANEI", dates: `${row.startAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/${row.endAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`, details: row.meetingUrl }).toString()}`} target="_blank" rel="noreferrer" className="student-secondary-action">{ar ? "إضافة إلى تقويم Google" : "Ajouter à Google Agenda"}</a></div> : null}{!history && ["SCHEDULED", "CONFIRMED"].includes(row.status) ? <AppointmentCancelButton locale={locale} id={row.id} /> : null}</div></article>)}</div> : <LearnerEmptyState icon={CalendarDays} title={history ? (ar ? "لا يوجد سجل مواعيد" : "Aucun rendez-vous dans l’historique") : (ar ? "لا يوجد موعد قادم" : "Aucun rendez-vous à venir")} body={ar ? "ستظهر هنا المواعيد التي تحجزها أو ينشئها فريق المتابعة لملفك." : "Les rendez-vous réservés ici ou créés par l’équipe de suivi apparaîtront dans cette liste."} />}</section>
  </div>;
}
