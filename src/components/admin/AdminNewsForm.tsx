"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminNewsForm({ locale }: { locale: Locale }) {
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
      tagFr: String(f.get("tagFr")),
      tagAr: String(f.get("tagAr")),
      titleFr: String(f.get("titleFr")),
      titleAr: String(f.get("titleAr")),
      excerptFr: String(f.get("excerptFr")),
      excerptAr: String(f.get("excerptAr")),
      contentFr: String(f.get("contentFr")),
      contentAr: String(f.get("contentAr")),
      published: f.get("published") === "on",
    };
    const res = await fetch("/api/admin/news", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { form.reset(); router.refresh(); }
  }

  return <form className="admin-course-form" onSubmit={submit}>
    <div className="field-row">
      <label><span>Slug</span><input name="slug" required pattern="[a-z0-9-]+" placeholder="nouvelle-actualite" /></label>
    </div>
    <div className="field-row">
      <label><span>{ar ? "الوسم FR" : "Tag FR"}</span><input name="tagFr" required placeholder="Actualité" /></label>
      <label><span>{ar ? "الوسم AR" : "Tag AR"}</span><input name="tagAr" dir="rtl" required /></label>
    </div>
    <div className="field-row">
      <label><span>Titre FR</span><input name="titleFr" required /></label>
      <label><span>العنوان AR</span><input name="titleAr" dir="rtl" required /></label>
    </div>
    <div className="field-row">
      <label><span>Extrait FR</span><textarea name="excerptFr" rows={3} required maxLength={600} /></label>
      <label><span>المقتطف AR</span><textarea name="excerptAr" dir="rtl" rows={3} required maxLength={600} /></label>
    </div>
    <div className="field-row">
      <label><span>Contenu FR</span><textarea name="contentFr" rows={8} required /></label>
      <label><span>المحتوى AR</span><textarea name="contentAr" dir="rtl" rows={8} required /></label>
    </div>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /><span>{ar ? "نشر الخبر مباشرة" : "Publier l’actualité immédiatement"}</span></label>
    <button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إضافة الخبر" : "Ajouter l’actualité")}</button>
    {state === "done" ? <small className="success-inline">{ar ? "تم الإنشاء." : "Actualité créée."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الإنشاء." : "Création impossible. Vérifiez les champs ou le slug."}</small> : null}
  </form>;
}
