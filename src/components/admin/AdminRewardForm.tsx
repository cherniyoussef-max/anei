"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminRewardForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("loading");
    const form = e.currentTarget;
    const f = new FormData(form);
    const stockRaw = String(f.get("stock") || "").trim();
    const payload = {
      titleFr: String(f.get("titleFr")),
      titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr") || ""),
      descriptionAr: String(f.get("descriptionAr") || ""),
      costPoints: Number(f.get("costPoints")),
      stock: stockRaw ? Number(stockRaw) : null,
      published: f.get("published") === "on",
    };
    const res = await fetch("/api/admin/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setState(res.ok ? "done" : "error");
    if (res.ok) { form.reset(); router.refresh(); }
  }

  return <form className="admin-course-form" onSubmit={submit}>
    <div className="field-row"><label><span>Titre FR</span><input name="titleFr" required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" required /></label></div>
    <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" rows={3} /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={3} /></label></div>
    <div className="field-row">
      <label><span>{ar ? "التكلفة بالنقاط" : "Coût en points"}</span><input name="costPoints" type="number" min="1" defaultValue="100" required /></label>
      <label><span>{ar ? "المخزون (اتركه فارغًا لغير محدود)" : "Stock (laisser vide = illimité)"}</span><input name="stock" type="number" min="0" /></label>
    </div>
    <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked /><span>{ar ? "نشر المكافأة مباشرة" : "Publier la récompense immédiatement"}</span></label>
    <button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إضافة المكافأة" : "Ajouter la récompense")}</button>
    {state === "done" ? <small className="success-inline">{ar ? "تم الإنشاء." : "Récompense créée."}</small> : state === "error" ? <small className="form-error">{ar ? "تعذر الإنشاء." : "Création impossible. Vérifiez les champs."}</small> : null}
  </form>;
}
