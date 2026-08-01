"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
}

export function AdminCourseForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const form = e.currentTarget;
    const f = new FormData(form);
    const payload = {
      slug: String(f.get("slug")),
      titleFr: String(f.get("titleFr")),
      titleAr: String(f.get("titleAr")),
      summaryFr: String(f.get("summaryFr")),
      summaryAr: String(f.get("summaryAr")),
      descriptionFr: String(f.get("descriptionFr")),
      descriptionAr: String(f.get("descriptionAr")),
      category: String(f.get("category")),
      trainerName: String(f.get("trainerName")),
      durationMinutes: Number(f.get("durationMinutes")),
      priceMillimes: Math.round(Number(f.get("priceTnd")) * 1000),
      mode: String(f.get("mode")),
      published: f.get("published") === "on",
      objectives: { fr: lines(f.get("objectivesFr")), ar: lines(f.get("objectivesAr")) },
    };
    const res = await fetch("/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { form.reset(); router.refresh(); }
  }

  return <form className="admin-course-form" onSubmit={submit}>
    <div className="field-row"><label><span>Slug</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="nouvelle-formation"/></label><label><span>{ar?"المدرب":"Formateur"}</span><input name="trainerName" required/></label></div>
    <div className="field-row"><label><span>Titre FR</span><input name="titleFr" required/></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" required/></label></div>
    <div className="field-row"><label><span>Résumé FR</span><textarea name="summaryFr" required maxLength={500}/></label><label><span>الملخص AR</span><textarea name="summaryAr" dir="rtl" required maxLength={500}/></label></div>
    <div className="field-row"><label><span>Description complète FR</span><textarea name="descriptionFr" rows={5} required/></label><label><span>الوصف الكامل AR</span><textarea name="descriptionAr" dir="rtl" rows={5} required/></label></div>
    <div className="field-row"><label><span>Objectifs FR — un par ligne</span><textarea name="objectivesFr" rows={4} required/></label><label><span>الأهداف AR — هدف في كل سطر</span><textarea name="objectivesAr" dir="rtl" rows={4} required/></label></div>
    <div className="field-row"><label><span>{ar?"الفئة":"Catégorie"}</span><input name="category" defaultValue="education" required/></label><label><span>{ar?"الصيغة":"Modalité"}</span><select name="mode"><option value="online">En ligne</option><option value="hybrid">Hybride</option><option value="onsite">Présentiel</option></select></label></div>
    <div className="field-row"><label><span>{ar?"المدة بالدقائق":"Durée (minutes)"}</span><input name="durationMinutes" type="number" min="30" defaultValue="600" required/></label><label><span>{ar?"السعر بالدينار":"Prix (TND)"}</span><input name="priceTnd" type="number" min="0" step="0.001" defaultValue="0" required/></label></div>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked/><span>{ar?"نشر الدورة مباشرة":"Publier la formation immédiatement"}</span></label>
    <button className="btn btn-primary" disabled={state==="loading"}>{state==="loading"?(ar?"جارٍ الإنشاء...":"Création..."):(ar?"إنشاء الدورة":"Créer la formation")}</button>
    {state==="done"?<small className="success-inline">{ar?"تم الإنشاء.":"Formation créée."}</small>:state==="error"?<small className="form-error">{ar?"تعذر الإنشاء.":"Création impossible. Vérifiez les champs ou le slug."}</small>:null}
  </form>;
}
