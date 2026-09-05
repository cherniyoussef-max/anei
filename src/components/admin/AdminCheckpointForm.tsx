"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

const OPTION_KEYS = ["a", "b", "c", "d"] as const;

export function AdminCheckpointForm({ locale, lessonId, durationSeconds }: { locale: Locale; lessonId: string; durationSeconds: number }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [kind, setKind] = useState<"REFLECTION" | "QUIZ">("REFLECTION");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const form = event.currentTarget;
    const data = new FormData(form);
    const options = kind === "QUIZ"
      ? OPTION_KEYS.map((key) => ({ id: key, textFr: String(data.get(`option-${key}-fr`) || "").trim(), textAr: String(data.get(`option-${key}-ar`) || "").trim() })).filter((option) => option.textFr && option.textAr)
      : undefined;
    const payload = {
      triggerSeconds: Number(data.get("triggerSeconds")),
      kind,
      promptFr: String(data.get("promptFr") || "").trim(),
      promptAr: String(data.get("promptAr") || "").trim(),
      ...(kind === "QUIZ" ? { options, correctOptionId: String(data.get("correctOptionId") || "") } : {}),
    };
    const res = await fetch(`/api/admin/lessons/${lessonId}/checkpoints`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setState("done"); form.reset(); router.refresh(); return; }
    setState("error");
  }

  return (
    <form className="admin-course-form" onSubmit={submit}>
      <div className="field-row">
        <label><span>{ar ? "الثانية في الفيديو" : "Seconde dans la vidéo"}</span><input name="triggerSeconds" type="number" min="0" max={durationSeconds + 3600} defaultValue="0" required /></label>
        <label>
          <span>{ar ? "النوع" : "Type"}</span>
          <select value={kind} onChange={(event) => setKind(event.target.value as "REFLECTION" | "QUIZ")}>
            <option value="REFLECTION">{ar ? "تأمل (سؤال مفتوح)" : "Réflexion (question ouverte)"}</option>
            <option value="QUIZ">{ar ? "سؤال اختيار من متعدد" : "Question à choix multiple"}</option>
          </select>
        </label>
      </div>
      <div className="field-row">
        <label><span>{ar ? "السؤال (فرنسي)" : "Question (français)"}</span><textarea name="promptFr" rows={2} required /></label>
        <label><span>{ar ? "السؤال (عربي)" : "Question (arabe)"}</span><textarea name="promptAr" dir="rtl" rows={2} required /></label>
      </div>
      {kind === "QUIZ" ? <>
        {OPTION_KEYS.map((key) => (
          <div className="field-row" key={key}>
            <label><span>{ar ? `الخيار ${key.toUpperCase()} (فرنسي)` : `Option ${key.toUpperCase()} (français)`}</span><input name={`option-${key}-fr`} /></label>
            <label><span>{ar ? `الخيار ${key.toUpperCase()} (عربي)` : `Option ${key.toUpperCase()} (arabe)`}</span><input name={`option-${key}-ar`} dir="rtl" /></label>
          </div>
        ))}
        <label>
          <span>{ar ? "الإجابة الصحيحة" : "Bonne réponse"}</span>
          <select name="correctOptionId" required>
            {OPTION_KEYS.map((key) => <option value={key} key={key}>{ar ? `الخيار ${key.toUpperCase()}` : `Option ${key.toUpperCase()}`}</option>)}
          </select>
        </label>
      </> : null}
      <button className="btn btn-primary" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإنشاء..." : "Création...") : (ar ? "إضافة نقطة التفاعل" : "Ajouter le checkpoint")}</button>
      {state === "done" ? <small className="success-inline">{ar ? "تمت الإضافة." : "Checkpoint ajouté."}</small> : null}
      {state === "error" ? <small className="form-error">{ar ? "تعذرت الإضافة. تحقق من الحقول." : "Ajout impossible. Vérifiez les champs."}</small> : null}
    </form>
  );
}
