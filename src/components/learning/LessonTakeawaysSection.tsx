"use client";

import { Play, Sparkles, Printer } from "lucide-react";
import type { Locale } from "@/types";

function formatSeconds(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type TakeawayItem = {
  id: string;
  titleFr: string;
  titleAr: string;
  summaryFr: string;
  summaryAr: string;
  timestampSeconds: number;
  position: number;
  isDraft: boolean;
};

interface LessonTakeawaysSectionProps {
  takeaways: TakeawayItem[];
  onSeek?: (seconds: number) => void;
  locale: Locale;
  lessonTitle: string;
}

export function LessonTakeawaysSection({
  takeaways,
  onSeek,
  locale,
  lessonTitle,
}: LessonTakeawaysSectionProps) {
  const isAr = locale === "ar";

  const handleSeek = (seconds: number) => {
    if (onSeek) {
      onSeek(seconds);
    } else {
      window.dispatchEvent(new CustomEvent("anei:seek-video", { detail: { seconds } }));
    }
  };

  const handlePrintMemo = () => {
    window.print();
  };

  if (!takeaways.length) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
        <Sparkles className="mx-auto h-8 w-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium">
          {isAr ? "النقاط الأساسية قيد الصياغة البيداغوجية." : "Les points essentiels sont en cours de validation pédagogique."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Print Fiche Mémo CTA */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-50/70 to-indigo-50/40 p-4 rounded-xl border border-blue-100">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-[#0056D2] text-white flex items-center justify-center shadow-2xs">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0A192F]">
              {isAr ? "النقاط الجوهرية (L'essentiel)" : "L'essentiel de la leçon"}
            </h3>
            <p className="text-xs text-slate-500">
              {isAr
                ? "المفاهيم المحورية التي يجب ترسيخها لممارستك الميدانية."
                : "Les concepts clés à retenir et à mobiliser dans votre pratique."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePrintMemo}
          className="h-9 px-3.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
        >
          <Printer size={14} className="text-[#0056D2]" />
          <span>{isAr ? "طباعة بطاقة الملخص (Fiche mémo)" : "Imprimer la Fiche mémo"}</span>
        </button>
      </div>

      {/* Grid of Key Takeaway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {takeaways.map((item, idx) => {
          const title = isAr ? item.titleAr : item.titleFr;
          const summary = isAr ? item.summaryAr : item.summaryFr;

          return (
            <article
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-[#BFDBFE] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-[#EBF3FF] text-[#0056D2] text-[11px] font-bold grid place-items-center">
                      {idx + 1}
                    </span>
                    <h4 className="text-[13.5px] font-bold text-[#0A192F] leading-snug">
                      {title}
                    </h4>
                  </div>
                </div>

                <p className="text-[12.5px] text-slate-600 leading-relaxed ps-7">
                  {summary}
                </p>
              </div>

              {/* Timestamp Seek Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between ps-7">
                <button
                  type="button"
                  onClick={() => handleSeek(item.timestampSeconds)}
                  className="text-xs font-semibold text-[#0056D2] hover:text-[#00419e] inline-flex items-center gap-1.5 transition-colors cursor-pointer group-hover:underline"
                >
                  <Play size={12} className="fill-[#0056D2]" />
                  <span>
                    {isAr ? "مراجعة هذا المقطع" : "Revoir ce passage"} (
                    <span dir="ltr">{formatSeconds(item.timestampSeconds)}</span>)
                  </span>
                </button>

                {item.isDraft && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                    {isAr ? "مسودة" : "Provisoire"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Printable Fiche Mémo Container (visible only on @media print) */}
      <div className="hidden print:block print:p-8 print:bg-white print:text-black">
        <h1 className="text-xl font-bold mb-2">ANEI — Académie Nationale de l&apos;Éducation Inclusive</h1>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">{lessonTitle} — Fiche Mémo</h2>
        <div className="space-y-4">
          {takeaways.map((item, idx) => (
            <div key={item.id} className="border-b pb-2">
              <strong className="block text-sm">
                {idx + 1}. {isAr ? item.titleAr : item.titleFr}
              </strong>
              <p className="text-xs text-slate-600 mt-1">
                {isAr ? item.summaryAr : item.summaryFr}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
