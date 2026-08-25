"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

type RewardRow = { id: string; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string; costPoints: number; stock: number | null; published: boolean };

export function AdminRewardRow({ locale, reward }: { locale: Locale; reward: RewardRow }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const f = new FormData(event.currentTarget);
    const stockRaw = String(f.get("stock") || "").trim();
    const payload = {
      titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr") || ""), descriptionAr: String(f.get("descriptionAr") || ""),
      costPoints: Number(f.get("costPoints")), stock: stockRaw ? Number(stockRaw) : null,
      published: f.get("published") === "on",
    };
    const res = await fetch(`/api/admin/rewards/${reward.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setEditing(false); setState("idle"); router.refresh(); } else setState("error");
  }

  if (!editing) return <tr>
    <td><strong>{ar ? reward.titleAr : reward.titleFr}</strong></td>
    <td className="numeric">{reward.costPoints}</td>
    <td>{reward.stock === null ? (ar ? "غير محدود" : "Illimité") : reward.stock}</td>
    <td>{reward.published ? (ar ? "منشور" : "Publié") : (ar ? "مسودة" : "Brouillon")}</td>
    <td><div className="admin-row-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{ar ? "تعديل" : "Modifier"}</button>
      <AdminDeleteButton locale={locale} endpoint={`/api/admin/rewards/${reward.id}`} confirmMessage={ar ? "هل تريد حذف هذه المكافأة؟" : "Supprimer cette récompense ?"} />
    </div></td>
  </tr>;

  return <tr className="admin-edit-row"><td colSpan={5}>
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row"><label><span>Titre FR</span><input name="titleFr" defaultValue={reward.titleFr} required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={reward.titleAr} required /></label></div>
      <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" rows={3} defaultValue={reward.descriptionFr} /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" rows={3} defaultValue={reward.descriptionAr} /></label></div>
      <div className="field-row">
        <label><span>{ar ? "التكلفة بالنقاط" : "Coût en points"}</span><input name="costPoints" type="number" min="1" defaultValue={reward.costPoints} required /></label>
        <label><span>{ar ? "المخزون" : "Stock"}</span><input name="stock" type="number" min="0" defaultValue={reward.stock ?? ""} /></label>
      </div>
      <label className="checkbox-row"><input name="published" type="checkbox" defaultChecked={reward.published} /><span>{ar ? "منشور" : "Publié"}</span></label>
      <div className="admin-row-actions">
        <button className="btn btn-primary btn-sm" disabled={state === "loading"}>{ar ? "حفظ" : "Enregistrer"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{ar ? "إلغاء" : "Annuler"}</button>
        {state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}
      </div>
    </form>
  </td></tr>;
}
