"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminObjectUpload } from "@/components/admin/AdminObjectUpload";

export function AdminResourceForm({ locale }: { locale: Locale }) {
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
      descriptionFr: String(f.get("descriptionFr")),
      descriptionAr: String(f.get("descriptionAr")),
      audienceFr: String(f.get("audienceFr")),
      audienceAr: String(f.get("audienceAr")),
      type: String(f.get("type")),
      level: String(f.get("level")),
      priceMillimes: Math.round(Number(f.get("priceTnd")) * 1000),
      coverImageObjectKey: String(f.get("coverImageObjectKey") || "") || null,
      downloadObjectKey: String(f.get("downloadObjectKey") || "") || null,
      published: f.get("published") === "on",
    };
    const res = await fetch("/api/admin/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { form.reset(); router.refresh(); }
  }

  return <form className="admin-course-form" onSubmit={submit}>
    <div className="field-row">
      <label><span>Slug</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="guide-inclusion-scolaire" /></label>
      <label><span>{ar ? "النوع" : "Type"}</span><input name="type" required placeholder={ar ? "دليل، شبكة تقييم..." : "guide, grille, fiche..."} /></label>
    </div>
    <div className="field-row">
      <label><span>Titre FR</span><input name="titleFr" required /></label>
      <label><span>العنوان AR</span><input name="titleAr" dir="rtl" required /></label>
    </div>
    <div className="field-row">
      <label><span>Description FR</span><textarea name="descriptionFr" rows={5} required /></label>
      <label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={5} required /></label>
    </div>
    <div className="field-row">
      <label><span>{ar ? "الفئة المستهدفة FR" : "Public visé FR"}</span><input name="audienceFr" required placeholder={ar ? "مثال: مدرّسون، أولياء" : "ex: enseignants, parents"} /></label>
      <label><span>{ar ? "الفئة المستهدفة AR" : "Public visé AR"}</span><input name="audienceAr" dir="rtl" required /></label>
    </div>
    <div className="field-row">
      <label><span>{ar ? "مستوى الصعوبة" : "Niveau de difficulté"}</span>
        <select name="level" defaultValue="beginner">
          <option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option>
          <option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option>
          <option value="advanced">{ar ? "متقدم" : "Avancé"}</option>
        </select>
      </label>
      <label><span>{ar ? "السعر بالدينار" : "Prix (TND)"}</span><input name="priceTnd" type="number" min="0" step="0.001" defaultValue="0" required /></label>
    </div>
    <AdminObjectUpload locale={locale} name="downloadObjectKey" category="resource" accept="application/pdf"
      labelFr="Fichier PDF de la ressource" labelAr="ملف PDF للمورد" />
    <AdminObjectUpload locale={locale} name="coverImageObjectKey" category="resource" accept="image/jpeg,image/png,image/webp"
      labelFr="Image de couverture" labelAr="صورة الغلاف" />
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /><span>{ar ? "نشر المورد مباشرة" : "Publier la ressource immédiatement"}</span></label>
    <button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إضافة المورد" : "Ajouter la ressource")}</button>
    {state === "done" ? <small className="success-inline">{ar ? "تم الإنشاء." : "Ressource créée."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الإنشاء." : "Création impossible. Vérifiez les champs ou le slug."}</small> : null}
  </form>;
}
