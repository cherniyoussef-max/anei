"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

const WEEKDAYS = [
  { value: 1, fr: "Lundi", ar: "الإثنين" },
  { value: 2, fr: "Mardi", ar: "الثلاثاء" },
  { value: 3, fr: "Mercredi", ar: "الأربعاء" },
  { value: 4, fr: "Jeudi", ar: "الخميس" },
  { value: 5, fr: "Vendredi", ar: "الجمعة" },
  { value: 6, fr: "Samedi", ar: "السبت" },
  { value: 0, fr: "Dimanche", ar: "الأحد" },
];

function minutesOf(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function AdminAvailabilityForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [mode, setMode] = useState<"weekly" | "dated">("weekly");
  const [sessionType, setSessionType] = useState<"INDIVIDUAL" | "GROUP">("INDIVIDUAL");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error" | "conflict">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const form = event.currentTarget;
    const data = new FormData(form);
    const weekdays = mode === "weekly" ? WEEKDAYS.filter((day) => data.get(`weekday-${day.value}`) === "on").map((day) => day.value) : undefined;
    const specificDate = mode === "dated" ? String(data.get("specificDate") || "") || undefined : undefined;
    const payload = {
      ...(mode === "weekly" ? { weekdays } : { specificDate }),
      startMinute: minutesOf(String(data.get("startTime") || "09:00")),
      endMinute: minutesOf(String(data.get("endTime") || "10:00")),
      durationMinutes: Number(data.get("durationMinutes")),
      type: String(data.get("type")),
      sessionType,
      capacity: sessionType === "GROUP" ? Number(data.get("capacity") || 1) : 1,
    };
    const res = await fetch("/api/admin/availabilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setState("done"); form.reset(); router.refresh(); return; }
    setState(res.status === 409 ? "conflict" : "error");
  }

  return (
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row">
        <label>
          <span>{ar ? "نوع الفتحة" : "Type de créneau"}</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as "weekly" | "dated")}>
            <option value="weekly">{ar ? "قالب أسبوعي متكرر" : "Modèle hebdomadaire récurrent"}</option>
            <option value="dated">{ar ? "تاريخ واحد" : "Date unique"}</option>
          </select>
        </label>
        <label>
          <span>{ar ? "نوع الجلسة" : "Type de session"}</span>
          <select value={sessionType} onChange={(event) => setSessionType(event.target.value as "INDIVIDUAL" | "GROUP")}>
            <option value="INDIVIDUAL">{ar ? "فردي (1 لكل فتحة)" : "Individuel (1 par créneau)"}</option>
            <option value="GROUP">{ar ? "جماعي / ندوة" : "Groupe / Webinaire"}</option>
          </select>
        </label>
      </div>

      {mode === "weekly" ? (
        <div className="checkbox-row-group">
          <span>{ar ? "الأيام" : "Jours"}</span>
          <div className="field-row">
            {WEEKDAYS.map((day) => (
              <label className="checkbox-row" key={day.value}>
                <input type="checkbox" name={`weekday-${day.value}`} />
                <span>{ar ? day.ar : day.fr}</span>
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="field-row">
          <label><span>{ar ? "التاريخ" : "Date"}</span><input name="specificDate" type="date" required /></label>
        </div>
      )}

      <div className="field-row">
        <label><span>{ar ? "من الساعة" : "Heure de début"}</span><input name="startTime" type="time" defaultValue="09:00" required /></label>
        <label><span>{ar ? "إلى الساعة" : "Heure de fin"}</span><input name="endTime" type="time" defaultValue="17:00" required /></label>
      </div>

      <div className="field-row">
        <label><span>{ar ? "مدة الجلسة (دقيقة)" : "Durée de session (min)"}</span><input name="durationMinutes" type="number" min="15" max="240" defaultValue="60" required /></label>
        <label>
          <span>{ar ? "الغرض" : "Motif"}</span>
          <select name="type" defaultValue="FOLLOW_UP">
            <option value="ASSESSMENT">{ar ? "تقييم" : "Évaluation"}</option>
            <option value="INFO_MEETING">{ar ? "لقاء معلومات" : "Réunion d'information"}</option>
            <option value="FOLLOW_UP">{ar ? "متابعة" : "Suivi"}</option>
            <option value="OTHER">{ar ? "أخرى" : "Autre"}</option>
          </select>
        </label>
      </div>

      {sessionType === "GROUP" ? (
        <div className="field-row">
          <label><span>{ar ? "السعة القصوى للمشاركين" : "Capacité maximale d'attendees"}</span><input name="capacity" type="number" min="2" max="200" defaultValue="20" required /></label>
        </div>
      ) : null}

      <button className="btn btn-primary" disabled={state === "loading"}>
        {state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إنشاء الفتحات" : "Créer les créneaux")}
      </button>
      {state === "done" ? <small className="success-inline">{ar ? "تم الإنشاء." : "Créneaux créés."}</small> : null}
      {state === "conflict" ? <small className="form-error">{ar ? "يوجد تعارض مع فتحة موجودة بنفس اليوم والوقت." : "Conflit avec un créneau existant au même jour/heure."}</small> : null}
      {state === "error" ? <small className="form-error">{ar ? "تعذر الإنشاء. تحقق من الحقول." : "Création impossible. Vérifiez les champs."}</small> : null}
    </form>
  );
}
