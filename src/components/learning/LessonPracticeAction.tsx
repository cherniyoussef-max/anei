"use client";

import { useState } from "react";
import { Save, Check, Sparkles, School } from "lucide-react";
import type { Locale } from "@/types";

export type PracticeActionData = {
  id: string;
  titleFr: string;
  titleAr: string;
  instructionsFr: string;
  instructionsAr: string;
  triedIt: boolean;
  reflectionNote: string | null;
};

interface LessonPracticeActionProps {
  practiceAction: PracticeActionData;
  locale: Locale;
}

export function LessonPracticeAction({
  practiceAction,
  locale,
}: LessonPracticeActionProps) {
  const isAr = locale === "ar";
  const [triedIt, setTriedIt] = useState(practiceAction.triedIt);
  const [reflection, setReflection] = useState(practiceAction.reflectionNote ?? "");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const title = isAr ? practiceAction.titleAr : practiceAction.titleFr;
  const instructions = isAr ? practiceAction.instructionsAr : practiceAction.instructionsFr;

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch("/api/learning/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionId: practiceAction.id,
          triedIt,
          reflectionNote: reflection.trim() || null,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-[#F8FAFC] rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0056D2] text-white flex items-center justify-center shadow-2xs">
            <School size={20} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#0056D2] uppercase tracking-wider block">
              {isAr ? "مهمة تطبيقية صفية" : "Mise en pratique en classe"}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-[#0A192F] leading-snug">
              {title}
            </h3>
          </div>
        </div>

        {triedIt && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check size={14} className="stroke-[3]" />
            <span>{isAr ? "تم التطبيق مع التلاميذ" : "Appliqué en classe"}</span>
          </span>
        )}
      </div>

      {/* Instructions Card */}
      <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/70 text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
        {instructions}
      </div>

      {/* Interactive Practice Tracker Form */}
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        {/* Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer group select-none">
          <input
            type="checkbox"
            checked={triedIt}
            onChange={(e) => setTriedIt(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-[#0056D2] focus:ring-[#0056D2] cursor-pointer"
          />
          <div className="text-xs sm:text-sm text-slate-800 font-medium leading-snug">
            <span>
              {isAr
                ? "قمتُ بتجربة هذا التمرين أو هذا التعديل البيداغوجي مع التلميذ في الصف."
                : "J&apos;ai testé cet aménagement ou cette stratégie pédagogique avec mes élèves."}
            </span>
            <p className="text-xs text-slate-500 font-normal mt-0.5">
              {isAr
                ? "يساعدك التوثيق الميداني على ترسيخ مهاراتك وبناء ملف كفاءتك المهنية."
                : "La consignation de vos pratiques renforce votre apprentissage et vos compétences professionnelles."}
            </p>
          </div>
        </label>

        {/* Reflection Note */}
        <div className="space-y-1.5">
          <label
            htmlFor={`practice-note-${practiceAction.id}`}
            className="text-xs font-semibold text-slate-700 block"
          >
            {isAr
              ? "ملاحظاتك ومخرجات التجربة (ما الذي نجح؟ ما الصعوبات التي واجهتها؟)"
              : "Vos observations & retour d&apos;expérience (ce qui a fonctionné, adaptations nécessaires) :"}
          </label>
          <textarea
            id={`practice-note-${practiceAction.id}`}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            rows={3}
            placeholder={
              isAr
                ? "مثال: ساعد الجدول البصري التلميذ على تقليل التوتر أثناء الانتقال بين الأنشطة..."
                : "Exemple : L'utilisation du repère visuel a réduit l'anxiété de l'élève lors des transitions..."
            }
            className="w-full text-xs sm:text-sm p-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-[#0056D2] focus:ring-1 focus:ring-[#0056D2] resize-y"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles size={14} className="text-[#C9913F]" />
            <span>
              {isAr ? "يحفظ في سجلك التدريبي" : "Enregistré dans votre journal d&apos;apprentissage"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-xs text-emerald-600 inline-flex items-center gap-1 font-semibold">
                <Check size={14} />
                <span>{isAr ? "تم الحفظ بنجاح" : "Enregistré"}</span>
              </span>
            )}

            <button
              type="submit"
              disabled={saving}
              className="h-9 px-4 rounded-xl bg-[#0056D2] hover:bg-[#00419e] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {saving ? (
                <span>{isAr ? "جارٍ الحفظ..." : "Enregistrement..."}</span>
              ) : (
                <>
                  <Save size={14} />
                  <span>{isAr ? "تأكيد التطبيق والملاحظات" : "Valider mon retour"}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
