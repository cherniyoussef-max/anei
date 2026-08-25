"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminWebinarForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const form = e.currentTarget;
    const f = new FormData(form);
    const startsAtLocal = String(f.get("startsAt") || "");
    const payload = {
      slug: String(f.get("slug")),
      titleFr: String(f.get("titleFr")),
      titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr")),
      descriptionAr: String(f.get("descriptionAr")),
      trainerName: String(f.get("trainerName")),
      startsAt: startsAtLocal ? new Date(startsAtLocal).toISOString() : undefined,
      durationMinutes: Number(f.get("durationMinutes")),
      meetingUrl: String(f.get("meetingUrl") || "") || null,
      replayUrl: String(f.get("replayUrl") || "") || null,
      published: f.get("published") === "on",
    };
    const res = await fetch("/api/admin/webinars", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { form.reset(); router.refresh(); }
  }

  return <form className="admin-course-form" onSubmit={submit}>
    <div className="field-row">
      <label><span>Slug</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="webinaire-inclusion" /></label>
      <label><span>{ar ? "المدرب" : "Intervenant"}</span><input name="trainerName" required /></label>
    </div>
    <div className="field-row">
      <label><span>Titre FR</span><input name="titleFr" required /></label>
      <label><span>العنوان AR</span><input name="titleAr" dir="rtl" required /></label>
    </div>
    <div className="field-row">
      <label><span>Description FR</span><textarea name="descriptionFr" rows={4} required /></label>
      <label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={4} required /></label>
    </div>
    <div className="field-row">
      <label><span>{ar ? "التاريخ والوقت" : "Date et heure"}</span><input name="startsAt" type="datetime-local" required /></label>
      <label><span>{ar ? "المدة بالدقائق" : "Durée (minutes)"}</span><input name="durationMinutes" type="number" min="15" max="1440" defaultValue="60" required /></label>
    </div>
    <div className="field-row">
      <label><span>{ar ? "رابط الاجتماع (Meet/Teams)" : "Lien de réunion (Meet/Teams)"}</span><input name="meetingUrl" type="url" placeholder="https://meet.google.com/..." /></label>
      <label><span>{ar ? "رابط الإعادة" : "Lien de replay"}</span><input name="replayUrl" type="url" placeholder="https://..." /></label>
    </div>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /><span>{ar ? "نشر الندوة مباشرة" : "Publier le webinaire immédiatement"}</span></label>
    <button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إضافة الندوة" : "Ajouter le webinaire")}</button>
    {state === "done" ? <small className="success-inline">{ar ? "تم الإنشاء." : "Webinaire créé."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الإنشاء." : "Création impossible. Vérifiez les champs ou le slug."}</small> : null}
  </form>;
}
