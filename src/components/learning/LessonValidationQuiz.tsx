"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, RotateCcw, Award, Play, AlertCircle, ArrowRight } from "lucide-react";
import type { Locale } from "@/types";

export type QuizQuestionItem = {
  id: string;
  promptFr: string;
  promptAr: string;
  type: string;
  options: Array<{ id: string; textFr: string; textAr: string }>;
  correctOptionIds: string[];
  explanationFr: string;
  explanationAr: string;
  timestampSeconds: number | null;
  position: number;
};

export type BestQuizAttempt = {
  id: string;
  scorePercentage: number;
  passed: boolean;
  completedAt: Date | string;
} | null;

interface LessonValidationQuizProps {
  lessonId: string;
  questions: QuizQuestionItem[];
  bestAttempt: BestQuizAttempt;
  locale: Locale;
  onPassed?: () => void;
}

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonValidationQuiz({
  lessonId,
  questions,
  bestAttempt,
  locale,
  onPassed,
}: LessonValidationQuizProps) {
  const isAr = locale === "ar";
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    scorePercentage: number;
    passed: boolean;
    correctCount: number;
    totalQuestions: number;
    questionResults: Record<
      string,
      { isCorrect: boolean; correctOptionIds: string[]; explanationFr: string; explanationAr: string }
    >;
    addedToReviewQueueCount: number;
  } | null>(null);

  const handleSelectOption = (questionId: string, optionId: string) => {
    if (result) return; // locked after submission until retry
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleSeekVideo = (seconds: number) => {
    window.dispatchEvent(new CustomEvent("anei:seek-video", { detail: { seconds } }));
  };

  const allAnswered = questions.every((q) => Boolean(selectedAnswers[q.id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;

    setSubmitting(true);
    try {
      // Map responses to array format expected by endpoint
      const formattedResponses: Record<string, string[]> = {};
      for (const [qId, optId] of Object.entries(selectedAnswers)) {
        formattedResponses[qId] = [optId];
      }

      const res = await fetch("/api/learning/quiz-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          responses: formattedResponses,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResult(json);
        if (json.passed && onPassed) {
          onPassed();
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setSelectedAnswers({});
  };

  if (!questions.length) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-2xs space-y-6">
      {/* Quiz Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0056D2] text-white flex items-center justify-center shadow-2xs">
            <Award size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#0056D2] uppercase tracking-wider block">
              {isAr ? "تحقق فوري من الفهم" : "Quiz de validation formative"}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#0A192F]">
              {isAr ? "اختبار التثبيت البيداغوجي" : "Contrôle des connaissances"}
            </h3>
          </div>
        </div>

        {bestAttempt && !result && (
          <div className="text-end">
            <span className="text-xs text-slate-500 block">
              {isAr ? "أفضل نتيجة سابقة" : "Meilleur résultat"}
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-0.5 ${
                bestAttempt.passed
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              {bestAttempt.scorePercentage}% ({bestAttempt.passed ? (isAr ? "ناجح" : "Validé") : (isAr ? "غير كافٍ" : "À perfectionner")})
            </span>
          </div>
        )}
      </div>

      {/* Result Banner if submitted */}
      {result && (
        <div
          className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            result.passed
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.passed ? (
              <CheckCircle2 size={24} className="text-emerald-600 flex-none mt-0.5" />
            ) : (
              <AlertCircle size={24} className="text-amber-600 flex-none mt-0.5" />
            )}
            <div>
              <strong className="text-sm sm:text-base font-bold block">
                {result.passed
                  ? isAr
                    ? `تهانينا! حققت نسبة ${result.scorePercentage}% (${result.correctCount}/${result.totalQuestions})`
                    : `Bravo ! Vous avez validé ce quiz avec ${result.scorePercentage}% (${result.correctCount}/${result.totalQuestions})`
                  : isAr
                  ? `النتيجة: ${result.scorePercentage}% (${result.correctCount}/${result.totalQuestions}) — العتبة المطلوبة 80%`
                  : `Score obtenu : ${result.scorePercentage}% (${result.correctCount}/${result.totalQuestions}) — Seuil de maîtrise : 80%`}
              </strong>
              <p className="text-xs sm:text-sm mt-0.5 opacity-90 leading-relaxed">
                {result.passed
                  ? isAr
                    ? "أظهرت استيعاباً ممتازاً للمفاهيم التشخيصية والبيداغوجية لهذا الدرس."
                    : "Vous maîtrisez les concepts fondamentaux de cette leçon. Consultez les explications détaillées ci-dessous."
                  : isAr
                  ? `المفاهيم التي تحتاج إلى ترسيخ أُضيفت تلقائياً إلى جلستك اليومية للمراجعة المتباعدة (+${result.addedToReviewQueueCount} بطاقة).`
                  : `Les notions non validées ont été automatiquement ajoutées à votre session de révision quotidienne (+${result.addedToReviewQueueCount} carte(s)).`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRetry}
            className="self-end sm:self-center px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
          >
            <RotateCcw size={13} />
            <span>{isAr ? "إعادة المحاولة" : "Retenter le quiz"}</span>
          </button>
        </div>
      )}

      {/* Questions Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {questions.map((question, qIdx) => {
          const prompt = isAr ? question.promptAr : question.promptFr;
          const qResult = result?.questionResults[question.id];
          const isCorrect = qResult?.isCorrect;
          const userSelectedOption = selectedAnswers[question.id];

          return (
            <div
              key={question.id}
              className={`p-4 sm:p-5 rounded-xl border transition-all ${
                result
                  ? isCorrect
                    ? "border-emerald-200 bg-emerald-50/20"
                    : "border-red-200 bg-red-50/20"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Question title */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex-none h-6 w-6 rounded-md bg-[#0056D2] text-white text-xs font-bold grid place-items-center mt-0.5">
                    {qIdx + 1}
                  </span>
                  <h4 className="text-sm sm:text-base font-bold text-[#0A192F] leading-snug">
                    {prompt}
                  </h4>
                </div>

                {result && (
                  <span className="flex-none">
                    {isCorrect ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={13} />
                        <span>{isAr ? "صحيح" : "Correct"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-100/70 px-2 py-0.5 rounded-md">
                        <XCircle size={13} />
                        <span>{isAr ? "غير صحيح" : "Incorrect"}</span>
                      </span>
                    )}
                  </span>
                )}
              </div>

              {/* Options list */}
              <div className="space-y-2 ps-0 sm:ps-8">
                {question.options.map((opt) => {
                  const optText = isAr ? opt.textAr : opt.textFr;
                  const isChecked = userSelectedOption === opt.id;
                  const isThisCorrect = question.correctOptionIds.includes(opt.id);

                  let optionBorder = "border-slate-200 hover:border-[#0056D2] bg-white";
                  let optionBadge = "bg-slate-100 text-slate-700";

                  if (result) {
                    if (isThisCorrect) {
                      optionBorder = "border-emerald-500 bg-emerald-50 text-emerald-950 font-medium";
                      optionBadge = "bg-emerald-600 text-white";
                    } else if (isChecked && !isThisCorrect) {
                      optionBorder = "border-red-300 bg-red-50 text-red-900";
                      optionBadge = "bg-red-500 text-white";
                    } else {
                      optionBorder = "border-slate-100 bg-slate-50/50 text-slate-400 opacity-60";
                    }
                  } else if (isChecked) {
                    optionBorder = "border-[#0056D2] bg-[#F0F6FF] text-[#0056D2] font-semibold";
                    optionBadge = "bg-[#0056D2] text-white";
                  }

                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleSelectOption(question.id, opt.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs sm:text-sm cursor-pointer transition-all select-none ${optionBorder}`}
                    >
                      <span
                        className={`h-4 w-4 rounded-full border flex items-center justify-center flex-none ${optionBadge}`}
                      >
                        {isChecked && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                      </span>
                      <span className="flex-1">{optText}</span>
                    </label>
                  );
                })}
              </div>

              {/* Explanation upon submission */}
              {result && (
                <div className="mt-4 pt-3 border-t border-slate-200/60 ps-0 sm:ps-8 space-y-2">
                  <div className="p-3 bg-white/90 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <strong className="block text-[#0A192F] font-semibold mb-1">
                      {isAr ? "التفسير البيداغوجي والسريري:" : "Explication pédagogique :"}
                    </strong>
                    {isAr ? question.explanationAr : question.explanationFr}
                  </div>

                  {question.timestampSeconds !== null && (
                    <button
                      type="button"
                      onClick={() => handleSeekVideo(question.timestampSeconds!)}
                      className="text-xs font-semibold text-[#0056D2] hover:text-[#00419e] inline-flex items-center gap-1.5 transition-colors cursor-pointer group"
                    >
                      <Play size={12} className="fill-[#0056D2]" />
                      <span>
                        {isAr ? "شاهد هذا المقطع في الفيديو مجدداً" : "Revoir le passage vidéo explicatif"} (
                        <span dir="ltr">{formatSeconds(question.timestampSeconds)}</span>)
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Submit Action */}
        {!result && (
          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-500">
              {Object.keys(selectedAnswers).length}/{questions.length}{" "}
              {isAr ? "أسئلة تمت الإجابة عنها" : "questions renseignées"}
            </span>

            <button
              type="submit"
              disabled={!allAnswered || submitting}
              className="h-10 px-5 rounded-xl bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
            >
              <span>{submitting ? (isAr ? "جارٍ التحقق..." : "Vérification...") : (isAr ? "تأكيد إجاباتي" : "Valider mes réponses")}</span>
              <ArrowRight size={15} className="rtl:rotate-180" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
