import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

function tunisDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value), day: Number(parts.find((p) => p.type === "day")?.value) };
}

export function AppointmentCalendar({ locale, appointments }: { locale: Locale; appointments: { startAt: Date }[] }) {
  const ar = locale === "ar";
  const today = tunisDateParts(new Date());
  const first = new Date(Date.UTC(today.year, today.month - 1, 1));
  const days = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const appointmentDays = new Set(appointments.map((row) => { const part = tunisDateParts(row.startAt); return part.year === today.year && part.month === today.month ? part.day : -1; }));
  const monthLabel = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Tunis" }).format(first);
  const weekdays = ar ? ["ن", "ث", "ر", "خ", "ج", "س", "ح"] : ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];

  return <section className="appointment-calendar-panel" aria-labelledby="calendar-title"><header><div><h2 id="calendar-title">{monthLabel}</h2><p>{ar ? "التوقيت المحلي: تونس" : "Fuseau horaire : Africa/Tunis"}</p></div><span className="calendar-readonly"><Icon name="shield" size={16} />{ar ? "عرض المواعيد" : "Vue des rendez-vous"}</span></header>
    <div className="appointment-calendar" role="grid" aria-label={monthLabel}><div className="calendar-weekdays" role="row">{weekdays.map((day) => <span role="columnheader" key={day}>{day}</span>)}</div><div className="calendar-days">{Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const past = day < today.day;
      const hasAppointment = appointmentDays.has(day);
      const label = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { dateStyle: "full", timeZone: "Africa/Tunis" }).format(new Date(Date.UTC(today.year, today.month - 1, day)));
      return <button key={day} type="button" disabled={!hasAppointment} className={`${day === today.day ? "is-today" : ""} ${past ? "is-past" : ""} ${hasAppointment ? "has-appointment" : ""}`} aria-label={`${label}${hasAppointment ? (ar ? "، يوجد موعد" : ", rendez-vous prévu") : (ar ? "، لا يوجد موعد" : ", aucun rendez-vous")}`}><span>{day}</span>{hasAppointment ? <small>{ar ? "موعد" : "Prévu"}</small> : null}</button>;
    })}</div></div>
  </section>;
}
