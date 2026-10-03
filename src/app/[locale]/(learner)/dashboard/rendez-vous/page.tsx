import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getLearnerAppointments, getLearnerAvsBookings } from "@/server/queries/account";
import { AppointmentCalendar } from "@/components/student/AppointmentCalendar";
import { AppointmentActions, AppointmentBooking } from "@/components/student/AppointmentBooking";
import { getLearnerAvailability } from "@/server/services/learner-appointments";
import { LearnerEmptyState, LearnerPageHeader } from "@/components/student/LearnerPages";
import { LearnerAvsBookingsSection } from "@/components/student/LearnerAvsBookingsSection";

const AppointmentCancelButton = AppointmentActions;

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, { en: string; fr: string; ar: string }> = {
  ASSESSMENT: { en: "Assessment", fr: "Évaluation", ar: "تقييم" },
  INFO_MEETING: { en: "Information meeting", fr: "Réunion d’information", ar: "لقاء معلومات" },
  FOLLOW_UP: { en: "Follow-up", fr: "Suivi", ar: "متابعة" },
  OTHER: { en: "Appointment", fr: "Rendez-vous", ar: "موعد" },
};
const STATUS_LABELS: Record<string, { en: string; fr: string; ar: string }> = {
  SCHEDULED: { en: "Scheduled", fr: "Planifié", ar: "مبرمج" },
  CONFIRMED: { en: "Confirmed", fr: "Confirmé", ar: "مؤكد" },
  COMPLETED: { en: "Completed", fr: "Terminé", ar: "مكتمل" },
  CANCELLED: { en: "Cancelled", fr: "Annulé", ar: "ملغى" },
  NO_SHOW: { en: "No show", fr: "Absent", ar: "غياب" },
};

export default async function LearnerAppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ vue?: string; replanifier?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const query = await searchParams;
  const history = query.vue === "historique";
  const from = new Date();
  const to = new Date(from.getTime() + 42 * 86_400_000);

  const [upcoming, rows, slots, avsBookings] = await Promise.all([
    getLearnerAppointments(session.user.id, false, 12),
    getLearnerAppointments(session.user.id, history, 20),
    history ? Promise.resolve([]) : getLearnerAvailability(session.user.id, from, to),
    getLearnerAvsBookings(session.user.id, session.user.email),
  ]);

  const formatter = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Tunis",
  });

  return (
    <div className="learner-page space-y-10" dir={ar ? "rtl" : "ltr"}>
      <LearnerPageHeader
        title={ar ? "مواعيدي وحجوزاتي" : "Mes rendez-vous & réservations"}
        description={
          ar
            ? "تابع جلسات المرافقة المدرسية (AVS) المحمية بالضمان المالي، ومواعيد المتابعة البيداغوجية."
            : "Consultez vos séances d'accompagnement AVS sous séquestre sécurisé et vos entretiens pédagogiques."
        }
      />

      {/* AVS BOOKINGS SECTION */}
      <section aria-labelledby="avs-bookings-title">
        <LearnerAvsBookingsSection locale={locale} bookings={avsBookings} />
      </section>

      {/* INSTITUTIONAL & PEDAGOGICAL APPOINTMENTS */}
      <section className="space-y-6 pt-4 border-t border-slate-200" aria-labelledby="appointment-list-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="appointment-list-title" className="font-[family-name:var(--font-fraunces)] text-lg font-bold text-[#082D55] sm:text-xl">
              {ar ? "المتابعة البيداغوجية والتوجيه" : "Entretiens pédagogiques & Orientation ANEI"}
            </h2>
            <p className="text-xs text-[#7a7261]">
              {ar ? "جلسات التوجيه والتقييم مع الأخصائيين المعتمدين لدى المعهد." : "Sessions de conseil, bilans d'orientation et entretiens avec l'équipe pédagogique."}
            </p>
          </div>

          <nav className="learner-tabs" aria-label={ar ? "عرض المواعيد" : "Afficher les rendez-vous"}>
            <Link
              className={!history ? "is-active" : undefined}
              aria-current={!history ? "page" : undefined}
              href={`/${locale}/dashboard/rendez-vous`}
            >
              {ar ? "القادمة" : "À venir"}
            </Link>
            <Link
              className={history ? "is-active" : undefined}
              aria-current={history ? "page" : undefined}
              href={`/${locale}/dashboard/rendez-vous?vue=historique`}
            >
              {ar ? "السجل" : "Historique"}
            </Link>
          </nav>
        </div>

        {!history ? (
          <>
            <AppointmentCalendar locale={locale} appointments={upcoming} />
            <AppointmentBooking locale={locale} slots={slots} rescheduleId={query.replanifier} />
          </>
        ) : null}

        <div className="learner-appointment-list">
          {rows.length ? (
            <div>
              {rows.map((row) => (
                <article key={row.id}>
                  <span className="learner-appointment-date" aria-hidden="true">
                    <CalendarDays size={21} strokeWidth={1.75} />
                  </span>
                  <div>
                    <div className="learner-object-meta">
                      <span>{TYPE_LABELS[row.type]?.[locale] ?? row.type}</span>
                      <span>{STATUS_LABELS[row.status]?.[locale] ?? row.status}</span>
                    </div>
                    <h3>{formatter.format(row.startAt)}</h3>
                    <p>
                      {ar ? "مع" : "Avec"} {row.assignedToName}
                    </p>
                    <small dir="ltr">
                      Africa/Tunis · {Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60000)} min
                    </small>
                    {!history && row.meetingUrl && ["SCHEDULED", "CONFIRMED"].includes(row.status) ? (
                      <div className="appointment-confirmed-links">
                        <a href={row.meetingUrl} target="_blank" rel="noreferrer" className="student-secondary-action">
                          {ar ? "رابط الاجتماع" : "Lien de la réunion"}
                        </a>
                        <a
                          href={`https://calendar.google.com/calendar/render?${new URLSearchParams({
                            action: "TEMPLATE",
                            text: ar ? "موعد ANEI" : "Rendez-vous ANEI",
                            dates: `${row.startAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/${row.endAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
                            details: row.meetingUrl,
                          }).toString()}`}
                          target="_blank"
                          rel="noreferrer"
                          className="student-secondary-action"
                        >
                          {ar ? "إضافة إلى تقويم Google" : "Ajouter à Google Agenda"}
                        </a>
                      </div>
                    ) : null}
                    {!history && ["SCHEDULED", "CONFIRMED"].includes(row.status) ? (
                      <AppointmentCancelButton locale={locale} id={row.id} />
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <LearnerEmptyState
              icon={CalendarDays}
              title={
                history
                  ? ar ? "لا يوجد سجل مواعيد بيداغوجية سابقة" : "Aucun entretien dans l’historique"
                  : ar ? "لا يوجد موعد بيداغوجي قادم" : "Aucun entretien pédagogique à venir"
              }
              body={
                ar
                  ? "ستظهر هنا جلسات التوجيه والتقييم التي تحجزها مع المستشارين البيداغوجيين."
                  : "Les rendez-vous d'orientation et de bilan pédagogique apparaîtront dans cette liste."
              }
            />
          )}
        </div>
      </section>
    </div>
  );
}
