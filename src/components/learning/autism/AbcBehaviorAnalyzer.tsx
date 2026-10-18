"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Lightbulb } from "lucide-react";
import type { Locale } from "@/types";

type FunctionOption = "escape" | "attention" | "tangible" | "sensory";
type InterventionOption = "punish" | "force" | "proactive";

export function AbcBehaviorAnalyzer({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const [selectedFunction, setSelectedFunction] = useState<FunctionOption | null>(null);
  const [selectedIntervention, setSelectedIntervention] = useState<InterventionOption | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const handleValidate = () => {
    setShowExplanation(true);
  };

  const handleReset = () => {
    setSelectedFunction(null);
    setSelectedIntervention(null);
    setShowExplanation(false);
  };

  const isFunctionCorrect = selectedFunction === "escape";
  const isInterventionCorrect = selectedIntervention === "proactive";

  return (
    <div
      className="my-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <Lightbulb className="h-3.5 w-3.5" />
            {isAr ? "دراسة حالة سريرية تفاعلية: التحليل الوظيفي السلوكي" : "Étude de Cas Clinique : Analyse Fonctionnelle ABC"}
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {isAr ? "نموذج ABC في فهم السلوكيات التحدّية (Antecedent – Behavior – Consequence)" : "Modèle ABC & Décodage Fonctionnel des Comportements Défis"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {isAr
              ? "حلل الموقف السريري الواقعي التالي لتحديد الدافع الحقيقي للسلوك واختيار التدخل الاستباقي الأنجع."
              : "Analysez la situation clinique réelle ci-dessous pour identifier la fonction sous-jacente et choisir l'intervention adaptée."}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {isAr ? "إعادة البدء" : "Réinitialiser"}
        </button>
      </div>

      {/* Clinical Vignette Box */}
      <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-4 sm:p-5">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {isAr ? "الوضعية الميدانية (تلميذ يبلغ 8 سنوات في الصف الابتدائي) :" : "Vignette de terrain (Élève de 8 ans avec TSA en classe ordinaire) :"}
        </span>
        <blockquote className="mt-2 text-sm text-slate-800 italic leading-relaxed border-l-4 rtl:border-l-0 rtl:border-r-4 border-blue-500 pl-3 rtl:pl-0 rtl:pr-3">
          {isAr
            ? "«أثناء انتقال الفصل إلى حصة الرياضيات، طلبت المعلمة فتح كراس التمارين وحل مسألة نصية طويلة مكتوبة على السبورة. بعد ثوانٍ قليلة، صرخ التلميذ فجأة، ورمى كراسه وقلمه على الأرض واندفع مغادرًا مقعده نحو مؤخرة الفصل.»"
            : "« Lors du passage aux mathématiques, l'enseignante demande d'ouvrir le cahier et de copier un long problème écrit au tableau. Au bout de quelques secondes, l'élève pousse un cri aigu, projette son cahier au sol et quitte brusquement sa chaise pour se réfugier au fond de la classe. »"}
        </blockquote>

        {/* 3 Columns: A, B, C */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-blue-700 uppercase">
              {isAr ? "A - المثير القبلي (Antécédent)" : "A - Antécédent (Déclencheur)"}
            </div>
            <p className="mt-1.5 text-xs text-slate-700 leading-normal">
              {isAr
                ? "انتقال غير متوقع نحو مهمة كتابية كثيفة (مسألة رياضية نصية مجردة على السبورة)."
                : "Transition abrupte vers une tâche écrite dense, abstraite et perçue comme insurmontable."}
            </p>
          </div>

          <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-amber-700 uppercase">
              {isAr ? "B - السلوك الملاحظ (Behavior)" : "B - Comportement Observable"}
            </div>
            <p className="mt-1.5 text-xs text-slate-700 leading-normal">
              {isAr
                ? "صراخ مفاجئ، إلقاء الكراس، ومغادرة الكرسي (سلوك قابل للقياس والملاحظة المباشرة)."
                : "Cris, jet de matériel scolaire au sol et fuite physique du poste de travail."}
            </p>
          </div>

          <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-2xs">
            <div className="text-xs font-bold text-teal-700 uppercase">
              {isAr ? "C - الأثر البعدي المعتاد (Conséquence)" : "C - Conséquence Immédiate"}
            </div>
            <p className="mt-1.5 text-xs text-slate-700 leading-normal">
              {isAr
                ? "توقف التلميذ عن أداء تمرين الرياضيات وتركه يرتاح بالخلف لتفادي إزعاج زملائه."
                : "L'élève échappe temporairement à l'obligation de faire le problème de maths."}
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Question on Function */}
      <div className="mt-6">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
          {isAr ? "1. ما هي الوظيفة الحقيقية المحرّكة لهذا السلوك؟" : "1. Quelle est la fonction sous-jacente de ce comportement défi ?"}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            {
              id: "escape" as FunctionOption,
              labelFr: "Échappement / Évitement (Escape)",
              labelAr: "الهروب أو التهرّب من المهمة الصعبة (Échappement)",
              descFr: "Éviter une surcharge cognitive ou une tâche anxiogène.",
              descAr: "التخلص من مهمة مجهدة ذهنيًا تسبب له قلقًا وإحباطًا.",
            },
            {
              id: "attention" as FunctionOption,
              labelFr: "Recherche d'attention sociale",
              labelAr: "لفت انتباه المعلمة وزملائه",
              descFr: "Obtenir le regard ou la réaction verbale du groupe.",
              descAr: "الحصول على تفاعل الزملاء أو تركيز المعلمة معه.",
            },
            {
              id: "tangible" as FunctionOption,
              labelFr: "Accès à un objet / activité tangible",
              labelAr: "الوصول إلى لعبة أو نشاط مادي مرغوب",
              descFr: "Vouloir attraper immédiatement un jouet convoité.",
              descAr: "الرغبة في أخذ شيء محدد في تلك اللحظة.",
            },
            {
              id: "sensory" as FunctionOption,
              labelFr: "Auto-stimulation sensorielle intrinsèque",
              labelAr: "تنظيم أو تحفيز حسي ذاتي",
              descFr: "Rechercher une sensation corporelle interne indépendante.",
              descAr: "البحث عن استثارة حسية داخلية لا علاقة لها بالمحيط.",
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedFunction(item.id)}
              className={`p-3.5 rounded-xl border text-start transition-all ${selectedFunction === item.id ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <div className="text-xs sm:text-sm font-bold text-slate-900">{isAr ? item.labelAr : item.labelFr}</div>
              <div className="mt-1 text-xs text-slate-500">{isAr ? item.descAr : item.descFr}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Question on Intervention */}
      <div className="mt-6">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-700 block mb-2">
          {isAr ? "2. ما هو التدخل الاستباقي الموصى به علميًا لمرافقة هذا التلميذ؟" : "2. Quelle intervention proactive fondée sur les preuves (EBP) l'AVS doit-il privilégier ?"}
        </label>
        <div className="grid grid-cols-1 gap-2.5">
          {[
            {
              id: "punish" as InterventionOption,
              labelFr: "Priver l'élève de récréation pour lui apprendre à respecter le matériel",
              labelAr: "حرمان التلميذ من الاستراحة لتعليمه احترام الأدوات والالتزام بالنظام",
              bad: true,
            },
            {
              id: "force" as InterventionOption,
              labelFr: "Le ramener de force à sa chaise en lui tenant les mains pour qu'il écrive",
              labelAr: "إجباره جسديًا على الجلوس والإمساك بيده قسرًا لكتابة المسألة",
              bad: true,
            },
            {
              id: "proactive" as InterventionOption,
              labelFr: "Anticiper la transition : fractionner l'énoncé en 2 micro-tâches imagées avec Time Timer et tableau D'abord/Ensuite",
              labelAr: "استباق المثير القبلي: تقسيم المسألة إلى مرحلتين مصوّرتين، ضبط مؤقت بصري (Time Timer) وتفعيل لوحة «أولاً عمل، ثم راحة»",
              bad: false,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedIntervention(item.id)}
              className={`p-3.5 rounded-xl border text-start transition-all ${selectedIntervention === item.id ? "border-blue-500 bg-blue-50/60 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              <div className="text-xs sm:text-sm font-medium text-slate-900">{isAr ? item.labelAr : item.labelFr}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-6">
        {!showExplanation ? (
          <button
            disabled={!selectedFunction || !selectedIntervention}
            onClick={handleValidate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 px-5 text-xs sm:text-sm font-bold text-white shadow hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isAr ? "تحليل وتقييم الإجابات" : "Valider mon analyse fonctionnelle"}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        ) : (
          /* Feedback Explanation */
          <div className="rounded-xl border p-5 transition-all bg-slate-50 border-slate-200 space-y-4">
            <div className="flex items-center gap-2.5">
              {isFunctionCorrect && isInterventionCorrect ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
                  <h4 className="text-base font-bold text-emerald-900">
                    {isAr ? "تشخيص سريري متقن وتدخل مثالي!" : "Excellent diagnostic fonctionnel et intervention clinique ciblée !"}
                  </h4>
                </>
              ) : (
                <>
                  <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
                  <h4 className="text-base font-bold text-slate-900">
                    {isAr ? "تحليل يحتاج إلى تصويب وفق المعايير السريرية" : "Analyse à affiner selon les principes comportementaux"}
                  </h4>
                </>
              )}
            </div>

            <div className="text-xs sm:text-sm text-slate-700 space-y-2 leading-relaxed">
              <p>
                <strong>{isAr ? "الوظيفة السلوكية الحقيقية :" : "1. Fonction exacte du comportement : "}</strong>
                {isAr
                  ? "السلوك هدفه الهروب من مهمة مجهدة ومبهمة (Échappement). عندما يتم ترك التلميذ بمفرده في الخلف، يتحقق هدفه بشكل غير مقصود (Renforcement Négatif)، مما يثبت تكرار هذا السلوك مستقبلاً في كل مرة تأتي فيها حصة الرياضيات."
                  : "La fonction est l'échappement (Escape) face à une surcharge cognitive. Lorsque l'adulte laisse l'élève tranquille au fond de la classe, le comportement de fuite est renforcé négativement (il a obtenu ce qu'il voulait : ne pas faire la tâche)."}
              </p>
              <p>
                <strong>{isAr ? "التدخل المهني الصائب (AVS / Enseignant) :" : "2. Intervention proactive recommandée : "}</strong>
                {isAr
                  ? "لا جدوى إطلاقًا من العقاب أو الإجبار الجسدي بل يزيدان من التوتر والاضطراب. الحل يكمن في هندسة المثير القبلي: تفكيك المهمة الضخمة إلى خطوات صغيرة جدًا يمكن قياسها، ووضع مؤقت بصري واضح يحدد متى تنتهي المهمة بالضبط."
                  : "La punition ou la contrainte physique renforcent le traumatisme sensoriel. L'intervention EBP consiste à adapter l'antécédent : découper le problème en micro-étapes lisibles et utiliser la prédictibilité visuelle pour apaiser le système nerveux."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
