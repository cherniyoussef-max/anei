"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/types";
import type { LearnerSlot } from "@/server/services/learner-appointments";
import { Icon } from "@/components/ui/Icon";

function dateKey(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }

export function AppointmentBooking({ locale, slots, rescheduleId }: { locale: Locale; slots: LearnerSlot[]; rescheduleId?: string }) {
  const ar = locale === "ar"; const router = useRouter();
  const dates = useMemo(() => [...new Set(slots.map((slot) => dateKey(slot.startAt)))], [slots]);
  const [selectedDate, setSelectedDate] = useState(dates[0] ?? "");
  const [selected, setSelected] = useState<LearnerSlot | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "done" | "conflict" | "error">("idle");
  const dateFormat = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Tunis" });
  const timeFormat = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
  async function confirm() {
    if (!selected || state === "saving") return; setState("saving");
    const response = await fetch(rescheduleId ? `/api/account/appointments/${rescheduleId}/reschedule` : "/api/account/appointments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruleId: selected.ruleId, startAt: selected.startAt }) });
    if (response.ok) { setState("done"); setSelected(null); router.refresh(); return; }
    setState(response.status === 409 ? "conflict" : "error");
  }
  if (!slots.length) return <section className="appointment-booking-empty" aria-labelledby="booking-title"><Icon name="calendar" size={24} /><div><h2 id="booking-title">{ar ? "لا توجد أوقات متاحة حاليًا" : "Aucun créneau disponible actuellement"}</h2><p>{ar ? "لم يفتح فريق المتابعة أوقات حجز خلال الأسابيع الستة القادمة." : "L’équipe de suivi n’a ouvert aucun créneau dans les six prochaines semaines."}</p></div></section>;
  return <section className="appointment-booking" aria-labelledby="booking-title"><div className="appointment-booking-heading"><h2 id="booking-title">{rescheduleId ? (ar ? "إعادة جدولة الموعد" : "Replanifier le rendez-vous") : (ar ? "حجز موعد" : "Prendre rendez-vous")}</h2><p>{ar ? "اختر تاريخًا ثم وقتًا متاحًا. يُعاد التحقق من الوقت عند التأكيد." : "Choisissez une date puis un créneau. La disponibilité est revérifiée à la confirmation."}</p>{rescheduleId ? <Link href={`/${locale}/dashboard/rendez-vous`}>{ar ? "إلغاء إعادة الجدولة" : "Annuler la replanification"}</Link> : null}</div>
    <div className="appointment-booking-grid"><div><h3>{ar ? "التاريخ" : "Date"}</h3><div className="appointment-date-options">{dates.map((date) => <button type="button" key={date} className={selectedDate === date ? "is-selected" : undefined} aria-pressed={selectedDate === date} onClick={() => { setSelectedDate(date); setSelected(null); setState("idle"); }}>{dateFormat.format(new Date(`${date}T12:00:00Z`))}</button>)}</div></div><div><h3>{ar ? "الأوقات المتاحة" : "Créneaux disponibles"}</h3><div className="appointment-slot-options">{slots.filter((slot) => dateKey(slot.startAt) === selectedDate).map((slot) => <button type="button" key={`${slot.ruleId}:${slot.startAt}`} className={selected?.ruleId === slot.ruleId && selected.startAt === slot.startAt ? "is-selected" : undefined} aria-pressed={selected?.ruleId === slot.ruleId && selected.startAt === slot.startAt} onClick={() => { setSelected(slot); setState("idle"); }}><strong>{timeFormat.format(new Date(slot.startAt))}</strong><small>{slot.providerName}</small></button>)}</div></div></div>
    {selected ? <div className="appointment-confirmation"><div><h3>{ar ? "تأكيد الموعد" : "Confirmer le rendez-vous"}</h3><dl><div><dt>{ar ? "التاريخ" : "Date"}</dt><dd>{dateFormat.format(new Date(selected.startAt))}</dd></div><div><dt>{ar ? "الوقت" : "Heure"}</dt><dd>{timeFormat.format(new Date(selected.startAt))}</dd></div><div><dt>{ar ? "المهني" : "Professionnel"}</dt><dd>{selected.providerName}</dd></div><div><dt>{ar ? "المدة" : "Durée"}</dt><dd>{selected.durationMinutes} min</dd></div><div><dt>{ar ? "التوقيت" : "Fuseau"}</dt><dd dir="ltr">Africa/Tunis</dd></div></dl></div><button type="button" className="student-primary-action" onClick={confirm} disabled={state === "saving"}>{state === "saving" ? (ar ? "جارٍ التأكيد..." : "Confirmation...") : (ar ? "تأكيد الموعد" : "Confirmer le rendez-vous")}</button></div> : null}
    {state === "done" ? <p className="appointment-feedback is-success" role="status">{ar ? "تم حجز الموعد وتحديث قائمتك." : "Rendez-vous confirmé et liste mise à jour."}</p> : state === "conflict" ? <p className="appointment-feedback is-error" role="alert">{ar ? "حجز شخص آخر هذا الوقت. اختر وقتًا آخر." : "Ce créneau vient d’être réservé. Choisissez-en un autre."}</p> : state === "error" ? <p className="appointment-feedback is-error" role="alert">{ar ? "تعذر تأكيد الموعد. حاول مجددًا." : "Impossible de confirmer le rendez-vous. Réessayez."}</p> : null}
  </section>;
}

export function AppointmentActions({ locale, id }: { locale: Locale; id: string }) {
  const ar = locale === "ar"; const router = useRouter(); const [state, setState] = useState<"idle" | "confirm" | "saving" | "error">("idle");
  async function cancel() { setState("saving"); const response = await fetch(`/api/account/appointments/${id}/cancel`, { method: "POST" }); if (response.ok) { router.refresh(); return; } setState("error"); }
  if (state === "confirm") return <span className="appointment-cancel-confirm"><span>{ar ? "تأكيد الإلغاء؟" : "Confirmer l’annulation ?"}</span><button type="button" onClick={cancel}>{ar ? "نعم، إلغاء" : "Oui, annuler"}</button><button type="button" onClick={() => setState("idle")}>{ar ? "رجوع" : "Retour"}</button></span>;
  return <span className="appointment-row-actions"><Link href={`/${locale}/dashboard/rendez-vous?replanifier=${id}`}>{ar ? "إعادة الجدولة" : "Replanifier"}</Link><button className="appointment-cancel" type="button" disabled={state === "saving"} onClick={() => setState("confirm")}>{state === "saving" ? (ar ? "جارٍ الإلغاء..." : "Annulation...") : state === "error" ? (ar ? "إعادة المحاولة" : "Réessayer") : (ar ? "إلغاء الموعد" : "Annuler")}</button></span>;
}
