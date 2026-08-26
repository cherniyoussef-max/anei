"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminObjectUpload } from "./AdminObjectUpload";

type CourseValues = {
  id: string; titleFr: string; titleAr: string; summaryFr: string; summaryAr: string; descriptionFr: string; descriptionAr: string;
  category: string; trainerName: string; durationMinutes: number; priceMillimes: number; level: string; mode: string; published: boolean;
  coverImage?: string | null;
};

export function AdminCourseEditForm({ locale, course }: { locale: Locale; course: CourseValues }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [dirty, setDirty] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const f = new FormData(e.currentTarget);
    const coverImageObjectKey = String(f.get("coverImageObjectKey") || "");
    const payload = {
      titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")),
      summaryFr: String(f.get("summaryFr")), summaryAr: String(f.get("summaryAr")),
      descriptionFr: String(f.get("descriptionFr")), descriptionAr: String(f.get("descriptionAr")),
      category: String(f.get("category")), trainerName: String(f.get("trainerName")),
      durationMinutes: Number(f.get("durationMinutes")), priceMillimes: Math.round(Number(f.get("priceTnd")) * 1000),
      level: String(f.get("level")), mode: String(f.get("mode")), published: f.get("published") === "on",
      // Omit entirely when no new file was uploaded. The API treats a
      // present-but-empty value as "clear the cover image", so only send
      // this key when the admin actually picked a new file.
      ...(coverImageObjectKey ? { coverImageObjectKey } : {}),
    };
    const res = await fetch(`/api/admin/courses/${course.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { setDirty(false); router.refresh(); }
  }

  return <form id="admin-course-information-form" className="admin-course-form" onSubmit={submit} onChange={() => { setDirty(true); if (state === "done") setState("idle"); }}>
    <div className="admin-form-section-heading"><div><strong>{ar ? "الهوية والوعد" : "Identité et promesse"}</strong><small>{ar ? "تظهر هذه المعلومات في الكتالوج وصفحة الدورة." : "Ces informations structurent le catalogue et la page publique."}</small></div>{dirty ? <span className="admin-unsaved-indicator">{ar ? "تغييرات غير محفوظة" : "Modifications non enregistrées"}</span> : null}</div>
    <div className="field-row"><label><span>Titre FR</span><input name="titleFr" defaultValue={course.titleFr} required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={course.titleAr} required /></label></div>
    <div className="field-row"><label><span>Résumé FR</span><textarea name="summaryFr" defaultValue={course.summaryFr} maxLength={500} required /></label><label><span>الملخص AR</span><textarea name="summaryAr" dir="rtl" defaultValue={course.summaryAr} maxLength={500} required /></label></div>
    <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" rows={5} defaultValue={course.descriptionFr} required /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={5} defaultValue={course.descriptionAr} required /></label></div>
    <div className="admin-form-section-heading"><div><strong>{ar ? "إعدادات العرض" : "Paramètres de l’offre"}</strong><small>{ar ? "حدّد التصنيف والصيغة والسعر والمكوّن." : "Définissez le classement, la modalité, le prix et le formateur."}</small></div></div>
    <div className="field-row"><label><span>{ar ? "الفئة" : "Catégorie"}</span><input name="category" defaultValue={course.category} required /></label><label><span>{ar ? "المدرب" : "Formateur"}</span><input name="trainerName" defaultValue={course.trainerName} required /></label></div>
    <div className="field-row"><label><span>{ar ? "الصيغة" : "Modalité"}</span><select name="mode" defaultValue={course.mode}><option value="online">En ligne</option><option value="hybrid">Hybride</option><option value="onsite">Présentiel</option></select></label><label><span>{ar ? "مستوى الصعوبة" : "Niveau"}</span><select name="level" defaultValue={course.level}><option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option><option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option><option value="advanced">{ar ? "متقدم" : "Avancé"}</option></select></label></div>
    <div className="field-row"><label><span>{ar ? "المدة بالدقائق" : "Durée (minutes)"}</span><input name="durationMinutes" type="number" min="30" defaultValue={course.durationMinutes} required /></label><label><span>{ar ? "السعر بالدينار" : "Prix (TND)"}</span><input name="priceTnd" type="number" min="0" step="0.001" defaultValue={(course.priceMillimes / 1000).toString()} required /></label></div>
    {course.coverImage ? <p className="small-muted">{ar ? "الغلاف الحالي:" : "Couverture actuelle :"} <code className="object-key-preview">{course.coverImage}</code></p> : null}
    <AdminObjectUpload locale={locale} name="coverImageObjectKey" category="course" accept="image/jpeg,image/png,image/webp" labelFr="Remplacer l’image de couverture" labelAr="استبدال صورة الغلاف"/>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={course.published} /><span>{ar ? "منشورة" : "Publiée"}</span></label>
    <div className="admin-form-submit-row"><button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ التعديلات" : "Enregistrer les modifications")}</button>
    <span aria-live="polite">{state === "done" ? <small className="success-inline">{ar ? "تم الحفظ." : "Modifications enregistrées."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}</span></div>
  </form>;
}
