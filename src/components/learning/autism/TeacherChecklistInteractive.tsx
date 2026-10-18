"use client";

import { useState } from "react";
import { CheckSquare, RotateCcw, Award, AlertCircle, CheckCircle2, Check } from "lucide-react";
import type { Locale } from "@/types";

interface ChecklistItem {
  id: string;
  categoryFr: string;
  categoryAr: string;
  labelFr: string;
  labelAr: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // 1. Aménagement physique et sensoriel
  {
    id: "calm-corner",
    categoryFr: "1. Aménagement physique & sensoriel",
    categoryAr: "1. التهيئة المادية والحسية",
    labelFr: "Un coin calme / refuge sensoriel est matérialisé pour permettre la régulation sans quitter la classe.",
    labelAr: "توفير ركن هادئ وملاذ حسي داخل الفصل لتمكين التلميذ من التنظيم الذاتي دون مغادرة القاعة.",
  },
  {
    id: "noise-reduction",
    categoryFr: "1. Aménagement physique & sensoriel",
    categoryAr: "1. التهيئة المادية والحسية",
    labelFr: "Les bruits parasites sont réduits (patins sous les pieds des chaises, casque antibruit accessible).",
    labelAr: "التقليل من الضوضاء الحركية (لباد تحت أرجل الكراسي وسماعات إلغاء الضوضاء متاحة بسهولة).",
  },
  {
    id: "strategic-seating",
    categoryFr: "1. Aménagement physique & sensoriel",
    categoryAr: "1. التهيئة المادية والحسية",
    labelFr: "La place de l'élève est choisie à l'écart des va-et-vient (loin de la porte, vue dégagée sur le tableau).",
    labelAr: "اختيار مكان جلوس التلميذ بعيدًا عن حركة الممر والباب، مع رؤية مباشرة ومريحة للسبورة.",
  },
  {
    id: "organized-materials",
    categoryFr: "1. Aménagement physique & sensoriel",
    categoryAr: "1. التهيئة المادية والحسية",
    labelFr: "Le matériel scolaire est ordonné avec des repères visuels stables et des bacs étiquetés.",
    labelAr: "تنظيم الأدوات المدرسية بملصقات بصرية وألوان ثابتة وصناديق مصنفة تسهّل العثور عليها.",
  },

  // 2. Structuration spatio-temporelle
  {
    id: "visual-schedule",
    categoryFr: "2. Structuration spatio-temporelle & prédictibilité",
    categoryAr: "2. الهيكلة الزمانية والمكانية والقدرة على التنبؤ",
    labelFr: "Un emploi du temps visuel individualisé est affiché et manipulé à chaque changement d'activité.",
    labelAr: "جدول يومي بصري مخصص للتلميذ يُراجع وتُسحب رموزه مع كل انتقال بين المواد والأنشطة.",
  },
  {
    id: "visual-timer",
    categoryFr: "2. Structuration spatio-temporelle & prédictibilité",
    categoryAr: "2. الهيكلة الزمانية والمكانية والقدرة على التنبؤ",
    labelFr: "Un minuteur visuel (type Time Timer) est utilisé pour concrétiser la durée des tâches et des pauses.",
    labelAr: "استخدام مؤقت زمني بصري (مثل Time Timer) لتجسيد الوقت المتبقي للمهمة والاستراحة بشكل مرئي.",
  },
  {
    id: "transition-warning",
    categoryFr: "2. Structuration spatio-temporelle & prédictibilité",
    categoryAr: "2. الهيكلة الزمانية والمكانية والقدرة على التنبؤ",
    labelFr: "Les transitions et imprévus (remplacement, exercice d'évacuation) sont verbalisés et imagés 5 min avant.",
    labelAr: "إعلام التلميذ بالتغييرات والانتقالات المفاجئة قبل 5 دقائق عبر الإشارة البصرية والكلام الهادئ.",
  },
  {
    id: "first-then",
    categoryFr: "2. Structuration spatio-temporelle & prédictibilité",
    categoryAr: "2. الهيكلة الزمانية والمكانية والقدرة على التنبؤ",
    labelFr: "Une planche « D'abord – Ensuite » est prête pour lier tout effort d'apprentissage à un renforçateur.",
    labelAr: "استخدام لوحة «أولاً عمل، ثم راحة» لربط الجهد الأكاديمي بأنشطة التعزيز المحفزة.",
  },

  // 3. Communication et adaptation des consignes
  {
    id: "clear-instructions",
    categoryFr: "3. Communication & clarté des consignes",
    categoryAr: "3. التواصل ووضوح التعليمات البيداغوجية",
    labelFr: "Les consignes orales sont courtes (1 idée par phrase), affirmatives et dépourvues d'implicite.",
    labelAr: "التعليمات الشفوية قصيرة (فكرة واحدة في كل جملة)، واضحة ومباشرة دون مجاز أو استعارات معقدة.",
  },
  {
    id: "processing-time",
    categoryFr: "3. Communication & clarté des consignes",
    categoryAr: "3. التواصل ووضوح التعليمات البيداغوجية",
    labelFr: "Un délai d'attente incompressible de 5 à 10 secondes est respecté pour le traitement de l'information.",
    labelAr: "منح التلميذ مهلة صامتة من 5 إلى 10 ثوانٍ لمعالجة المعلومة ذهنيًا قبل تكرار السؤال أو التدخل.",
  },
  {
    id: "visual-support",
    categoryFr: "3. Communication & clarté des consignes",
    categoryAr: "3. التواصل ووضوح التعليمات البيداغوجية",
    labelFr: "Toute consigne importante est doublée d'un support visuel (pictogramme, mot-clé au tableau).",
    labelAr: "تدعيم كل تعليمة أساسية بمؤشر بصري مساند (رسم تخطيطي، رمز أو كلمة مفتاحية على السبورة).",
  },

  // 4. Collaboration AVS & Enseignant
  {
    id: "shared-plan",
    categoryFr: "4. Collaboration Enseignant – AVS – Famille",
    categoryAr: "4. التنسيق بين المعلم والمرافق والأسرة",
    labelFr: "L'enseignant et l'AVS ont défini ensemble le rôle exact de chacun et les critères de réussite.",
    labelAr: "وجود اتفاق وتوزيع واضح للأدوار بين المعلم والمرافق حول أهداف الدرس ومعايير نجاح التلميذ.",
  },
  {
    id: "fading-mindset",
    categoryFr: "4. Collaboration Enseignant – AVS – Famille",
    categoryAr: "4. التنسيق بين المعلم والمرافق والأسرة",
    labelFr: "L'AVS pratique l'estompage des aides dès que possible pour encourager l'autonomie vis-à-vis des pairs.",
    labelAr: "سعي المرافق الدائم لتخفيف المساعدة والابتعاد خطوة للوراء لتعويد التلميذ على الاندماج مع أقرانه.",
  },
  {
    id: "liaison-notebook",
    categoryFr: "4. Collaboration Enseignant – AVS – Famille",
    categoryAr: "4. التنسيق بين المعلم والمرافق والأسرة",
    labelFr: "Un carnet de liaison structuré valorise les réussites du jour auprès des parents et de l'équipe de soin.",
    labelAr: "دفتر تواصل يومي منظّم ينقل الإنجازات والملاحظات الإيجابية للأولياء والفريق الطبي المتابع.",
  },
];

export function TeacherChecklistInteractive({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(["calm-corner", "visual-schedule", "clear-instructions"]));

  const toggleItem = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setCheckedIds(new Set(CHECKLIST_ITEMS.map((item) => item.id)));
  };

  const handleReset = () => {
    setCheckedIds(new Set());
  };

  const total = CHECKLIST_ITEMS.length;
  const count = checkedIds.size;
  const percentage = Math.round((count / total) * 100);

  // Group by category
  const categories = Array.from(new Set(CHECKLIST_ITEMS.map((item) => isAr ? item.categoryAr : item.categoryFr)));

  return (
    <div
      className="my-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CheckSquare className="h-3.5 w-3.5" />
            {isAr ? "شبكة التقييم الذاتي: معايير الفصل الدامج (14 مؤشرًا)" : "Checklist Inclusive : 14 Critères d'Aménagement de Classe"}
          </div>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {isAr ? "مؤشر الجاهزية الشاملة لاستقبال التلميذ ذي طيف التوحد" : "Indice d'Accessibilité Pédagogique & Sensorielle de la Classe"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600">
            {isAr
              ? "قيّم البيئة المدرسية الحالية بتحديد الإجراءات المفعلة واكتشف تقرير الجاهزية الشاملة فورًا."
              : "Cochez les aménagements déjà en place dans votre classe pour mesurer le score d'accessibilité inclusive."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSelectAll}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {isAr ? "تحديد الكل" : "Tout cocher"}
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5 inline-block" />
          </button>
        </div>
      </div>

      {/* Live Score Banner */}
      <div className={`mt-6 rounded-xl p-5 border transition-all ${percentage >= 80 ? "bg-emerald-50 border-emerald-300" : percentage >= 50 ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              {isAr ? "درجة الجاهزية الشاملة للفصل :" : "Score Global d'Inclusion Scolaire :"}
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900">{percentage}%</span>
              <span className="text-xs text-slate-600 font-medium">
                ({count} / {total} {isAr ? "مؤشرات مفعلة" : "critères validés"})
              </span>
            </div>
          </div>

          <div className="text-xs sm:text-sm font-semibold">
            {percentage >= 80 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-white/80 py-1.5 px-3 rounded-lg border border-emerald-200">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {isAr ? "فصل عالي الهيكلة ومطابق للمعايير الدولية" : "Environnement hautement structuré et sécurisant"}
              </span>
            ) : percentage >= 50 ? (
              <span className="inline-flex items-center gap-1.5 text-blue-800 bg-white/80 py-1.5 px-3 rounded-lg border border-blue-200">
                <Award className="h-4 w-4 text-blue-600" />
                {isAr ? "أسس جيدة، مع حاجة لتعزيز القدرة على التنبؤ" : "Bases solides, renforcez la prédictibilité visuelle"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-800 bg-white/80 py-1.5 px-3 rounded-lg border border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                {isAr ? "بيئة غير مهيأة قد ترفع من حدة القلق والسلوكيات" : "Risque élevé de surcharge sensorielle et d'anxiété"}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${percentage >= 80 ? "bg-emerald-600" : percentage >= 50 ? "bg-blue-600" : "bg-amber-600"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Checklist Grouped by Category */}
      <div className="mt-7 space-y-6">
        {categories.map((cat) => {
          const catItems = CHECKLIST_ITEMS.filter((item) => (isAr ? item.categoryAr : item.categoryFr) === cat);
          return (
            <div key={cat} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                {cat}
              </h4>
              <div className="space-y-2">
                {catItems.map((item) => {
                  const isChecked = checkedIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`w-full flex items-start gap-3 p-3 rounded-lg border text-start transition-all ${isChecked ? "bg-white border-emerald-400 shadow-2xs text-slate-900" : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${isChecked ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <span className="text-xs sm:text-sm leading-relaxed">
                        {isAr ? item.labelAr : item.labelFr}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
