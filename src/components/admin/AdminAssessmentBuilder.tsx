"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MAX_QUESTION_OPTIONS, MIN_NEW_SINGLE_CHOICE_OPTIONS, type LearningQuestionType } from "@/modules/learning/domain/assessment";
import type { Locale } from "@/types";

type QuestionOption = { id: string; questionId: string; textFr: string; textAr: string; position: number; isCorrect: boolean };
type Question = {
  id: string; assessmentId: string; promptFr: string; promptAr: string; type: string; position: number; points: number;
  explanationFr?: string | null; explanationAr?: string | null; options: QuestionOption[];
};
type Assessment = {
  id: string; titleFr: string; titleAr: string; instructionsFr: string; instructionsAr: string; timeLimitSeconds: number;
  passingScore: number; maxAttempts: number; published: boolean; attemptCount: number; questions: Question[];
};
type SaveState = "idle" | "saving" | "saved" | "error";
type DraftOption = Omit<QuestionOption, "id" | "questionId"> & { key: string };
type EditableQuestion = Omit<Question, "id" | "assessmentId" | "options" | "type"> & { id?: string; assessmentId: string; type: LearningQuestionType; options: DraftOption[] };

function optionLetter(index: number) { return String.fromCharCode(65 + index); }
function emptyOptions(count = MIN_NEW_SINGLE_CHOICE_OPTIONS): DraftOption[] {
  return Array.from({ length: count }, (_, index) => ({ key: crypto.randomUUID(), textFr: "", textAr: "", position: index + 1, isCorrect: false }));
}
function toDraft(question: Question): EditableQuestion {
  return { ...question, type: question.type as LearningQuestionType, options: question.options.map((option) => ({ textFr: option.textFr, textAr: option.textAr, position: option.position, isCorrect: option.isCorrect, key: option.id })) };
}
function isQuestionComplete(question: Question) {
  const correct = question.options.filter((option) => option.isCorrect).length;
  return Boolean(question.promptFr.trim() && question.promptAr.trim() && question.points > 0 && question.options.length >= 2
    && question.options.every((option) => option.textFr.trim() && option.textAr.trim())
    && (question.type === "MULTIPLE_CHOICE" ? correct >= 1 : correct === 1));
}
async function readResponse(response: Response) { return response.json().catch(() => ({})) as Promise<Record<string, unknown>>; }

function SaveNotice({ state, ar, error }: { state: SaveState; ar: boolean; error?: string }) {
  return <span className={`assessment-save-state is-${state}`} role={state === "error" ? "alert" : "status"} aria-live="polite">
    {state === "saving" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...")
      : state === "saved" ? <><Icon name="check" size={15}/>{ar ? "تم الحفظ" : "Enregistré"}</>
      : state === "error" ? (error || (ar ? "تعذر الحفظ" : "Erreur d’enregistrement")) : null}
  </span>;
}

function QuestionEditor({ locale, assessmentId, initial, nextPosition, onCancel, onSaved }: {
  locale: Locale; assessmentId: string; initial?: EditableQuestion; nextPosition: number; onCancel: () => void; onSaved: (question: Question) => void;
}) {
  const ar = locale === "ar";
  const [draft, setDraft] = useState<EditableQuestion>(() => initial ?? {
    assessmentId, promptFr: "", promptAr: "", type: "SINGLE_CHOICE", position: nextPosition, points: 1,
    explanationFr: "", explanationAr: "", options: emptyOptions(),
  });
  const [state, setState] = useState<SaveState>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const minimum = draft.type === "SINGLE_CHOICE" ? 3 : 2;

  function changeType(type: LearningQuestionType) {
    setDraft((current) => {
      if (type === "TRUE_FALSE") {
        const options = emptyOptions(2).map((option, index) => ({ ...option, textFr: index === 0 ? "Vrai" : "Faux", textAr: index === 0 ? "صحيح" : "خطأ" }));
        return { ...current, type, options };
      }
      const required = type === "SINGLE_CHOICE" ? 3 : 2;
      const options = current.options.length >= required ? current.options : [...current.options, ...emptyOptions(required - current.options.length)];
      return { ...current, type, options: options.map((option, index) => ({ ...option, position: index + 1 })) };
    });
    setErrors([]);
  }
  function updateOption(index: number, patch: Partial<DraftOption>) {
    setDraft((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) }));
  }
  function selectCorrect(index: number, checked: boolean) {
    setDraft((current) => ({ ...current, options: current.options.map((option, optionIndex) => ({
      ...option, isCorrect: current.type === "MULTIPLE_CHOICE" ? (optionIndex === index ? checked : option.isCorrect) : optionIndex === index,
    })) }));
  }
  function removeOption(index: number) {
    if (draft.options.length <= minimum || draft.type === "TRUE_FALSE") return;
    setDraft((current) => ({ ...current, options: current.options.filter((_, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({ ...option, position: optionIndex + 1 })) }));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const nextErrors: string[] = [];
    if (!draft.promptFr.trim() || !draft.promptAr.trim()) nextErrors.push(ar ? "أدخل نص السؤال باللغتين." : "Renseignez la question en français et en arabe.");
    if (draft.options.length < minimum) nextErrors.push(ar ? `يلزم ${minimum} خيارات على الأقل.` : `${minimum} réponses minimum sont requises.`);
    if (draft.options.some((option) => !option.textFr.trim() || !option.textAr.trim())) nextErrors.push(ar ? "أكمل جميع الإجابات باللغتين." : "Complétez toutes les réponses dans les deux langues.");
    const correctCount = draft.options.filter((option) => option.isCorrect).length;
    if (draft.type === "MULTIPLE_CHOICE" ? correctCount < 1 : correctCount !== 1) nextErrors.push(ar ? "حدد الإجابة الصحيحة." : "Sélectionnez exactement une bonne réponse.");
    if (!Number.isInteger(draft.points) || draft.points <= 0) nextErrors.push(ar ? "يجب أن تكون النقاط أكبر من صفر." : "Les points doivent être supérieurs à zéro.");
    if (nextErrors.length) { setErrors(nextErrors); return; }
    setState("saving"); setErrors([]);
    const payload = {
      promptFr: draft.promptFr.trim(), promptAr: draft.promptAr.trim(), type: draft.type, position: draft.position, points: draft.points,
      explanationFr: draft.explanationFr || null, explanationAr: draft.explanationAr || null,
      options: draft.options.map((option, index) => ({ textFr: option.textFr.trim(), textAr: option.textAr.trim(), position: index + 1, isCorrect: option.isCorrect })),
    };
    const response = await fetch(draft.id ? `/api/admin/learning-assessments/${assessmentId}/questions/${draft.id}` : `/api/admin/learning-assessments/${assessmentId}/questions`, {
      method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await readResponse(response);
    if (!response.ok || !body.question) {
      setState("error");
      setErrors([body.error === "ATTEMPTS_EXIST" ? (ar ? "لا يمكن تعديل اختبار بدأت محاولاته." : "Ce quiz est verrouillé car des tentatives existent.") : (ar ? "تحقق من الحقول وحاول مجدداً." : "Vérifiez les champs et réessayez.")]);
      return;
    }
    setState("saved"); onSaved(body.question as Question);
  }

  return <form className="assessment-question-editor" onSubmit={save} noValidate>
    <div className="assessment-question-editor-head">
      <div><span>{draft.id ? (ar ? "تعديل السؤال" : "Modifier la question") : (ar ? "سؤال جديد" : "Nouvelle question")}</span><h4>{ar ? "المحتوى والإجابات" : "Contenu et réponses"}</h4></div>
      <label><span>{ar ? "النوع" : "Type"}</span><select value={draft.type} onChange={(event) => changeType(event.target.value as LearningQuestionType)}>
        <option value="SINGLE_CHOICE">{ar ? "اختيار واحد" : "Choix unique"}</option><option value="MULTIPLE_CHOICE">{ar ? "اختيارات متعددة" : "Choix multiples"}</option><option value="TRUE_FALSE">{ar ? "صحيح أو خطأ" : "Vrai / Faux"}</option>
      </select></label>
    </div>
    <div className="assessment-bilingual-grid">
      <label><span>Question FR</span><textarea autoFocus={!draft.id} value={draft.promptFr} onChange={(event) => setDraft((current) => ({ ...current, promptFr: event.target.value }))} rows={3} required/></label>
      <label><span>السؤال AR</span><textarea dir="rtl" lang="ar" value={draft.promptAr} onChange={(event) => setDraft((current) => ({ ...current, promptAr: event.target.value }))} rows={3} required/></label>
    </div>
    <fieldset className="assessment-answer-fieldset">
      <legend>{ar ? "الإجابات" : "Réponses"}<small>{ar ? "حدد الإجابة الصحيحة" : "Sélectionnez la bonne réponse"}</small></legend>
      <div className="assessment-answer-list">{draft.options.map((option, index) => <div className={`assessment-answer-row ${option.isCorrect ? "is-correct" : ""}`} key={option.key}>
        <label className="assessment-correct-control"><input type={draft.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name="correct-answer" checked={option.isCorrect} onChange={(event) => selectCorrect(index, event.target.checked)}/><span className="assessment-option-letter" aria-hidden="true">{optionLetter(index)}</span><span className="sr-only">{ar ? `تحديد الإجابة ${optionLetter(index)} كإجابة صحيحة` : `Marquer la réponse ${optionLetter(index)} comme correcte`}</span></label>
        <label><span>Réponse FR</span><input value={option.textFr} onChange={(event) => updateOption(index, { textFr: event.target.value })} required/></label>
        <label><span>الإجابة AR</span><input dir="rtl" lang="ar" value={option.textAr} onChange={(event) => updateOption(index, { textAr: event.target.value })} required/></label>
        <div className="assessment-answer-actions">{option.isCorrect ? <span className="assessment-correct-label"><Icon name="check" size={14}/>{ar ? "إجابة صحيحة" : "Bonne réponse"}</span> : null}{draft.type !== "TRUE_FALSE" ? <button type="button" className="assessment-remove-option" onClick={() => removeOption(index)} disabled={draft.options.length <= minimum} aria-label={ar ? `حذف الإجابة ${optionLetter(index)}` : `Supprimer la réponse ${optionLetter(index)}`}><Icon name="close" size={16}/></button> : null}</div>
      </div>)}</div>
      {draft.type !== "TRUE_FALSE" ? <button type="button" className="btn btn-ghost btn-sm assessment-add-option" onClick={() => setDraft((current) => ({ ...current, options: [...current.options, { ...emptyOptions(1)[0], position: current.options.length + 1 }] }))} disabled={draft.options.length >= MAX_QUESTION_OPTIONS}><span aria-hidden="true">+</span>{ar ? "إضافة إجابة" : "Ajouter une réponse"}<small>{draft.options.length}/{MAX_QUESTION_OPTIONS}</small></button> : null}
    </fieldset>
    <div className="assessment-question-footer"><label><span>{ar ? "النقاط" : "Points"}</span><input type="number" min={1} max={100} value={draft.points} onChange={(event) => setDraft((current) => ({ ...current, points: Number(event.target.value) }))}/></label><div className="assessment-question-actions"><SaveNotice state={state} ar={ar}/><button type="button" className="btn btn-secondary" onClick={onCancel}>{ar ? "إلغاء" : "Annuler"}</button><button className="btn btn-primary" disabled={state === "saving"}>{ar ? "حفظ السؤال" : "Enregistrer"}</button></div></div>
    {errors.length ? <div className="assessment-validation" role="alert"><strong>{ar ? "أكمل تكوين السؤال" : "Complétez la question"}</strong><ul>{errors.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
  </form>;
}

function QuestionAuditView({ locale, question }: { locale: Locale; question: Question }) {
  const ar = locale === "ar";
  return <section className="assessment-question-audit" aria-label={ar ? "تفاصيل السؤال للقراءة فقط" : "Détails de la question en lecture seule"}>
    <div className="assessment-bilingual-grid"><div><span>Question FR</span><p>{question.promptFr}</p></div><div dir="rtl" lang="ar"><span>السؤال AR</span><p>{question.promptAr}</p></div></div>
    <ul>{question.options.map((option, index) => <li className={option.isCorrect ? "is-correct" : ""} key={option.id}><span className="assessment-option-letter" aria-hidden="true">{optionLetter(index)}</span><div><span>{option.textFr}</span><span dir="rtl" lang="ar">{option.textAr}</span></div>{option.isCorrect ? <strong><Icon name="check" size={15}/>{ar ? "صحيحة" : "Correcte"}</strong> : null}</li>)}</ul>
    <p className="assessment-question-audit-note"><Icon name="shield" size={16}/>{ar ? `للقراءة فقط · ${question.points} نقاط` : `Lecture seule · ${question.points} point(s)`}</p>
  </section>;
}

export function AdminAssessmentBuilder({ locale, courseId, assessments: initialAssessments }: { locale: Locale; courseId: string; assessments: Assessment[] }) {
  const ar = locale === "ar";
  const [assessments, setAssessments] = useState(initialAssessments);
  const [activeId, setActiveId] = useState(initialAssessments[0]?.id ?? "");
  const [editing, setEditing] = useState<{ questionId?: string; duplicate?: Question } | null>(null);
  const [state, setState] = useState<SaveState>("idle"); const [error, setError] = useState("");
  const addQuestionRef = useRef<HTMLButtonElement>(null); const wasCreating = useRef(false);
  const active = assessments.find((assessment) => assessment.id === activeId) ?? assessments[0];
  const locked = Boolean(active && (active.published || active.attemptCount > 0));
  const readiness = useMemo(() => active ? {
    completeQuestions: active.questions.filter(isQuestionComplete).length,
    totalPoints: active.questions.reduce((sum, question) => sum + question.points, 0),
    ready: active.questions.length > 0 && active.questions.every(isQuestionComplete),
  } : null, [active]);
  useEffect(() => {
    const creating = Boolean(editing && !editing.questionId);
    if (wasCreating.current && !creating) addQuestionRef.current?.focus();
    wasCreating.current = creating;
  }, [editing]);
  function updateActive(updater: (assessment: Assessment) => Assessment) { setAssessments((current) => current.map((assessment) => assessment.id === active?.id ? updater(assessment) : assessment)); }

  async function createAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("saving"); setError(""); const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch("/api/admin/learning-assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId, titleFr: String(data.get("titleFr")), titleAr: String(data.get("titleAr")), instructionsFr: String(data.get("instructionsFr")), instructionsAr: String(data.get("instructionsAr")), timeLimitSeconds: Number(data.get("timeLimitMinutes")) * 60, passingScore: Number(data.get("passingScore")), maxAttempts: Number(data.get("maxAttempts")) }) });
    const body = await readResponse(response); if (!response.ok || !body.assessment) { setState("error"); setError(ar ? "تعذر إنشاء الاختبار." : "Impossible de créer le quiz."); return; }
    const created = { ...(body.assessment as Omit<Assessment, "questions" | "attemptCount">), questions: [], attemptCount: 0 }; setAssessments((current) => [created, ...current]); setActiveId(created.id); setEditing(null); setState("saved"); form.reset();
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return; setState("saving"); setError(""); const data = new FormData(event.currentTarget);
    const payload = { titleFr: String(data.get("titleFr")), titleAr: String(data.get("titleAr")), instructionsFr: String(data.get("instructionsFr")), instructionsAr: String(data.get("instructionsAr")), timeLimitSeconds: Number(data.get("timeLimitMinutes")) * 60, passingScore: Number(data.get("passingScore")), maxAttempts: Number(data.get("maxAttempts")) };
    const response = await fetch(`/api/admin/learning-assessments/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const body = await readResponse(response);
    if (!response.ok || !body.assessment) { setState("error"); setError(body.error === "ATTEMPTS_EXIST" ? (ar ? "الاختبار مقفل لوجود محاولات." : "Le quiz est verrouillé car des tentatives existent.") : (ar ? "تعذر حفظ الإعدادات." : "Impossible d’enregistrer les paramètres.")); return; }
    updateActive((assessment) => ({ ...assessment, ...(body.assessment as Assessment) })); setState("saved");
  }
  async function publication(published: boolean) {
    if (!active) return; setState("saving"); setError(""); const response = await fetch(`/api/admin/learning-assessments/${active.id}/publication`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ published }) }); const body = await readResponse(response);
    if (!response.ok) { setState("error"); setError(body.error === "INVALID_QUESTION" ? (ar ? "أكمل جميع الأسئلة قبل النشر." : "Complétez toutes les questions avant publication.") : (ar ? "تعذر تغيير حالة النشر." : "Impossible de modifier la publication.")); return; }
    updateActive((assessment) => ({ ...assessment, published })); setEditing(null); setState("saved");
  }
  async function deleteQuestion(questionId: string) {
    if (!active || !window.confirm(ar ? "هل تريد حذف هذا السؤال؟" : "Supprimer cette question ?")) return; setState("saving");
    const response = await fetch(`/api/admin/learning-assessments/${active.id}/questions/${questionId}`, { method: "DELETE" }); if (!response.ok) { setState("error"); setError(ar ? "تعذر حذف السؤال." : "Impossible de supprimer la question."); return; }
    updateActive((assessment) => ({ ...assessment, questions: assessment.questions.filter((question) => question.id !== questionId) })); setEditing(null); setState("saved");
  }
  async function deleteAssessment() {
    if (!active || active.attemptCount > 0 || !window.confirm(ar ? "هل تريد حذف هذا الاختبار؟" : "Supprimer ce quiz ?")) return; setState("saving");
    const response = await fetch(`/api/admin/learning-assessments/${active.id}`, { method: "DELETE" }); if (!response.ok) { setState("error"); setError(ar ? "تعذر حذف الاختبار." : "Impossible de supprimer le quiz."); return; }
    const remaining = assessments.filter((assessment) => assessment.id !== active.id); setAssessments(remaining); setActiveId(remaining[0]?.id ?? ""); setEditing(null); setState("saved");
  }

  return <div className="admin-assessment-builder">
    <details className="assessment-create-panel" open={!assessments.length}><summary><span aria-hidden="true">+</span>{assessments.length ? (ar ? "اختبار جديد" : "Nouveau quiz") : (ar ? "إنشاء التقييم الأول" : "Créer la première évaluation")}</summary><AssessmentCreateForm ar={ar} onSubmit={createAssessment}/></details>
    {active ? <>
      <section className="assessment-overview" aria-labelledby="assessment-builder-title">
        <div className="assessment-overview-main"><div><span className="assessment-section-label">{ar ? "اختبار / تقييم" : "QUIZ / ÉVALUATION"}</span><h3 id="assessment-builder-title">{ar ? active.titleAr : active.titleFr}</h3><p>{ar ? active.instructionsAr : active.instructionsFr}</p></div><label className="assessment-picker"><span>{ar ? "التقييم" : "Évaluation"}</span><select value={active.id} onChange={(event) => { setActiveId(event.target.value); setEditing(null); }}>{assessments.map((assessment) => <option value={assessment.id} key={assessment.id}>{ar ? assessment.titleAr : assessment.titleFr}</option>)}</select></label></div>
        <dl className="assessment-summary-strip"><div><dt>{ar ? "الأسئلة" : "Questions"}</dt><dd>{active.questions.length}</dd></div><div><dt>{ar ? "إجمالي النقاط" : "Total points"}</dt><dd>{readiness?.totalPoints ?? 0}</dd></div><div><dt>{ar ? "درجة النجاح" : "Seuil"}</dt><dd>{active.passingScore}%</dd></div><div><dt>{ar ? "المحاولات" : "Tentatives"}</dt><dd>{active.maxAttempts}</dd></div><div><dt>{ar ? "الحالة" : "Statut"}</dt><dd><span className={`admin-status ${active.published ? "is-success" : "is-neutral"}`}>{active.published ? (ar ? "منشور" : "Publié") : (ar ? "مسودة" : "Brouillon")}</span></dd></div></dl>
        <div className={`assessment-readiness ${readiness?.ready ? "is-ready" : "is-incomplete"}`}><div><Icon name={readiness?.ready ? "check" : "shield"} size={20}/><span><strong>{readiness?.ready ? (ar ? "جاهز للنشر" : "Prêt à publier") : (ar ? "التكوين غير مكتمل" : "Configuration incomplète")}</strong><small>{readiness?.ready ? (ar ? "جميع الأسئلة مكتملة." : "Toutes les questions sont configurées.") : (ar ? `${active.questions.length - (readiness?.completeQuestions ?? 0)} أسئلة تحتاج إلى إكمال.` : `${active.questions.length - (readiness?.completeQuestions ?? 0)} question(s) à compléter.`)}</small></span></div><div className="assessment-overview-actions"><SaveNotice state={state} ar={ar} error={error}/><button type="button" className="btn btn-secondary" onClick={() => publication(!active.published)} disabled={!active.published && !readiness?.ready}>{active.published ? (ar ? "إلغاء النشر" : "Dépublier") : (ar ? "نشر" : "Publier")}</button><button type="button" className="btn btn-ghost" onClick={deleteAssessment} disabled={active.attemptCount > 0} title={active.attemptCount > 0 ? (ar ? "لا يمكن حذف تقييم له محاولات" : "Un quiz avec des tentatives ne peut pas être supprimé") : undefined}>{ar ? "حذف" : "Supprimer"}</button></div></div>
      </section>
      <details className="assessment-settings" open={!active.questions.length}><summary><span><strong>{ar ? "المعلومات العامة" : "Informations générales"}</strong><small>{active.timeLimitSeconds / 60} {ar ? "دقيقة" : "min"} · {active.passingScore}% · {active.maxAttempts} {ar ? "محاولات" : "tentatives"}</small></span><Icon name="chevron" size={17}/></summary><form onSubmit={saveSettings} className="assessment-settings-form"><div className="assessment-bilingual-grid"><label><span>Titre FR</span><input name="titleFr" defaultValue={active.titleFr} required minLength={3}/></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" lang="ar" defaultValue={active.titleAr} required minLength={3}/></label></div><div className="assessment-bilingual-grid"><label><span>Instructions FR</span><textarea name="instructionsFr" defaultValue={active.instructionsFr} rows={3}/></label><label><span>التعليمات AR</span><textarea name="instructionsAr" dir="rtl" lang="ar" defaultValue={active.instructionsAr} rows={3}/></label></div><div className="assessment-compact-fields"><label><span>{ar ? "المدة (دقائق)" : "Durée (minutes)"}</span><input name="timeLimitMinutes" type="number" min="1" max="240" defaultValue={active.timeLimitSeconds / 60} required/></label><label><span>{ar ? "درجة النجاح" : "Seuil de réussite (%)"}</span><input name="passingScore" type="number" min="0" max="100" defaultValue={active.passingScore} required/></label><label><span>{ar ? "الحد الأقصى للمحاولات" : "Maximum de tentatives"}</span><input name="maxAttempts" type="number" min="1" max="10" defaultValue={active.maxAttempts} required/></label></div><div className="assessment-settings-footer"><p>{locked ? (active.attemptCount > 0 ? (ar ? "الإعدادات مقفلة لأن محاولات موجودة." : "Paramètres verrouillés car des tentatives existent.") : (ar ? "ألغِ النشر قبل تعديل الإعدادات." : "Dépubliez le quiz avant de modifier ses paramètres.")) : (ar ? "تُحفظ التغييرات على هذا التقييم فقط." : "Les modifications concernent uniquement cette évaluation.")}</p><button className="btn btn-primary" disabled={locked || state === "saving"}>{ar ? "حفظ التغييرات" : "Enregistrer les modifications"}</button></div></form></details>
      {locked ? <div className="assessment-lock-notice"><Icon name="shield" size={19}/><div><strong>{active.attemptCount > 0 ? (ar ? "الأسئلة مقفلة" : "Questions verrouillées") : (ar ? "التقييم منشور" : "Évaluation publiée")}</strong><p>{active.attemptCount > 0 ? (ar ? `توجد ${active.attemptCount} محاولات. لا يمكن تغيير الأسئلة أو الإجابات أو التنقيط.` : `${active.attemptCount} tentative(s) existe(nt). Les questions, réponses et points ne peuvent plus être modifiés.`) : (ar ? "ألغِ النشر لتعديل البنية، ما دام لا توجد محاولات." : "Dépubliez pour modifier la structure, tant qu’aucune tentative n’existe.")}</p></div></div> : null}
      <section className="assessment-question-section" aria-labelledby="assessment-questions-title"><header><div><h3 id="assessment-questions-title">{ar ? "الأسئلة" : "Questions"}</h3><p>{ar ? "يُفتح سؤال واحد فقط للحفاظ على سرعة المحرر." : "Un seul éditeur est ouvert à la fois pour préserver la rapidité."}</p></div><span>{readiness?.completeQuestions}/{active.questions.length} {ar ? "مكتملة" : "configurées"}</span></header><div className="assessment-question-list">
        {active.questions.map((question, index) => {
          const complete = isQuestionComplete(question); const open = editing?.questionId === question.id;
          return <article className={`assessment-question-card ${open ? "is-open" : ""}`} key={question.id}>
            <button type="button" className="assessment-question-summary" aria-expanded={open} onClick={() => setEditing(open ? null : { questionId: question.id })}><span className="assessment-question-number">{String(index + 1).padStart(2, "0")}</span><span className="assessment-question-copy"><strong>{ar ? question.promptAr : question.promptFr}</strong><small>{question.options.length} {ar ? "إجابات" : "réponses"} · {question.points} {question.points === 1 ? (ar ? "نقطة" : "point") : (ar ? "نقاط" : "points")}</small></span><span className={`assessment-question-status ${complete ? "is-complete" : "is-incomplete"}`}><Icon name={complete ? "check" : "shield"} size={15}/>{complete ? (ar ? "مكتمل" : "Configurée") : (ar ? "غير مكتمل" : "Incomplète")}</span><Icon name="chevron" size={17} className="assessment-disclosure-icon"/></button>
            {open ? <div className="assessment-question-body">{locked ? <QuestionAuditView locale={locale} question={question}/> : <><QuestionEditor key={question.id} locale={locale} assessmentId={active.id} initial={toDraft(question)} nextPosition={question.position} onCancel={() => setEditing(null)} onSaved={(saved) => { updateActive((assessment) => ({ ...assessment, questions: assessment.questions.map((item) => item.id === saved.id ? saved : item).sort((a, b) => a.position - b.position) })); setEditing(null); }}/><div className="assessment-question-secondary-actions"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ duplicate: question })}>{ar ? "تكرار" : "Dupliquer"}</button><button type="button" className="btn btn-ghost btn-sm is-danger" onClick={() => deleteQuestion(question.id)}>{ar ? "حذف السؤال" : "Supprimer la question"}</button></div></>}</div> : null}
          </article>;
        })}
        {!active.questions.length && !editing ? <div className="assessment-empty-state"><Icon name="award" size={26}/><strong>{ar ? "ابدأ بالسؤال الأول" : "Commencez par la première question"}</strong><p>{ar ? "سيتم إعداد ثلاثة خيارات تلقائياً لسؤال الاختيار الواحد." : "Trois réponses sont préparées automatiquement pour un choix unique."}</p></div> : null}
      </div>
      {!locked && editing && !editing.questionId ? <QuestionEditor key={editing.duplicate?.id ?? "new"} locale={locale} assessmentId={active.id} initial={editing.duplicate ? { ...toDraft(editing.duplicate), id: undefined, position: Math.max(0, ...active.questions.map((question) => question.position)) + 1 } : undefined} nextPosition={Math.max(0, ...active.questions.map((question) => question.position)) + 1} onCancel={() => setEditing(null)} onSaved={(saved) => { updateActive((assessment) => ({ ...assessment, questions: [...assessment.questions, saved].sort((a, b) => a.position - b.position) })); setEditing(null); }}/> : null}
      {!locked && !editing ? <button ref={addQuestionRef} type="button" className="assessment-add-question" onClick={() => setEditing({})}><span aria-hidden="true">+</span>{ar ? "إضافة سؤال" : "Ajouter une question"}</button> : null}</section>
    </> : null}
  </div>;
}

function AssessmentCreateForm({ ar, onSubmit }: { ar: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="assessment-create-form" onSubmit={onSubmit}><div className="assessment-bilingual-grid"><label><span>Titre FR</span><input name="titleFr" required minLength={3}/></label><label><span>العنوان AR</span><input name="titleAr" dir="rtl" lang="ar" required minLength={3}/></label></div><div className="assessment-bilingual-grid"><label><span>Instructions FR</span><textarea name="instructionsFr" rows={2}/></label><label><span>التعليمات AR</span><textarea name="instructionsAr" dir="rtl" lang="ar" rows={2}/></label></div><div className="assessment-compact-fields"><label><span>{ar ? "المدة (دقائق)" : "Durée (minutes)"}</span><input name="timeLimitMinutes" type="number" min="1" max="240" defaultValue="15" required/></label><label><span>{ar ? "درجة النجاح" : "Seuil (%)"}</span><input name="passingScore" type="number" min="0" max="100" defaultValue="70" required/></label><label><span>{ar ? "المحاولات" : "Tentatives"}</span><input name="maxAttempts" type="number" min="1" max="10" defaultValue="3" required/></label></div><button className="btn btn-primary">{ar ? "إنشاء الاختبار" : "Créer le quiz"}</button></form>;
}
