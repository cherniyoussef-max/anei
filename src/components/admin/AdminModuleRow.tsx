"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";

type ModuleRow = { id: string; position: number; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string };

export function AdminModuleRow({ locale, module, lessonCount }: { locale: Locale; module: ModuleRow; lessonCount: number }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const f = new FormData(event.currentTarget);
    const payload = { position: Number(f.get("position")), titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")), descriptionFr: String(f.get("descriptionFr") || ""), descriptionAr: String(f.get("descriptionAr") || "") };
    const res = await fetch(`/api/admin/modules/${module.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setEditing(false); setState("idle"); router.refresh(); } else setState("error");
  }

  async function move(delta: 1 | -1) {
    const nextPosition = module.position + delta;
    if (nextPosition < 1) return;
    setState("loading");
    const res = await fetch(`/api/admin/modules/${module.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: nextPosition }) });
    setState(res.ok ? "idle" : "error");
    if (res.ok) router.refresh();
  }

  if (!editing) return <article>
    <b>{module.position}</b>
    <div><strong>{ar ? module.titleAr : module.titleFr}</strong><small>{lessonCount} {ar ? "دروس" : "leçons"}</small></div>
    <div className="admin-list-actions">
      <button type="button" className="btn btn-ghost btn-sm" disabled={state === "loading"} onClick={() => move(-1)} aria-label={ar ? "نقل لأعلى" : "Monter"}>↑</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={state === "loading"} onClick={() => move(1)} aria-label={ar ? "نقل لأسفل" : "Descendre"}>↓</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{ar ? "تعديل" : "Modifier"}</button>
      <AdminDeleteButton locale={locale} endpoint={`/api/admin/modules/${module.id}`} confirmMessage={ar ? "هل تريد حذف هذه الوحدة؟" : "Supprimer ce module ?"} />
      {state === "error" ? <small className="form-error">{ar ? "تعذر التحريك." : "Échec du déplacement."}</small> : null}
    </div>
  </article>;

  return <article>
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row"><label><span>{ar ? "ترتيب الوحدة" : "Position"}</span><input name="position" type="number" min="1" defaultValue={module.position} required /></label><label><span>Titre FR</span><input name="titleFr" defaultValue={module.titleFr} required /></label></div>
      <label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={module.titleAr} required /></label>
      <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" defaultValue={module.descriptionFr} /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" defaultValue={module.descriptionAr} /></label></div>
      <div className="admin-row-actions">
        <button className="btn btn-primary btn-sm" disabled={state === "loading"}>{ar ? "حفظ" : "Enregistrer"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{ar ? "إلغاء" : "Annuler"}</button>
        {state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}
      </div>
    </form>
  </article>;
}
