"use client";

import { useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Locale } from "@/types";

export function MarkLessonCompleteButton({
  lessonId,
  initiallyCompleted,
  locale,
  nextHref,
  hasNextLesson,
}: {
  lessonId: string;
  initiallyCompleted: boolean;
  locale: Locale;
  nextHref?: string;
  hasNextLesson?: boolean;
}) {
  const ar = locale === "ar";
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [loading, setLoading] = useState(false);

  async function handleComplete() {
    setLoading(true);
    try {
      const response = await fetch("/api/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          watchedSeconds: 1,
          completed: true,
        }),
      });

      if (response.ok) {
        const result = (await response.json()) as {
          courseCompleted?: boolean;
        };
        setCompleted(true);
        confetti({ particleCount: 120, spread: 75, origin: { y: 0.6 } });
        if (result.courseCompleted) {
          confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 } });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {!completed ? (
        <button
          type="button"
          onClick={handleComplete}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[#082D55] bg-[#082D55] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#061F3D] disabled:opacity-60"
        >
          <CheckCircle2 size={15} className="text-[#C9913F]" />
          <span>
            {loading
              ? ar
                ? "جارٍ التأكيد..."
                : "Validation..."
              : ar
              ? "تأكيد إكمال الدرس والمتابعة"
              : "Marquer comme terminé et continuer"}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span>{ar ? "تم إكمال الدرس بنجاح" : "Leçon validée ✓"}</span>
          </span>

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C9913F] bg-[#C9913F] px-4 py-1.5 text-xs font-semibold text-[#082D55] shadow-xs hover:bg-[#e2bd7d]"
            >
              <span>
                {hasNextLesson
                  ? ar
                    ? "الدرس التالي"
                    : "Leçon suivante"
                  : ar
                  ? "بدء التقييم النهائي"
                  : "Passer à l'évaluation"}
              </span>
              <ArrowRight size={14} className="rtl:rotate-180" />
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
