"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import type { Locale } from "@/types";

const MAX_MONTHS_AHEAD = 3;

function tunisDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value), day: Number(parts.find((p) => p.type === "day")?.value) };
}

export function AppointmentCalendar({ locale, appointments }: { locale: Locale; appointments: { startAt: Date }[] }) {
  const ar = locale === "ar";
  const [monthOffset, setMonthOffset] = useState(0);
  const today = useMemo(() => tunisDateParts(new Date()), []);
  const first = new Date(Date.UTC(today.year, today.month - 1 + monthOffset, 1));
  const viewYear = first.getUTCFullYear();
  const viewMonth = first.getUTCMonth() + 1;
  const days = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const isCurrentMonth = monthOffset === 0;
  const appointmentDays = new Set(appointments.flatMap((row) => { const part = tunisDateParts(row.startAt); return part.year === viewYear && part.month === viewMonth ? [part.day] : []; }));
  const monthLabel = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { month: "long", year: "numeric", timeZone: "Africa/Tunis" }).format(first);
  const weekdays = ar ? ["ن", "ث", "ر", "خ", "ج", "س", "ح"] : ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
  const weekendIndexes = new Set([4, 5]);

  return (
    <section className="rounded-2xl border border-[#E7E0D3] bg-white p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:p-6" aria-labelledby="calendar-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0EAD9] pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthOffset((value) => Math.max(0, value - 1))}
            disabled={monthOffset === 0}
            aria-label={ar ? "الشهر السابق" : "Mois précédent"}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E7E0D3] text-[#7a7261] transition-all duration-200 ease-in-out hover:border-[#C9913F] hover:text-[#082D55] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <div>
            <h2 id="calendar-title" className="font-[family-name:var(--font-fraunces)] text-base font-semibold capitalize text-[#082D55]">{monthLabel}</h2>
            <p className="text-xs text-[#a39c8a]">{ar ? "التوقيت المحلي: تونس" : "Fuseau horaire : Africa/Tunis"}</p>
          </div>
          <button
            type="button"
            onClick={() => setMonthOffset((value) => Math.min(MAX_MONTHS_AHEAD, value + 1))}
            disabled={monthOffset === MAX_MONTHS_AHEAD}
            aria-label={ar ? "الشهر التالي" : "Mois suivant"}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#E7E0D3] text-[#7a7261] transition-all duration-200 ease-in-out hover:border-[#C9913F] hover:text-[#082D55] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E7E0D3] px-3 py-1.5 text-xs font-medium text-[#7a7261]"><ShieldCheck className="text-[#C9913F]" size={14} strokeWidth={1.75} />{ar ? "عرض المواعيد" : "Vue des rendez-vous"}</span>
      </header>

      <div className="mt-4" role="grid" aria-label={monthLabel}>
        <div className="grid grid-cols-7 gap-1 pb-2" role="row">
          {weekdays.map((day, index) => <span key={day} role="columnheader" className={`text-center text-xs font-semibold ${weekendIndexes.has(index) ? "text-[#a9752f]" : "text-[#a39c8a]"}`}>{day}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: offset }, (_, index) => <span aria-hidden="true" key={`blank-${index}`} />)}
          {Array.from({ length: days }, (_, index) => {
            const day = index + 1;
            const past = isCurrentMonth && day < today.day;
            const isToday = isCurrentMonth && day === today.day;
            const hasAppointment = appointmentDays.has(day);
            const label = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", { dateStyle: "full", timeZone: "Africa/Tunis" }).format(new Date(Date.UTC(viewYear, viewMonth - 1, day)));
            return (
              <button
                key={day}
                type="button"
                disabled={!hasAppointment}
                aria-label={`${label}${hasAppointment ? (ar ? "، يوجد موعد" : ", rendez-vous prévu") : (ar ? "، لا يوجد موعد" : ", aucun rendez-vous")}`}
                className={[
                  "flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-all duration-200 ease-in-out",
                  isToday ? "bg-[#082D55] font-bold text-white shadow-md" : past ? "text-[#c9bfa8]" : "text-[#3d3a33]",
                  hasAppointment && !isToday ? "bg-[#F6F1E7] font-semibold text-[#a9752f] ring-1 ring-inset ring-[#e9d3ab]" : "",
                  !hasAppointment ? "cursor-default" : "",
                ].join(" ")}
              >
                <span>{day}</span>
                {hasAppointment ? <small className={`mt-0.5 text-[10px] font-semibold ${isToday ? "text-[#e2bd7d]" : "text-[#a9752f]"}`}>{ar ? "موعد" : "Prévu"}</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#F0EAD9] pt-4 text-xs text-[#7a7261]">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-[#082D55]" aria-hidden="true" />{ar ? "اليوم" : "Aujourd’hui"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md bg-[#F6F1E7] ring-1 ring-inset ring-[#e9d3ab]" aria-hidden="true" />{ar ? "موعد مبرمج" : "Rendez-vous prévu"}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-md border border-[#E7E0D3]" aria-hidden="true" />{ar ? "لا يوجد موعد" : "Aucun rendez-vous"}</span>
      </div>
    </section>
  );
}
