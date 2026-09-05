"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminDeleteButton } from "@/components/admin/AdminDeleteButton";
import { AdminObjectUpload } from "@/components/admin/AdminObjectUpload";

type LessonRow = {
  id: string; position: number; titleFr: string; titleAr: string; descriptionFr: string; descriptionAr: string;
  durationSeconds: number; mediaProvider: string; preview?: boolean; moduleId?: string | null;
  videoUrl?: string | null; documentUrl?: string | null;
};

export function AdminLessonRow({ locale, courseId, lesson, modules = [] }: { locale: Locale; courseId: string; lesson: LessonRow; modules?: Array<{ id: string; title: string }> }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const f = new FormData(event.currentTarget);
    const videoObjectKey = String(f.get("videoObjectKey") || "");
    const documentObjectKey = String(f.get("documentObjectKey") || "");
    const payload = {
      position: Number(f.get("position")), titleFr: String(f.get("titleFr")), titleAr: String(f.get("titleAr")),
      descriptionFr: String(f.get("descriptionFr") || ""), descriptionAr: String(f.get("descriptionAr") || ""),
      durationSeconds: Number(f.get("durationSeconds")), preview: f.get("preview") === "on",
      moduleId: String(f.get("moduleId") || "") || null,
      // Omit unless a new file was actually uploaded — the API treats a
      // present-but-empty value as "clear the file".
      ...(videoObjectKey ? { videoUrl: videoObjectKey } : {}),
      ...(documentObjectKey ? { documentUrl: documentObjectKey } : {}),
    };
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setEditing(false); setState("idle"); router.refresh(); } else setState("error");
  }

  async function move(delta: 1 | -1) {
    const nextPosition = lesson.position + delta;
    if (nextPosition < 1) return;
    setState("loading");
    const res = await fetch(`/api/admin/lessons/${lesson.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: nextPosition }) });
    setState(res.ok ? "idle" : "error");
    if (res.ok) router.refresh();
  }

  if (!editing) return <article>
    <b>{lesson.position}</b>
    <div><strong>{ar ? lesson.titleAr : lesson.titleFr}</strong><small>{lesson.mediaProvider} · {Math.round(lesson.durationSeconds / 60)} min</small></div>
    <div className="admin-list-actions">
      <button type="button" className="btn btn-ghost btn-sm" disabled={state === "loading"} onClick={() => move(-1)} aria-label={ar ? "نقل لأعلى" : "Monter"}>↑</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={state === "loading"} onClick={() => move(1)} aria-label={ar ? "نقل لأسفل" : "Descendre"}>↓</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>{ar ? "تعديل" : "Modifier"}</button>
      <Link className="btn btn-ghost btn-sm" href={`/${locale}/admin/courses/editor/${courseId}/lessons/${lesson.id}/checkpoints`}>{ar ? "نقاط التفاعل" : "Checkpoints"}</Link>
      <AdminDeleteButton locale={locale} endpoint={`/api/admin/lessons/${lesson.id}`} confirmMessage={ar ? "هل تريد حذف هذا الدرس؟" : "Supprimer cette leçon ?"} />
      {state === "error" ? <small className="form-error">{ar ? "تعذر التحريك." : "Échec du déplacement."}</small> : null}
    </div>
  </article>;

  return <article>
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row"><label><span>{ar ? "الترتيب" : "Position"}</span><input name="position" type="number" min="1" defaultValue={lesson.position} required /></label><label><span>{ar ? "المدة بالثواني" : "Durée (secondes)"}</span><input name="durationSeconds" type="number" min="0" defaultValue={lesson.durationSeconds} required /></label></div>
      <div className="field-row"><label><span>Titre FR</span><input name="titleFr" defaultValue={lesson.titleFr} required /></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" defaultValue={lesson.titleAr} required /></label></div>
      <div className="field-row"><label><span>Description FR</span><textarea name="descriptionFr" defaultValue={lesson.descriptionFr} /></label><label><span>الوصف AR</span><textarea name="descriptionAr" dir="rtl" defaultValue={lesson.descriptionAr} /></label></div>
      <div className="field-row">
        <label><span>{ar ? "الوحدة (اختياري)" : "Module (optionnel)"}</span>
          <select name="moduleId" defaultValue={lesson.moduleId ?? ""}>
            <option value="">{ar ? "بدون وحدة" : "Sans module"}</option>
            {modules.map((module) => <option value={module.id} key={module.id}>{module.title}</option>)}
          </select>
        </label>
        <label className="checkbox-row"><input name="preview" type="checkbox" defaultChecked={lesson.preview ?? false} /><span>{ar ? "معاينة عامة" : "Leçon en aperçu public"}</span></label>
      </div>
      <div className="field-row">
        <div>
          {lesson.videoUrl ? <p className="small-muted">{ar ? "الفيديو الحالي:" : "Vidéo actuelle :"} <code className="object-key-preview">{lesson.videoUrl}</code></p> : null}
          <AdminObjectUpload locale={locale} name="videoObjectKey" category="course" accept="video/mp4" labelFr="Remplacer la vidéo privée" labelAr="استبدال الفيديو الخاص"/>
        </div>
        <div>
          {lesson.documentUrl ? <p className="small-muted">{ar ? "الوثيقة الحالية:" : "Document actuel :"} <code className="object-key-preview">{lesson.documentUrl}</code></p> : null}
          <AdminObjectUpload locale={locale} name="documentObjectKey" category="course" accept="application/pdf,text/vtt" labelFr="Remplacer le document / sous-titres" labelAr="استبدال الوثيقة / الترجمة"/>
        </div>
      </div>
      <div className="admin-row-actions">
        <button className="btn btn-primary btn-sm" disabled={state === "loading"}>{ar ? "حفظ" : "Enregistrer"}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{ar ? "إلغاء" : "Annuler"}</button>
        {state === "error" ? <small className="form-error">{ar ? "تعذر الحفظ." : "Échec de l’enregistrement."}</small> : null}
      </div>
    </form>
  </article>;
}
