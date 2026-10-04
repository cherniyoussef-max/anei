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
          className="inline-flex items-center gap-2 rounded-lg border border-[#0056D2] bg-white px-4 py-2 text-xs font-bold text-[#0056D2] shadow-xs transition hover:bg-[#F0F6FF] disabled:opacity-60"
        >
          <CheckCircle2 size={15} className="text-[#0056D2]" />
          <span>
            {loading
              ? ar
                ? "جارٍ التأكيد..."
                : "Validation..."
              : ar
              ? "تأكيد إكمال الدرس والمتابعة"
              : "Marquer comme terminée"}
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#BCE6B5] bg-[#E0F4DC] px-3.5 py-1.5 text-xs font-bold text-[#197D12]">
            <CheckCircle2 size={14} className="text-[#197D12]" />
            <span>{ar ? "تم إكمال الدرس بنجاح" : "Leçon validée ✓"}</span>
          </span>

          {nextHref ? (
            <Link
              href={nextHref}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0056D2] bg-[#0056D2] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#00419E]"
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
