"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Sparkles, Brain, Check, Lightbulb } from "lucide-react";
import type { Locale } from "@/types";

export type DailyReviewCard = {
  cardId: string;
  conceptFr: string;
  conceptAr: string;
  definitionFr: string;
  definitionAr: string;
  contextScenarioFr: string | null;
  contextScenarioAr: string | null;
  lessonTitleFr: string;
  lessonTitleAr: string;
  courseSlug: string;
};

interface DailyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
  initialCards?: DailyReviewCard[];
}

export function DailyReviewModal({
  isOpen,
  onClose,
  locale,
  initialCards = [],
}: DailyReviewModalProps) {
  const isAr = locale === "ar";
  const [cards, setCards] = useState<DailyReviewCard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [loading, setLoading] = useState(initialCards.length === 0);

  // Fetch due cards if none provided
  useEffect(() => {
    if (!isOpen || cards.length > 0) return;

    let mounted = true;
    fetch("/api/learning/reviews")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data.cards && Array.isArray(data.cards)) {
          setCards(data.cards);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, cards.length]);

  const currentCard = cards[currentIndex];

  const handleRateGrade = useCallback(async (grade: number) => {
    if (!currentCard || submitting) return;

    setSubmitting(true);
    try {
      await fetch("/api/learning/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: currentCard.cardId,
          grade,
        }),
      });

      setReviewedCount((prev) => prev + 1);

      if (currentIndex + 1 < cards.length) {
        setCurrentIndex((prev) => prev + 1);
        setIsFlipped(false);
      } else {
        setSessionCompleted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }, [currentCard, submitting, currentIndex, cards.length]);

  // Keyboard navigation: Space to flip, 1/2/3/4 to rate, Esc to close
  useEffect(() => {
    if (!isOpen || sessionCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === " " && !isFlipped) {
        e.preventDefault();
        setIsFlipped(true);
      } else if (isFlipped && !submitting) {
        if (e.key === "1") {
          e.preventDefault();
          void handleRateGrade(1);
        } else if (e.key === "2") {
          e.preventDefault();
          void handleRateGrade(2);
        } else if (e.key === "3") {
          e.preventDefault();
          void handleRateGrade(3);
        } else if (e.key === "4") {
          e.preventDefault();
          void handleRateGrade(4);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFlipped, submitting, sessionCompleted, handleRateGrade, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-review-modal-title"
    >
      <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#0056D2] text-white flex items-center justify-center shadow-2xs">
              <Brain size={18} />
            </div>
            <div>
              <h2 id="daily-review-modal-title" className="text-sm font-bold text-[#0A192F]">
                {isAr ? "المراجعة المتباعدة اليومية" : "Révision active quotidienne"}
              </h2>
              <span className="text-[11px] text-slate-500">
                {isAr ? "خوارزمية التثبيت العصبي SM-2" : "Algorithme d&apos;ancrage mémoriel SM-2"}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full grid place-items-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            aria-label={isAr ? "إغلاق" : "Fermer"}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <Brain className="mx-auto h-8 w-8 animate-pulse text-[#0056D2]" />
              <p className="text-sm">{isAr ? "جارٍ تحضير بطاقات اليوم..." : "Préparation de vos cartes du jour..."}</p>
            </div>
          ) : sessionCompleted || cards.length === 0 ? (
            /* Completed / Empty State */
            <div className="py-12 text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 grid place-items-center shadow-xs">
                <Check size={32} strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {cards.length === 0
                    ? isAr
                      ? "لا توجد بطاقات مستحقة للمراجعة اليوم !"
                      : "Aucune carte en attente de révision aujourd&apos;hui !"
                    : isAr
                    ? "أحسنت ! اكتملت جلسة اليوم بنجاح"
                    : "Félicitations ! Session quotidienne terminée"}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  {cards.length === 0
                    ? isAr
                      ? "جميع مفاهيمك التدريبية محدثة ومثبتة. واصل دراسة دروسك لإضافة بطاقات جديدة."
                      : "Toutes vos notions sont parfaitement ancrées. Poursuivez vos leçons pour enrichir votre mémoire à long terme."
                    : isAr
                    ? `راجعت بنجاح ${reviewedCount} بطاقة مفهوم. سيتم جدولة المراجعات القادمة تلقائياً وفق أدائك.`
                    : `Vous avez consolidé ${reviewedCount} notion(s) clé(s). Vos prochains rappels sont programmés automatiquement.`}
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-10 px-6 rounded-xl bg-[#0056D2] hover:bg-[#00419e] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
                >
                  <span>{isAr ? "تم، العودة إلى لوحة المتابعة" : "Fermer et continuer"}</span>
                </button>
              </div>
            </div>
          ) : (
            /* Active Flashcard Review */
            <div className="space-y-6">
              {/* Progress and Course context */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-[#0056D2] truncate max-w-[260px]">
                  {isAr ? currentCard.lessonTitleAr : currentCard.lessonTitleFr}
                </span>
                <span className="font-mono">
                  {currentIndex + 1} / {cards.length}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0056D2] transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                />
              </div>

              {/* The Interactive Card */}
              <div
                onClick={() => !isFlipped && setIsFlipped(true)}
                className={`min-h-[220px] p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                  isFlipped
                    ? "bg-[#F0F6FF]/60 border-[#BFDBFE] shadow-sm"
                    : "bg-white border-slate-200 hover:border-[#0056D2] shadow-2xs cursor-pointer group"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold text-[#0056D2] uppercase tracking-wider">
                      {isAr ? "مفهوم رئيسي" : "Notion clé"}
                    </span>
                    {!isFlipped && (
                      <span className="text-[11px] text-slate-400 group-hover:text-[#0056D2] transition-colors hidden sm:inline">
                        {isAr ? "اضغط مسافة للإظهار" : "Espace pour révéler"}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold text-[#0A192F] leading-snug">
                    {isAr ? currentCard.conceptAr : currentCard.conceptFr}
                  </h3>

                  {(isAr ? currentCard.contextScenarioAr : currentCard.contextScenarioFr) && (
                    <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                      <Lightbulb size={14} className="text-[#C9913F] flex-none mt-0.5" />
                      <span>{isAr ? currentCard.contextScenarioAr : currentCard.contextScenarioFr}</span>
                    </div>
                  )}
                </div>

                {/* Back side revealed */}
                {isFlipped ? (
                  <div className="mt-5 pt-4 border-t border-blue-200/80 animate-in fade-in duration-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      {isAr ? "التعريف والترسيخ السريري :" : "Définition & Démarche pédagogique :"}
                    </span>
                    <p className="text-sm text-slate-800 leading-relaxed font-medium">
                      {isAr ? currentCard.definitionAr : currentCard.definitionFr}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFlipped(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-100 group-hover:bg-[#0056D2] group-hover:text-white text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs"
                    >
                      <Sparkles size={13} />
                      <span>{isAr ? "إظهار الإجابة والشرح" : "Révéler la réponse"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Rating buttons (Visible when card is flipped) */}
              {isFlipped && (
                <div className="space-y-2 pt-2 animate-in fade-in duration-150">
                  <span className="text-xs text-slate-500 font-medium block text-center">
                    {isAr ? "كيف كان استرجاعك لهذه المعلومة ؟" : "Comment évaluez-vous votre rappel ?"}
                  </span>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRateGrade(1)}
                      className="p-2.5 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-900 text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      <span className="block">{isAr ? "أحتاج مراجعة" : "À revoir"}</span>
                      <small className="text-[10px] text-red-600 font-normal">1 (Demain)</small>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRateGrade(2)}
                      className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      <span className="block">{isAr ? "صعب" : "Difficile"}</span>
                      <small className="text-[10px] text-amber-600 font-normal">2 (~3j)</small>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRateGrade(3)}
                      className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-900 text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      <span className="block">{isAr ? "جيّد" : "Bien"}</span>
                      <small className="text-[10px] text-blue-600 font-normal">3 (~6j)</small>
                    </button>

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRateGrade(4)}
                      className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors cursor-pointer text-center"
                    >
                      <span className="block">{isAr ? "سهل ومتقن" : "Facile"}</span>
                      <small className="text-[10px] text-emerald-600 font-normal">4 (+14j)</small>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
