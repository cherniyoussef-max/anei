"use client";

import { useState } from "react";
import { Sliders, ShieldCheck, AlertTriangle } from "lucide-react";
import type { Locale } from "@/types";

interface FadingLevel {
  level: number;
  nameFr: string;
  nameAr: string;
  tagFr: string;
  tagAr: string;
  avsPct: number;
  autonomyPct: number;
  descFr: string;
  descAr: string;
  concreteExampleFr: string;
  concreteExampleAr: string;
  riskFr: string;
  riskAr: string;
}

const FADING_LEVELS: FadingLevel[] = [
  {
    level: 1,
    nameFr: "Guidance physique totale (Main sur main)",
    nameAr: "المساعدة الجسدية الكاملة (يدًا بيد)",
    tagFr: "Assistance maximale",
    tagAr: "تدخل كامل",
    avsPct: 100,
    autonomyPct: 10,
    descFr: "L'AVS enveloppe la main de l'élève pour initier, orienter et achever l'action mécanique.",
    descAr: "يمسك المرافق بيد التلميذ بشكل مباشر وكامل لتوجيه الحركة وإنجاز المهمة يدويًا.",
    concreteExampleFr: "Guider la main de l'enfant pour saisir la paire de ciseaux et réaliser la première découpe.",
    concreteExampleAr: "إمساك يد التلميذ لإمساك المقص وإجراء أول قصاصة في الورقة بشكل صحيح.",
    riskFr: "Risque très élevé de dépendance motrice si maintenu plus de quelques jours.",
    riskAr: "خطر كبير لتعويد التلميذ على الاعتمادية الجسدية إن استمرت لأكثر من أيام معدودة.",
  },
  {
    level: 2,
    nameFr: "Guidance physique partielle (Coude / Poignet)",
    nameAr: "المساعدة الجسدية الجزئية (دعم المرفق أو المعصم)",
    tagFr: "Accompagnement léger",
    tagAr: "توجيه خفيف",
    avsPct: 75,
    autonomyPct: 35,
    descFr: "Contact physique ponctuel au niveau du coude ou de l'avant-bras pour amorcer le mouvement.",
    descAr: "لمس خفيف لمرفق أو ذراع التلميذ لحثه على بدء الحركة في الاتجاه الصحيح دون إمساك يده.",
    concreteExampleFr: "Une légère pression au coude pour inviter l'élève à poser sa règle sur la feuille.",
    concreteExampleAr: "لمسة طفيفة عند المرفق لتوجيه يد التلميذ نحو وضع المسطرة في المكان المطلوب.",
    riskFr: "À estomper dès que l'amorce du geste est acquise.",
    riskAr: "يجب التقليل منها فور قدرة التلميذ على استيعاب بداية الحركة.",
  },
  {
    level: 3,
    nameFr: "Modélisation / Démonstration visuelle",
    nameAr: "النمذجة والمحاكاة البصرية (Show & Do)",
    tagFr: "Imitation",
    tagAr: "التقليد البصري",
    avsPct: 50,
    autonomyPct: 55,
    descFr: "L'AVS exécute le geste sous les yeux de l'élève sur son propre cahier sans aucun contact physique.",
    descAr: "يقوم المرافق بالعمل أمامه على ورقة مماثلة ويقول له «افعل مثلي» بدون أي لمس جسدي.",
    concreteExampleFr: "Ouvrir son propre livre à la page 14 pour que l'enfant reproduise l'action par miroir.",
    concreteExampleAr: "فتح كتاب المرافقة على الصفحة 14 ليقلدها التلميذ في كتابه هو تلقائيًا.",
    riskFr: "Vérifier que l'élève possède la compétence d'imitation motrice préalable.",
    riskAr: "التأكد مسبقًا من امتلاك التلميذ مهارة التقليد البصري والمحاكاة.",
  },
  {
    level: 4,
    nameFr: "Guidance gestuelle & Pointage visuel",
    nameAr: "التوجيه الإشاري والبصري (Pointage)",
    tagFr: "Indice discret",
    tagAr: "إشارة سريعة",
    avsPct: 25,
    autonomyPct: 80,
    descFr: "Un simple pointage du doigt vers la zone cible ou un hochement de tête approbateur.",
    descAr: "الإشارة بالإصبع نحو الخانة المقصودة أو الجدول البصري دون أي كلام أو لمس.",
    concreteExampleFr: "Pointer silencieusement du doigt le pictogramme « Rangement » sur son emploi du temps.",
    concreteExampleAr: "الإشارة الصامتة بإصبع اليد نحو رمز «ترتيب الأدوات» في الجدول البصري اليومي.",
    riskFr: "La posture la plus fonctionnelle en classe avant l'autonomie pleine.",
    riskAr: "المرحلة المثالية داخل الفصل قبل الوصول إلى الاستقلالية التامة.",
  },
  {
    level: 5,
    nameFr: "Indépendance totale & Déclencheur naturel",
    nameAr: "الاستقلالية التامة والمثير الطبيعي",
    tagFr: "Autonomie 100%",
    tagAr: "استقلالية كاملة",
    avsPct: 0,
    autonomyPct: 100,
    descFr: "L'élève réagit aux signaux naturels de la classe (voix de l'enseignante, sonnerie, comportement des pairs).",
    descAr: "يستجيب التلميذ مباشرة لإشارة المعلمة الجماعية أو جرس الفصل مثل بقية زملائه تمامًا.",
    concreteExampleFr: "L'enseignante dit « Prenez vos stylos rouges », l'élève ouvre sa trousse et sort son stylo seul.",
    concreteExampleAr: "تقول المعلمة «أخرجوا الأقلام»، فيفتح مقلمته ويخرج قلمه ذاتيًا وبدون أي تدخل.",
    riskFr: "Objectif ultime de l'inclusion : l'AVS s'efface discrètement.",
    riskAr: "الهدف الأسمى لرسالة المرافق المدرسي: الانسحاب لتمكين التلميذ.",
  },
];

export function PromptFadingSlider({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const [currentLevel, setCurrentLevel] = useState<number>(3);

  const selected = FADING_LEVELS[currentLevel - 1];

  return (
    <div
      className="my-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
          <Sliders className="h-3.5 w-3.5" />
          {isAr ? "محاكي مدرّج الاستقلالية: تلاشي المساعدة (Prompt Fading)" : "Simulateur d'Estompage des Guidances (Prompt Fading)"}
        </div>
        <h3 className="mt-2 text-lg font-bold text-slate-900">
          {isAr ? "التدرج من الدعم الجسدي الكامل إلى الاستقلالية الذاتية التامة" : "De l'Aide Physique Maximale à l'Autonomie Complète de l'Élève"}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600">
          {isAr
            ? "حرّك المؤشر بين المستويات الخمسة لتستكشف كيف يتناقص تدخل المرافق (AVS) وتنمو استقلالية التلميذ خطوة بخطوة."
            : "Ajustez le curseur entre les 5 niveaux pour visualiser la transition stratégique entre l'intervention de l'AVS et l'autonomie de l'élève."}
        </p>
      </div>

      {/* Slider Controls */}
      <div className="mt-6 rounded-xl bg-slate-50 p-5 border border-slate-200">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
          <span>{isAr ? "المستوى 1: أقصى مساعدة" : "Niveau 1 : Aide Maximale"}</span>
          <span className="text-blue-700 font-extrabold text-sm">
            {isAr ? `المستوى ${currentLevel} من 5` : `Palier ${currentLevel} / 5`}
          </span>
          <span>{isAr ? "المستوى 5: استقلالية تامة" : "Niveau 5 : Pleine Autonomie"}</span>
        </div>

        <input
          type="range"
          min="1"
          max="5"
          step="1"
          value={currentLevel}
          onChange={(e) => setCurrentLevel(Number(e.target.value))}
          className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
        />

        {/* 5 Step Buttons */}
        <div className="mt-3 grid grid-cols-5 gap-1 sm:gap-2">
          {FADING_LEVELS.map((lvl) => (
            <button
              key={lvl.level}
              onClick={() => setCurrentLevel(lvl.level)}
              className={`py-1.5 px-1 rounded text-center text-xs font-semibold transition-all ${currentLevel === lvl.level ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"}`}
            >
              <span className="hidden sm:inline">{isAr ? "المستوى " : "Niv. "}</span>{lvl.level}
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Dual Gauges */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Autonomy Gauge */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
            <span>{isAr ? "مستوى استقلالية التلميذ" : "Autonomie de l'élève"}</span>
            <span className="text-base">{selected.autonomyPct}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-emerald-200 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${selected.autonomyPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-emerald-800">
            {selected.autonomyPct >= 75
              ? (isAr ? "✓ مرحلة التمكين الذاتي المتقدم داخل الفصل" : "✓ Phase d'émancipation inclusive réussie")
              : (isAr ? "• في طور البناء التدريجي" : "• En cours de consolidation")}
          </p>
        </div>

        {/* AVS Intervention Gauge */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <span>{isAr ? "حجم تدخل المرافق (AVS)" : "Intensité d'intervention de l'AVS"}</span>
            <span className="text-base">{selected.avsPct}%</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-blue-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${selected.avsPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-blue-800">
            {selected.avsPct <= 25
              ? (isAr ? "✓ انسحاب مهني ذكي يمنع التعود على المساعدة" : "✓ Retrait stratégique prévenant l'assistanat")
              : (isAr ? "• دعم كثيف يحتاج إلى خطة تلاشٍ منظمة" : "• Soutien fort nécessitant un plan de repli")}
          </p>
        </div>
      </div>

      {/* Details of Selected Level */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <h4 className="text-base font-bold text-slate-900">
            {isAr ? selected.nameAr : selected.nameFr}
          </h4>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {isAr ? selected.tagAr : selected.tagFr}
          </span>
        </div>

        <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {isAr ? selected.descAr : selected.descFr}
        </div>

        {/* Concrete Classroom Example */}
        <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs">
          <span className="font-bold text-slate-800 block mb-1">
            {isAr ? "مثال تطبيقي داخل قاعة الدرس :" : "Exemple pratique en classe :"}
          </span>
          <p className="text-slate-600 italic">
            {isAr ? selected.concreteExampleAr : selected.concreteExampleFr}
          </p>
        </div>

        {/* Clinical Note / Alert */}
        <div className="flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <strong>{isAr ? "تنبيه سريري مهني :" : "Vigilance clinique : "}</strong>
            {isAr ? selected.riskAr : selected.riskFr}
          </div>
        </div>
      </div>

      {/* Golden Rule of 3 Successes */}
      <div className="mt-5 rounded-lg bg-indigo-50/70 p-3.5 border border-indigo-100 text-xs text-indigo-950 flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-indigo-700 flex-shrink-0 mt-0.5" />
        <div>
          <strong>{isAr ? "قاعدة الذهب في التلاشي (Règle des 3 réussites) :" : "Règle clinique des 3 réussites consécutives : "}</strong>
          {isAr
            ? "عندما ينجح التلميذ في إنجاز المهمة 3 مرات متتالية في المستوى الحالي، يجب على المرافق فورًا خفض درجة المساعدة والانتقال إلى المستوى التالي نحو الاستقلالية."
            : "Dès que l'élève réussit la tâche 3 fois consécutives au palier actuel, l'AVS doit impérativement descendre d'un cran d'aide afin d'éviter le piège de la dépendance à l'adulte (Prompt Dependency)."}
        </div>
      </div>
    </div>
  );
}
