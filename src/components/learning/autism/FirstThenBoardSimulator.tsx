"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, Sparkles } from "lucide-react";
import type { Locale } from "@/types";

interface Pictogram {
  id: string;
  labelFr: string;
  labelAr: string;
  icon: string;
  type: "task" | "reward";
  color: string;
}

const AVAILABLE_TASKS: Pictogram[] = [
  { id: "math", labelFr: "Fiche de mathématiques", labelAr: "ورقة تمارين الرياضيات", icon: "📐", type: "task", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { id: "writing", labelFr: "Cahier d'écriture", labelAr: "دفتر الكتابة والخط", icon: "✍️", type: "task", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { id: "reading", labelFr: "Lecture silencieuse", labelAr: "القراءة الصامتة", icon: "📖", type: "task", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { id: "tidy", labelFr: "Rangement des affaires", labelAr: "ترتيب الأدوات والمحفظة", icon: "🎒", type: "task", color: "bg-amber-50 text-amber-700 border-amber-200" },
];

const AVAILABLE_REWARDS: Pictogram[] = [
  { id: "break", labelFr: "Pause coin calme (5 min)", labelAr: "استراحة في الركن الهادئ (5 د)", icon: "🧘", type: "reward", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { id: "tablet", labelFr: "Tablette éducative (puzzle)", labelAr: "الجهاز اللوحي التعليمي (تركيب)", icon: "📱", type: "reward", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { id: "drawing", labelFr: "Dessin libre au feutre", labelAr: "الرسم الحر بالألوان", icon: "🎨", type: "reward", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { id: "headphones", labelFr: "Écoute de musique douce", labelAr: "سماعات الموسيقى الهادئة", icon: "🎧", type: "reward", color: "bg-sky-50 text-sky-700 border-sky-200" },
];

export function FirstThenBoardSimulator({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const [selectedTask, setSelectedTask] = useState<Pictogram | null>(AVAILABLE_TASKS[0]);
  const [selectedReward, setSelectedReward] = useState<Pictogram | null>(AVAILABLE_REWARDS[0]);
  const [taskCompleted, setTaskCompleted] = useState(false);
  const [rewardDelivered, setRewardDelivered] = useState(false);

  const handleCompleteTask = () => {
    setTaskCompleted(true);
  };

  const handleClaimReward = () => {
    setRewardDelivered(true);
  };

  const handleReset = () => {
    setTaskCompleted(false);
    setRewardDelivered(false);
  };

  return (
    <div
      className="my-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            {isAr ? "أداة تدريبية تفاعلية: جدول أولاً - ثم" : "Simulateur Interactif : Tableau D'abord – Ensuite"}
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {isAr ? "لوحة التوجيه السلوكي «أولاً... ثم...» (Premack Principle)" : "Tableau de structuration temporelle (Principe de Premack)"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {isAr
              ? "جرّب بنفسك بناء وتفعيل العقد البصري بين إنجاز المهمة المطلوبة ونيل التعزيز الإيجابي الفوري."
              : "Expérimentez la structuration visuelle qui sécurise l'élève en reliant une tâche coûteuse à un renforçateur direct."}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {isAr ? "إعادة ضبط" : "Réinitialiser"}
        </button>
      </div>

      {/* Main Board */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 sm:p-6 rounded-xl border border-slate-200">
        {/* Step 1: D'ABORD / أولاً */}
        <div className={`relative flex flex-col justify-between rounded-xl border-2 p-5 transition-all bg-white ${taskCompleted ? "border-emerald-500 ring-2 ring-emerald-100" : "border-blue-400 shadow-sm"}`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900">
                {isAr ? "1. أولاً (المهمة)" : "1. D'ABORD (Tâche)"}
              </span>
              {taskCompleted && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isAr ? "أُنجزت بنجاح" : "Terminée"}
                </span>
              )}
            </div>

            <div className="mt-6 text-center">
              <span className="text-5xl select-none" role="img" aria-hidden="true">
                {selectedTask?.icon ?? "📝"}
              </span>
              <h4 className="mt-3 text-base font-bold text-slate-800">
                {isAr ? selectedTask?.labelAr : selectedTask?.labelFr}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {isAr ? "تحديد واضح وملموس لنهاية المهمة" : "Consigne concrète avec critère d'arrêt explicite"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {!taskCompleted ? (
              <button
                onClick={handleCompleteTask}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white shadow hover:bg-blue-700 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isAr ? "تأكيد إتمام التلميذ للمهمة" : "Valider l'effort de l'élève"}
              </button>
            ) : (
              <div className="text-center rounded-lg bg-emerald-50 py-2 text-xs font-semibold text-emerald-800 border border-emerald-200">
                {isAr ? "✓ اكتملت المهمة! يحق للتلميذ الانتقال للتعزيز" : "✓ Objectif atteint ! Déblocage immédiat de la récompense"}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: ENSUITE / ثم */}
        <div className={`relative flex flex-col justify-between rounded-xl border-2 p-5 transition-all bg-white ${!taskCompleted ? "border-slate-200 opacity-60" : rewardDelivered ? "border-teal-500 ring-2 ring-teal-100" : "border-teal-400 shadow-md animate-pulse"}`}>
          <div>
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${taskCompleted ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-600"}`}>
                {isAr ? "2. ثم (المكافأة / النشاط المفضل)" : "2. ENSUITE (Renforçateur)"}
              </span>
              {rewardDelivered && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-600">
                  <CheckCircle2 className="h-4 w-4" />
                  {isAr ? "تم الاستمتاع بالنشاط" : "Accordée"}
                </span>
              )}
            </div>

            <div className="mt-6 text-center">
              <span className="text-5xl select-none" role="img" aria-hidden="true">
                {selectedReward?.icon ?? "⭐"}
              </span>
              <h4 className="mt-3 text-base font-bold text-slate-800">
                {isAr ? selectedReward?.labelAr : selectedReward?.labelFr}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {isAr ? "تعزيز ذو دافعية حقيقية لدى التلميذ" : "Renforçateur à forte valeur motivationnelle"}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {!taskCompleted ? (
              <div className="text-center rounded-lg bg-slate-100 py-2.5 text-xs font-medium text-slate-500">
                {isAr ? "🔒 مغلق حتى إتمام المهمة الأولى" : "🔒 Verrouillé jusqu'à la fin de la tâche 1"}
              </div>
            ) : !rewardDelivered ? (
              <button
                onClick={handleClaimReward}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white shadow hover:bg-teal-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                {isAr ? "تقديم النشاط التعزيزي الآن (5 دقائق)" : "Donner l'activité préférée (5 min)"}
              </button>
            ) : (
              <div className="text-center rounded-lg bg-teal-50 py-2 text-xs font-semibold text-teal-800 border border-teal-200">
                {isAr ? "🌟 تم تعزيز السلوك الإيجابي بنجاح!" : "🌟 Renforcement immédiat réussi !"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selector Options */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Task Choice */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            {isAr ? "اختر مهمة العمل المطلوبة:" : "Choisir la tâche de travail :"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_TASKS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTask(t);
                  setTaskCompleted(false);
                  setRewardDelivered(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-start transition-colors ${selectedTask?.id === t.id ? `${t.color} font-semibold ring-1 ring-blue-400` : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"}`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="truncate">{isAr ? t.labelAr : t.labelFr}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reward Choice */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
            {isAr ? "اختر النشاط المعزز المفضل:" : "Choisir le renforçateur associé :"}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {AVAILABLE_REWARDS.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setSelectedReward(r);
                  setRewardDelivered(false);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs text-start transition-colors ${selectedReward?.id === r.id ? `${r.color} font-semibold ring-1 ring-teal-400` : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"}`}
              >
                <span className="text-lg">{r.icon}</span>
                <span className="truncate">{isAr ? r.labelAr : r.labelFr}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Didactic Key Takeaway */}
      <div className="mt-5 rounded-lg bg-blue-50/70 p-3.5 border border-blue-100 text-xs text-blue-900 leading-relaxed">
        <strong>{isAr ? "قاعدة الممارسة المهنية (AVS) :" : "Règle de pratique clinique (AVS) : "}</strong>
        {isAr
          ? "يجب أن تكون المدة الزمنية أو حجم المهمة الأولى محددًا بصريًا (مثلاً: حل 3 أسطر فقط)، ويجب منح المعزز مباشرة وبدون تأخير عند الانتهاء لتثبيت الرابط العصبي والسلوكي الإيجابي."
          : "La tâche doit avoir une fin visuellement explicite (ex: faire 3 calculs). Le renforçateur doit être accordé immédiatement dès l'achèvement pour consolider l'association prédictive et réduire l'anxiété."}
      </div>
    </div>
  );
}
