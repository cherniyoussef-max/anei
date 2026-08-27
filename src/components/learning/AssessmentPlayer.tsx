"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

type Option = { id: string; questionId: string; textFr: string; textAr: string; position: number };
type Question = { id: string; promptFr: string; promptAr: string; type: string; position: number; points: number; options: Option[] };
type AttemptHistory = {
  id: string; attemptNumber: number; status: string; submittedAt: string | Date | null; rawPoints: number | null;
  maxPoints: number | null; percentage: number | null; passed: boolean | null;
};
type AssessmentData = {
  assessment: { id: string; titleFr: string; titleAr: string; instructionsFr: string; instructionsAr: string; timeLimitSeconds: number; passingScore: number; maxAttempts: number };
  questions: Question[];
  attempts: AttemptHistory[];
};
type Attempt = { id: string; expiresAt: string; attemptNumber: number };
type Result = { id: string; attemptNumber: number; submittedAt: string; percentage: number; passed: boolean; rawPoints: number; maxPoints: number };
type Phase = "starting" | "in_progress" | "submitting" | "result" | "error";

function formatSeconds(total: number) {
  const minutes = Math.floor(Math.max(0, total) / 60); const seconds = Math.max(0, total) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function answerLetter(index: number) { return String.fromCharCode(65 + index); }

export function AssessmentPlayer({ locale, data, courseHref }: { locale: Locale; data: AssessmentData; courseHref: string }) {
  const ar = locale === "ar";
  const [phase, setPhase] = useState<Phase>("starting"); const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({}); const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(data.assessment.timeLimitSeconds); const [result, setResult] = useState<Result | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null); const confirmRef = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<AttemptHistory[]>(() => data.attempts.filter((item) => item.status === "GRADED"));

  const startAttempt = useCallback(async () => {
    setPhase("starting"); setErrorCode(null); setAnswers({}); setCurrentIndex(0); setResult(null);
    const response = await fetch(`/api/learning/assessments/${data.assessment.id}/attempts`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.kind !== "ok") { setErrorCode(body.error ?? "ERROR"); setPhase("error"); return; }
    setAttempt(body.attempt); setRemainingSeconds(Math.max(0, Math.round((new Date(body.attempt.expiresAt).getTime() - Date.now()) / 1000))); setPhase("in_progress");
  }, [data.assessment.id]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/learning/assessments/${data.assessment.id}/attempts`, { method: "POST" })
      .then(async (response) => ({ response, body: await response.json().catch(() => ({})) }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok || body.kind !== "ok") { setErrorCode(body.error ?? "ERROR"); setPhase("error"); return; }
        setAttempt(body.attempt); setRemainingSeconds(Math.max(0, Math.round((new Date(body.attempt.expiresAt).getTime() - Date.now()) / 1000))); setPhase("in_progress");
      })
      .catch(() => { if (!cancelled) { setErrorCode("ERROR"); setPhase("error"); } });
    return () => { cancelled = true; };
  }, [data.assessment.id]);
  useEffect(() => {
    if (phase !== "in_progress" || !attempt) return;
    const expiresAt = new Date(attempt.expiresAt).getTime();
    const tick = () => {
      const next = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemainingSeconds(next);
      if (next === 0) { setErrorCode("EXPIRED"); setPhase("error"); }
    };
    tick(); const interval = setInterval(tick, 1000); return () => clearInterval(interval);
  }, [phase, attempt]);

  const answeredCount = useMemo(() => Object.values(answers).filter((selected) => selected.length > 0).length, [answers]);
  const allAnswered = answeredCount === data.questions.length; const current = data.questions[currentIndex];
  const unanswered = useMemo(() => data.questions.map((question, index) => ({ question, number: index + 1 })).filter(({ question }) => !(answers[question.id]?.length)), [answers, data.questions]);
  const gradedHistory = history;
  const bestScore = gradedHistory.length ? Math.max(...gradedHistory.map((item) => item.percentage ?? 0)) : null;
  const attemptsUsed = Math.max(attempt?.attemptNumber ?? 0, result?.attemptNumber ?? 0, ...data.attempts.map((item) => item.attemptNumber), ...history.map((item) => item.attemptNumber));
  const attemptsRemaining = Math.max(0, data.assessment.maxAttempts - attemptsUsed);

  function selectSingle(questionId: string, optionId: string) { setAnswers((previous) => ({ ...previous, [questionId]: [optionId] })); }
  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((previous) => { const selected = previous[questionId] ?? []; return { ...previous, [questionId]: selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId] }; });
  }
  async function submit() {
    if (!attempt || !allAnswered) return; confirmRef.current?.close(); setPhase("submitting");
    const response = await fetch(`/api/learning/attempts/${attempt.id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: data.questions.map((question) => ({ questionId: question.id, optionIds: answers[question.id] ?? [] })) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.attempt) { setErrorCode(body.error ?? "ERROR"); setPhase("error"); return; }
    const nextResult = { id: body.attempt.id, attemptNumber: body.attempt.attemptNumber, submittedAt: body.attempt.submittedAt, percentage: body.attempt.percentage, passed: body.attempt.passed, rawPoints: body.attempt.rawPoints, maxPoints: body.attempt.maxPoints };
    setResult(nextResult);
    setHistory((current) => current.some((item) => item.id === nextResult.id) ? current : [...current, { ...nextResult, status: "GRADED" }]);
    setPhase("result");
  }

  if (phase === "starting") return <div className="assessment-player-loading" role="status"><span/><span/><span/><p>{ar ? "جارٍ تحضير التقييم..." : "Préparation de l’évaluation..."}</p></div>;
  if (phase === "error") return <section className="assessment-player-error" role="alert"><Icon name="shield" size={28}/><h1>{errorCode === "MAX_ATTEMPTS" ? (ar ? "لا توجد محاولات متبقية" : "Aucune tentative restante") : errorCode === "EXPIRED" ? (ar ? "انتهى وقت المحاولة" : "Le temps est écoulé") : (ar ? "تعذر فتح التقييم" : "Impossible d’ouvrir l’évaluation")}</h1><p>{errorCode === "MAX_ATTEMPTS" ? (ar ? "لقد استنفدت عدد المحاولات المسموح بها." : "Vous avez utilisé toutes les tentatives autorisées.") : errorCode === "EXPIRED" ? (ar ? "لم يعد بإمكانك إرسال هذه المحاولة. عُد إلى الدورة أو ابدأ محاولة جديدة إذا كانت متاحة." : "Cette tentative ne peut plus être envoyée. Retournez au cours ou recommencez si une tentative reste disponible.") : errorCode === "FORBIDDEN" ? (ar ? "غير مسموح لك بإجراء هذا التقييم." : "Vous n’êtes pas autorisé à passer cette évaluation.") : (ar ? "حدث خطأ. حاول مرة أخرى." : "Une erreur est survenue. Réessayez.")}</p><div className="assessment-result-actions"><a className="btn btn-secondary" href={courseHref}>{ar ? "العودة إلى الدورة" : "Retour au cours"}</a>{errorCode === "EXPIRED" && attemptsRemaining > 0 ? <button className="btn btn-primary" onClick={() => void startAttempt()}>{ar ? "محاولة جديدة" : "Nouvelle tentative"}</button> : null}</div>{gradedHistory.length ? <AttemptHistoryList locale={locale} attempts={gradedHistory} bestScore={bestScore}/> : null}</section>;

  if (phase === "result" && result) return <section className={`assessment-result ${result.passed ? "is-pass" : "is-fail"}`}>
    <div className="assessment-result-heading"><span>{ar ? "اكتمل التقييم" : "Évaluation terminée"}</span><h1>{result.percentage}%</h1><strong><Icon name={result.passed ? "check" : "shield"} size={18}/>{result.passed ? (ar ? "ناجحة" : "Réussie") : (ar ? "غير ناجحة" : "Non réussie")}</strong><p>{result.rawPoints} / {result.maxPoints} {ar ? "نقطة" : "points"}</p></div>
    <div className="assessment-score-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.percentage} aria-label={ar ? "النتيجة" : "Score"}><span style={{ inlineSize: `${result.percentage}%` }}/></div>
    <dl className="assessment-result-facts"><div><dt>{ar ? "درجة النجاح" : "Seuil de réussite"}</dt><dd>{data.assessment.passingScore}%</dd></div><div><dt>{ar ? "نتيجتك" : "Votre score"}</dt><dd>{result.percentage}%</dd></div><div><dt>{ar ? "أفضل نتيجة" : "Meilleur score"}</dt><dd>{bestScore ?? result.percentage}%</dd></div><div><dt>{ar ? "المحاولة" : "Tentative"}</dt><dd>{result.attemptNumber} / {data.assessment.maxAttempts}</dd></div><div><dt>{ar ? "المحاولات المتبقية" : "Tentatives restantes"}</dt><dd>{attemptsRemaining}</dd></div></dl>
    <div className="assessment-result-actions"><a className="btn btn-secondary" href={courseHref}>{ar ? "العودة إلى الدورة" : "Retour au cours"}</a>{attemptsRemaining > 0 ? <button className="btn btn-primary" onClick={() => void startAttempt()}>{ar ? "إعادة التقييم" : "Réessayer l’évaluation"}</button> : <span className="assessment-no-attempts">{ar ? "لا توجد محاولات متبقية" : "Aucune tentative restante"}</span>}</div>
    <AttemptHistoryList locale={locale} attempts={gradedHistory} bestScore={bestScore}/>
  </section>;

  if (!current) return <div className="assessment-player-error" role="alert">{ar ? "لا توجد أسئلة في هذا التقييم." : "Cette évaluation ne contient aucune question."}</div>;
  const progress = Math.round(((currentIndex + 1) / data.questions.length) * 100);
  return <section className="assessment-player-shell">
    <header className="assessment-player-header"><div><span>{ar ? `السؤال ${currentIndex + 1} من ${data.questions.length}` : `Question ${currentIndex + 1} sur ${data.questions.length}`}</span><h1>{ar ? data.assessment.titleAr : data.assessment.titleFr}</h1></div><div className={`assessment-timer ${remainingSeconds <= 60 ? "is-urgent" : ""}`} aria-live="off"><Icon name="clock" size={18}/><span><strong>{formatSeconds(remainingSeconds)}</strong><small>{ar ? "متبقٍ" : "restantes"}</small></span></div></header>
    <div className="assessment-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label={ar ? `التقدم ${progress}%` : `Progression ${progress}%`}><span style={{ inlineSize: `${progress}%` }}/></div>
    {(ar ? data.assessment.instructionsAr : data.assessment.instructionsFr) ? <p className="assessment-player-instructions">{ar ? data.assessment.instructionsAr : data.assessment.instructionsFr}</p> : null}
    <nav className="assessment-question-navigator" aria-label={ar ? "التنقل بين الأسئلة" : "Navigation entre les questions"}>{data.questions.map((question, index) => { const answered = Boolean(answers[question.id]?.length); const selected = index === currentIndex; return <button type="button" key={question.id} className={`${selected ? "is-current" : ""} ${answered ? "is-answered" : ""}`} aria-current={selected ? "step" : undefined} aria-label={ar ? `السؤال ${index + 1}${answered ? "، تمت الإجابة" : ""}` : `Question ${index + 1}${answered ? ", répondue" : ""}`} onClick={() => setCurrentIndex(index)}>{answered && !selected ? <Icon name="check" size={14}/> : index + 1}</button>; })}</nav>
    <fieldset className="assessment-current-question"><legend>{ar ? `السؤال ${currentIndex + 1}` : `Question ${currentIndex + 1}`}<span>{current.points} {current.points === 1 ? (ar ? "نقطة" : "point") : (ar ? "نقاط" : "points")}</span></legend><h2>{ar ? current.promptAr : current.promptFr}</h2>{current.type === "MULTIPLE_CHOICE" ? <p className="assessment-selection-hint">{ar ? "اختر جميع الإجابات الصحيحة." : "Sélectionnez toutes les réponses correctes."}</p> : null}<div className="assessment-choice-list">{current.options.map((option, index) => { const checked = (answers[current.id] ?? []).includes(option.id); return <label key={option.id} className={`assessment-choice ${checked ? "is-selected" : ""}`}><input type={current.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"} name={`question-${current.id}`} checked={checked} onChange={() => current.type === "MULTIPLE_CHOICE" ? toggleMultiple(current.id, option.id) : selectSingle(current.id, option.id)}/><span className="assessment-choice-letter" aria-hidden="true">{answerLetter(index)}</span><span className="assessment-choice-text">{ar ? option.textAr : option.textFr}</span>{checked ? <Icon name="check" size={18}/> : null}</label>; })}</div></fieldset>
    <footer className="assessment-player-footer"><button type="button" className="btn btn-secondary" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={currentIndex === 0}><Icon name="chevron" size={16}/>{ar ? "السابق" : "Précédent"}</button><span><bdi>{answeredCount} / {data.questions.length}</bdi> {ar ? "تمت الإجابة" : "répondues"}</span>{currentIndex < data.questions.length - 1 ? <button type="button" className="btn btn-primary" onClick={() => setCurrentIndex((index) => Math.min(data.questions.length - 1, index + 1))}>{ar ? "التالي" : "Suivant"}<Icon name="chevron" size={16}/></button> : <button type="button" className="btn btn-primary" onClick={() => confirmRef.current?.showModal()}>{ar ? "إنهاء التقييم" : "Terminer l’évaluation"}</button>}</footer>
    <dialog ref={confirmRef} className="assessment-submit-dialog" aria-labelledby="assessment-submit-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}><div><button type="button" className="assessment-dialog-close" onClick={() => confirmRef.current?.close()} aria-label={ar ? "إغلاق" : "Fermer"}><Icon name="close" size={18}/></button><Icon name="shield" size={24}/><h2 id="assessment-submit-title">{ar ? "إرسال تقييمك؟" : "Soumettre votre évaluation ?"}</h2><p><strong><bdi>{answeredCount} / {data.questions.length}</bdi></strong> {ar ? "أسئلة تمت الإجابة عنها" : "questions répondues"}</p>{unanswered.length ? <p className="assessment-dialog-warning">{ar ? `الأسئلة ${unanswered.map((item) => item.number).join("، ")} دون إجابة.` : `Questions ${unanswered.map((item) => item.number).join(", ")} sans réponse.`}</p> : <p>{ar ? "بعد الإرسال، سيتم تقييم إجاباتك على الخادم." : "Après l’envoi, vos réponses seront évaluées par le serveur."}</p>}<div className="assessment-dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => confirmRef.current?.close()}>{ar ? "عودة" : "Retour"}</button><button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={!allAnswered || phase === "submitting"}>{ar ? "إرسال التقييم" : "Soumettre l’évaluation"}</button></div></div></dialog>
  </section>;
}

function AttemptHistoryList({ locale, attempts, bestScore }: { locale: Locale; attempts: AttemptHistory[]; bestScore: number | null }) {
  const ar = locale === "ar";
  return <section className="assessment-attempt-history" aria-labelledby="attempt-history-title"><header><div><h2 id="attempt-history-title">{ar ? "محاولاتي" : "Mes tentatives"}</h2><p>{ar ? "النتائج المحسوبة والمسجلة على الخادم." : "Résultats calculés et enregistrés par le serveur."}</p></div>{bestScore !== null ? <strong>{ar ? "أفضل نتيجة" : "Meilleur score"} : {bestScore}%</strong> : null}</header><div className="assessment-attempt-table" role="table"><div role="row" className="is-header"><span role="columnheader">#</span><span role="columnheader">{ar ? "النتيجة" : "Score"}</span><span role="columnheader">{ar ? "الحالة" : "Résultat"}</span><span role="columnheader">{ar ? "التاريخ" : "Date"}</span></div>{attempts.map((attempt) => <div role="row" key={attempt.id}><span role="cell">#{attempt.attemptNumber}</span><strong role="cell">{attempt.percentage}%</strong><span role="cell" className={attempt.passed ? "is-pass" : "is-fail"}>{attempt.passed ? (ar ? "ناجحة" : "Réussie") : (ar ? "غير ناجحة" : "Non réussie")}</span><time role="cell" dateTime={attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : undefined}>{attempt.submittedAt ? new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-TN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(attempt.submittedAt)) : "-"}</time></div>)}</div></section>;
}
