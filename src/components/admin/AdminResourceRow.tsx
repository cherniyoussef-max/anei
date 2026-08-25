"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { formatMillimes } from "@/lib/i18n";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { AdminObjectUpload } from "@/components/admin/AdminObjectUpload";

type ResourceRow = {
  id: string; slug: string; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string;
  audienceFr: string; audienceAr: string; type: string; level: string; priceMillimes: number; published: boolean;
  coverImage?: string | null; downloadUrl?: string | null;
};

export function AdminResourceRow({ locale, resource }: { locale: Locale; resource: ResourceRow }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const f = new FormData(event.currentTarget);
    const coverImageObjectKey = String(f.get("coverImageObjectKey") || "");
    const downloadObjectKey = String(f.get("downloadObjectKey") || "");
    const payload = {
      titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr")), descriptionAr: String(f.get("descriptionAr")),
      audienceFr: String(f.get("audienceFr")), audienceAr: String(f.get("audienceAr")),
      type: String(f.get("type")), level: String(f.get("level")),
      priceMillimes: Math.round(Number(f.get("priceTnd")) * 1000),
      published: f.get("published") === "on",
      // Omit unless a new file was actually uploaded — an empty value
      // here means "clear the file" on the API side.
      ...(coverImageObjectKey ? { coverImageObjectKey } : {}),
      ...(downloadObjectKey ? { downloadObjectKey } : {}),
    };
    const res = await fetch(`/api/admin/resources/${resource.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setEditing(false); setState("idle"); router.refresh(); } else setState("error");
  }

  if (!editing) return <tr>
    <td><strong>{ar ? resource.titleAr : resource.titleFr}</strong><br /><small className="mono">{resource.slug}</small></td>
    <td>{resource.type}</td>
    <td>{resource.level}</td>
    <td className="numeric">{formatMillimes(resource.priceMillimes, locale)}</td>
    <td>{resource.published ? (ar ? "منشور" : "Publié") : (ar ? "مسودة" : "Brouillon")}</td>
    <td><div className="admin-row-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{ar ? "تعديل" : "Modifier"}</button>
      <AdminDeleteButton locale={locale} endpoint={`/api/admin/resources/${resource.id}`} confirmMessage={ar ? "هل تريد حذف هذا المورد؟" : "Supprimer cette ressource ?"} />
    </div></td>
  </tr>;

  return <tr className="admin-edit-row"><td colSpan={6}>
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row"><label><span>Titre FR</span><input name="titleFr" defaultValue={resource.titleFr} required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={resource.titleAr} required /></label></div>
      <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" rows={3} defaultValue={resource.descriptionFr} required /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={3} defaultValue={resource.descriptionAr} required /></label></div>
      <div className="field-row"><label><span>{ar ? "الفئة المستهدفة FR" : "Public visé FR"}</span><input name="audienceFr" defaultValue={resource.audienceFr} required /></label><label><span>{ar ? "الفئة المستهدفة AR" : "Public visé AR"}</span><input name="audienceAr" dir="rtl" defaultValue={resource.audienceAr} required /></label></div>
      <div className="field-row"><label><span>{ar ? "النوع" : "Type"}</span><input name="type" defaultValue={resource.type} required /></label>
        <label><span>{ar ? "مستوى الصعوبة" : "Niveau"}</span><select name="level" defaultValue={resource.level}><option value="beginner">{ar ? "مبتدئ" : "Débutant"}</option><option value="intermediate">{ar ? "متوسط" : "Intermédiaire"}</option><option value="advanced">{ar ? "متقدم" : "Avancé"}</option></select></label></div>
      <div className="field-row"><label><span>{ar ? "السعر بالدينار" : "Prix (TND)"}</span><input name="priceTnd" type="number" min="0" step="0.001" defaultValue={(resource.priceMillimes / 1000).toString()} required /></label>
        <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={resource.published} /><span>{ar ? "منشور" : "Publié"}</span></label></div>
      <div className="field-row">
        <div>
          {resource.downloadUrl ? <p className="small-muted">{ar ? "الملف الحالي:" : "Fichier actuel :"} <code className="object-key-preview">{resource.downloadUrl}</code></p> : null}
          <AdminObjectUpload locale={locale} name="downloadObjectKey" category="resource" accept="application/pdf" labelFr="Remplacer le fichier PDF" labelAr="استبدال ملف PDF"/>
        </div>
        <div>
          {resource.coverImage ? <p className="small-muted">{ar ? "الغلاف الحالي:" : "Couverture actuelle :"} <code className="object-key-preview">{resource.coverImage}</code></p> : null}
          <AdminObjectUpload locale={locale} name="coverImageObjectKey" category="resource" accept="image/jpeg,image/png,image/webp" labelFr="Remplacer l’image de couverture" labelAr="استبدال صورة الغلاف"/>
        </div>
      </div>
      <div className="admin-row-actions">
        <button className="btn btn-primary btn-sm" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ" : "Enregistrer")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{ar ? "إلغاء" : "Annuler"}</button>
        {state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}
      </div>
    </form>
  </td></tr>;
}
