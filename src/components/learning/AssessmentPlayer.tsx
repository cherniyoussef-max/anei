"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types";

type Option = { id: string; questionId: string; textFr: string; textAr: string; position: number };
type Question = { id: string; promptFr: string; promptAr: string; type: string; position: number; points: number; options: Option[] };
type AssessmentData = {
  assessment: { id: string; titleFr: string; titleAr: string; instructionsFr: string; instructionsAr: string; timeLimitSeconds: number; passingScore: number; maxAttempts: number };
  questions: Question[];
};
type Attempt = { id: string; expiresAt: string; attemptNumber: number };
type Result = { percentage: number; passed: boolean; rawPoints: number; maxPoints: number };
type Phase = "starting" | "in_progress" | "submitting" | "result" | "error";

function formatSeconds(total: number) {
  const minutes = Math.floor(Math.max(0, total) / 60);
  const seconds = Math.max(0, total) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function AssessmentPlayer({ locale, data }: { locale: Locale; data: AssessmentData }) {
  const ar = locale === "ar";
  const [phase, setPhase] = useState<Phase>("starting");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(data.assessment.timeLimitSeconds);
  const [result, setResult] = useState<Result | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      const response = await fetch(`/api/learning/assessments/${data.assessment.id}/attempts`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (cancelled) return;
      if (!response.ok || body.kind !== "ok") { setErrorCode(body.error ?? "ERROR"); setPhase("error"); return; }
      setAttempt(body.attempt);
      setPhase("in_progress");
    }
    start();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "in_progress" || !attempt) return;
    const expiresAt = new Date(attempt.expiresAt).getTime();
    const tick = () => setRemainingSeconds(Math.max(0, Math.round((expiresAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phase, attempt]);

  const answeredCount = useMemo(() => Object.values(answers).filter((selected) => selected.length > 0).length, [answers]);
  const allAnswered = answeredCount === data.questions.length;

  function selectSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: [optionId] }));
  }

  function toggleMultiple(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId];
      return { ...prev, [questionId]: next };
    });
  }

  async function submit() {
    if (!attempt || !allAnswered) return;
    setPhase("submitting");
    const response = await fetch(`/api/learning/attempts/${attempt.id}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: data.questions.map((question) => ({ questionId: question.id, optionIds: answers[question.id] ?? [] })) }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !body.attempt) { setErrorCode(body.error ?? "ERROR"); setPhase("error"); return; }
    setResult({ percentage: body.attempt.percentage, passed: body.attempt.passed, rawPoints: body.attempt.rawPoints, maxPoints: body.attempt.maxPoints });
    setPhase("result");
  }

  if (phase === "starting") return <p className="admin-help">{ar ? "جارٍ التحضير..." : "Préparation du quiz..."}</p>;

  if (phase === "error") return <div className="form-error" role="alert">
    {errorCode === "MAX_ATTEMPTS" ? (ar ? "لقد استنفدت عدد المحاولات المسموح بها." : "Vous avez atteint le nombre maximal de tentatives.")
      : errorCode === "EXPIRED" ? (ar ? "انتهت مدة المحاولة." : "Le temps imparti est écoulé.")
      : errorCode === "FORBIDDEN" ? (ar ? "غير مسموح لك بإجراء هذا التقييم." : "Vous n’êtes pas autorisé à passer ce quiz.")
      : (ar ? "حدث خطأ. حاول مرة أخرى." : "Une erreur est survenue. Réessayez.")}
  </div>;

  if (phase === "result" && result) return <div className="learning-assessment-result">
    <h1>{ar ? data.assessment.titleAr : data.assessment.titleFr}</h1>
    <p className={result.passed ? "success-inline" : "form-error"}>
      {result.percentage}% · {result.rawPoints}/{result.maxPoints} {ar ? "نقطة" : "points"} · {result.passed ? (ar ? "ناجح" : "Réussi") : (ar ? "غير ناجح" : "Non réussi")}
    </p>
  </div>;

  return <div className="learning-assessment-player">
    <header className="learning-assessment-head">
      <h1>{ar ? data.assessment.titleAr : data.assessment.titleFr}</h1>
      <div className="learning-progress-card" aria-label={formatSeconds(remainingSeconds)}>
        <strong>{formatSeconds(remainingSeconds)}</strong>
        <span>{ar ? "الوقت المتبقي" : "temps restant"}</span>
      </div>
    </header>
    {(ar ? data.assessment.instructionsAr : data.assessment.instructionsFr) ? <p>{ar ? data.assessment.instructionsAr : data.assessment.instructionsFr}</p> : null}
    <div className="learning-assessment-questions">
      {data.questions.map((question, index) => <fieldset key={question.id} className="learning-assessment-question">
        <legend>{ar ? "سؤال" : "Question"} {index + 1}/{data.questions.length} · {question.points} pts</legend>
        <p>{ar ? question.promptAr : question.promptFr}</p>
        {question.options.map((option) => <label key={option.id} className="learning-assessment-option">
          <input
            type={question.type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
            name={`question-${question.id}`}
            checked={(answers[question.id] ?? []).includes(option.id)}
            onChange={() => question.type === "MULTIPLE_CHOICE" ? toggleMultiple(question.id, option.id) : selectSingle(question.id, option.id)}
          />
          <span>{ar ? option.textAr : option.textFr}</span>
        </label>)}
      </fieldset>)}
    </div>
    <button className="btn btn-primary" disabled={!allAnswered || phase === "submitting"} onClick={submit}>
      {phase === "submitting" ? (ar ? "جارٍ الإرسال..." : "Envoi...") : (ar ? `إرسال الإجابات (${answeredCount}/${data.questions.length})` : `Envoyer mes réponses (${answeredCount}/${data.questions.length})`)}
    </button>
    {remainingSeconds <= 0 ? <p className="form-error">{ar ? "انتهى الوقت. أرسل إجاباتك الآن." : "Le temps est écoulé. Envoyez vos réponses maintenant."}</p> : null}
  </div>;
}
