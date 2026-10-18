"use client";

import { useState, useMemo } from "react";
import { Search, BookOpen, CheckCircle } from "lucide-react";
import type { Locale } from "@/types";

interface EbpPractice {
  id: string;
  nameFr: string;
  nameAr: string;
  domain: "communication" | "behavior" | "autonomy" | "social" | "academic";
  ages: ("preschool" | "primary" | "secondary")[];
  evidenceLevel: "high" | "moderate";
  summaryFr: string;
  summaryAr: string;
  avsRoleFr: string;
  avsRoleAr: string;
}

const EBP_PRACTICES: EbpPractice[] = [
  {
    id: "reinforcement",
    nameFr: "Renforcement Différentiel & Économie de Jetons",
    nameAr: "التعزيز التفاضلي واقتصاد الرموز (Token Economy)",
    domain: "behavior",
    ages: ["preschool", "primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Attribution contingente et immédiate d'un renforçateur tangible ou social suite à l'émission d'un comportement adapté.",
    summaryAr: "تقديم تعزيز إيجابي فوري عند صدور السلوك الملائم لزيادة وتيرة تكراره وتقليص السلوكيات المعيقة.",
    avsRoleFr: "Délivrer discrètement les jetons visuels et féliciter l'élève selon le ratio programmé sans perturber la classe.",
    avsRoleAr: "منح التلميذ الرموز البصرية فورًا والثناء عليه بهدوء وفق البرنامج المتفق عليه دون إحداث فوضى.",
  },
  {
    id: "pecs",
    nameFr: "Communication par Échange d'Images (PECS)",
    nameAr: "نظام التواصل بتبادل الصور (PECS)",
    domain: "communication",
    ages: ["preschool", "primary"],
    evidenceLevel: "high",
    summaryFr: "Système de communication augmentative et alternative (CAA) basé sur l'initiation spontanée de la demande via des pictogrammes.",
    summaryAr: "نظام تواصل بديل ومعزز يعتمد على المبادرة التلقائية للتلميذ بتقديم الصورة لطلب احتياجاته.",
    avsRoleFr: "Agir comme incitateur physique (partenaire silencieux) pendant les phases d'apprentissage puis comme récepteur de la demande.",
    avsRoleAr: "العمل كمساعد جسدي صامت في المراحل الأولى ثم كشريك متلقٍ لطلب التلميذ لتشجيعه على المبادرة.",
  },
  {
    id: "social-narratives",
    nameFr: "Scénarios Sociaux (Social Stories™)",
    nameAr: "القصص الاجتماعية (Social Stories)",
    domain: "social",
    ages: ["preschool", "primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Récits courts illustrés décrivant une situation sociale, les attentes collectives et les réactions appropriées pour lever l'ambiguïté.",
    summaryAr: "نصوص قصيرة مصورة تشرح موقفًا اجتماعيًا وما يتوقعه الآخرون لتبديد الغموض وتفادي القلق الاجتماعي.",
    avsRoleFr: "Lire le scénario avec l'élève 5 minutes avant la récréation ou la cantine pour ancrer le script comportemental.",
    avsRoleAr: "قراءة القصة مع التلميذ قبل 5 دقائق من موعد الاستراحة أو المطعم لتثبيت السلوكيات المرغوبة.",
  },
  {
    id: "video-modeling",
    nameFr: "Modélisation Vidéo (Video Modeling)",
    nameAr: "النمذجة بالفيديو (Video Modeling)",
    domain: "autonomy",
    ages: ["preschool", "primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Enregistrement vidéo d'un pair ou de l'élève lui-même réalisant avec succès une séquence cible complexe.",
    summaryAr: "مشاهدة مقطع فيديو قصير لزميل أو للتلميذ نفسه وهو ينجز مهارة معينة بنجاح لتقليدها بدقة.",
    avsRoleFr: "Faire visionner la vidéo sur tablette avant la séance d'arts plastiques ou de motricité.",
    avsRoleAr: "عرض الفيديو للتلميذ على جهاز لوحي قبل حصة التربية البدنية أو الرسم لمساعدته على التطبيق.",
  },
  {
    id: "teacch-structuring",
    nameFr: "Structuration Spatiale & Tâches TEACCH",
    nameAr: "الهيكلة البصرية المكانية لمهام تيتش (TEACCH)",
    domain: "academic",
    ages: ["preschool", "primary"],
    evidenceLevel: "high",
    summaryFr: "Organisation visuelle de gauche à droite (tâche à faire -> tâche en cours -> tâche terminée en boîte fermée).",
    summaryAr: "تنظيم مساحة العمل من اليمين إلى اليسار (المهام المطلوبة -> المهمة الحالية -> الصندوق المنجز).",
    avsRoleFr: "Préparer les bacs de travail autonomes et s'assurer que le critère de fin de tâche est matérialisé visuellement.",
    avsRoleAr: "تجهيز علب العمل الفردي والتأكد من وضوح علامة نهاية التمرين حتى يعمل التلميذ بمفرده.",
  },
  {
    id: "prompt-fading",
    nameFr: "Estompage Progressif des Guidances (Prompt Fading)",
    nameAr: "التلاشي التدريجي للمساعدة (Prompt Fading)",
    domain: "autonomy",
    ages: ["preschool", "primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Diminution systématique de l'aide de l'adulte vers les signaux naturels pour bâtir une autonomie pérenne.",
    summaryAr: "التقليص المنظم للمساعدة الجسدية واللفظية نحو المثيرات الطبيعية لبناء استقلالية دائمة.",
    avsRoleFr: "Rétrograder de la guidance motrice au simple pointage gestuel dès 3 réussites consécutives.",
    avsRoleAr: "الانتقال من مسك اليد إلى مجرد الإشارة الصامتة فور نجاح التلميذ 3 مرات متتالية.",
  },
  {
    id: "exercise-movement",
    nameFr: "Pauses Motrices & Exercice Physique Régulateur",
    nameAr: "الأنشطة الحركية والاستراحات التنظيمية (Sensorimotor Breaks)",
    domain: "behavior",
    ages: ["preschool", "primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Intégration d'efforts proprioceptifs lourds (porter des livres, étirements, marche) pour réguler le système vestibulaire.",
    summaryAr: "دمج أنشطة حسية وحركية مهدئة (حمل حقيبة خفيفة، ضغط اليدين، تمدد) لتنظيم الجهاز العصبي.",
    avsRoleFr: "Proposer la pause motrice programmée avant le pic de fatigue sensorielle observé en milieu de matinée.",
    avsRoleAr: "اقتراح استراحة حركية مسبقة قبل وصول التلميذ لمرحلة الإرهاق الحسي في منتصف الحصة.",
  },
  {
    id: "peer-mediated",
    nameFr: "Interventions Médiatisées par les Pairs (PMI)",
    nameAr: "التدخلات الموجّهة عبر الأقران (Peer-Mediated Instruction)",
    domain: "social",
    ages: ["primary", "secondary"],
    evidenceLevel: "high",
    summaryFr: "Sensibilisation et formation de camarades tuteurs pour initier les interactions ludiques et académiques.",
    summaryAr: "تدريب زملاء الفصل المتعاونين على كيفية بدء اللعب والتواصل الطبيعي مع التلميذ ذي طيف التوحد.",
    avsRoleFr: "Faciliter discrètement les échanges entre l'élève et ses camarades sans faire écran ni parler à sa place.",
    avsRoleAr: "تسهيل المحادثة بين التلميذ وزملائه دون أن يكون المرافق حاجزًا أو يتكلم نيابة عن التلميذ.",
  },
];

export function InterventionMatrixFilter({ locale }: { locale: Locale }) {
  const isAr = locale === "ar";
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");

  const DOMAIN_LABELS: Record<string, { fr: string; ar: string }> = {
    all: { fr: "Tous les domaines", ar: "جميع المجالات" },
    behavior: { fr: "Comportement & Régulation", ar: "السلوك والتنظيم الذاتي" },
    communication: { fr: "Communication & Langage", ar: "التواصل واللغة" },
    autonomy: { fr: "Autonomie & Quotidien", ar: "الاستقلالية والحياة اليومية" },
    social: { fr: "Socialisation & Pairs", ar: "التفاعل الاجتماعي والأقران" },
    academic: { fr: "Apprentissages scolaires", ar: "التعلمات الأكاديمية" },
  };

  const filteredPractices = useMemo(() => {
    return EBP_PRACTICES.filter((p) => {
      // Domain filter
      if (selectedDomain !== "all" && p.domain !== selectedDomain) return false;
      // Age filter
      if (selectedAge !== "all" && !p.ages.includes(selectedAge as "preschool" | "primary" | "secondary")) return false;
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchFr = p.nameFr.toLowerCase().includes(query) || p.summaryFr.toLowerCase().includes(query) || p.avsRoleFr.toLowerCase().includes(query);
        const matchAr = p.nameAr.toLowerCase().includes(query) || p.summaryAr.toLowerCase().includes(query) || p.avsRoleAr.toLowerCase().includes(query);
        return matchFr || matchAr;
      }
      return true;
    });
  }, [search, selectedDomain, selectedAge]);

  return (
    <div
      className="my-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm"
      dir={isAr ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
          <BookOpen className="h-3.5 w-3.5" />
          {isAr ? "المصفوفة السريرية: الممارسات المبنية على البراهين (EBP)" : "Matrice Clinique des Pratiques Fondées sur les Preuves (EBP)"}
        </div>
        <h3 className="mt-2 text-lg font-bold text-slate-900">
          {isAr ? "دليل التدخلات التربوية المعتمدة علميًا (NCAEP)" : "Répertoire Scientifique des Interventions Éducatives Évaluées"}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600">
          {isAr
            ? "ابحث وصنّف الممارسات العلاجية والبيداغوجية الأكثر فاعلية حسب سن التلميذ والهدف التنموي المستهدف."
            : "Recherchez et filtrez les pratiques validées par consensus scientifique international selon l'âge et les besoins de l'élève."}
        </p>
      </div>

      {/* Search & Filters Bar */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Keyword Search */}
        <div className="relative">
          <Search className="absolute top-3 left-3 rtl:left-auto rtl:right-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isAr ? "ابحث باسم الممارسة أو الكلمات المفتاحية..." : "Rechercher une pratique, un mot-clé..."}
            className="w-full pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>

        {/* Domain Filter */}
        <div>
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            {Object.entries(DOMAIN_LABELS).map(([key, val]) => (
              <option key={key} value={key}>
                {isAr ? val.ar : val.fr}
              </option>
            ))}
          </select>
        </div>

        {/* Age Filter */}
        <div>
          <select
            value={selectedAge}
            onChange={(e) => setSelectedAge(e.target.value)}
            className="w-full py-2 px-3 text-xs sm:text-sm rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">{isAr ? "جميع الفئات العمرية" : "Tous les âges scolaires"}</option>
            <option value="preschool">{isAr ? "رياض الأطفال (3 - 5 سنوات)" : "Maternelle (3-5 ans)"}</option>
            <option value="primary">{isAr ? "التعليم الابتدائي (6 - 11 سنة)" : "Primaire / Élémentaire (6-11 ans)"}</option>
            <option value="secondary">{isAr ? "الإعدادي والثانوي (12 - 18 سنة)" : "Collège & Lycée (12-18 ans)"}</option>
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>
          {isAr
            ? `عرض ${filteredPractices.length} ممارسة معتمدة`
            : `${filteredPractices.length} pratique(s) fondée(s) sur les preuves affichée(s)`}
        </span>
        {(search || selectedDomain !== "all" || selectedAge !== "all") && (
          <button
            onClick={() => {
              setSearch("");
              setSelectedDomain("all");
              setSelectedAge("all");
            }}
            className="text-blue-600 hover:underline font-medium"
          >
            {isAr ? "إلغاء التصنيفات" : "Réinitialiser les filtres"}
          </button>
        )}
      </div>

      {/* Cards Grid */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPractices.map((practice) => (
          <div
            key={practice.id}
            className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col justify-between hover:border-blue-300 transition-colors shadow-2xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <CheckCircle className="h-3 w-3" />
                  {isAr ? "أعلى دليل علمي (Niveau 1)" : "Preuve scientifique solide"}
                </span>
                <span className="text-xs font-medium text-slate-500">
                  {isAr ? DOMAIN_LABELS[practice.domain]?.ar : DOMAIN_LABELS[practice.domain]?.fr}
                </span>
              </div>

              <h4 className="mt-2.5 text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {isAr ? practice.nameAr : practice.nameFr}
              </h4>

              <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed">
                {isAr ? practice.summaryAr : practice.summaryFr}
              </p>
            </div>

            {/* AVS Practical Role */}
            <div className="mt-4 pt-3 border-t border-slate-100 bg-blue-50/50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-3 sm:p-4 rounded-b-xl border-t">
              <span className="text-xs font-bold text-blue-900 block mb-0.5">
                {isAr ? "دور المرافق المدرسي (AVS) في القسم :" : "Application concrète par l'AVS :"}
              </span>
              <p className="text-xs text-blue-800 leading-normal">
                {isAr ? practice.avsRoleAr : practice.avsRoleFr}
              </p>
            </div>
          </div>
        ))}

        {filteredPractices.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500 text-xs sm:text-sm">
            {isAr ? "لم يتم العثور على ممارسات تطابق معايير البحث الحالية." : "Aucune pratique ne correspond aux critères sélectionnés."}
          </div>
        )}
      </div>
    </div>
  );
}
