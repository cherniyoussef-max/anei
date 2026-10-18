/**
 * Shared Reference Taxonomy for Inclusive Education
 * Supports Teacher Classroom, Partner Establishment, and Specialist workflows.
 */

export type DifficultyKey = "dys" | "tdah" | "vis" | "aud" | "tsa" | "comp";

export type AdaptationKey =
  | "font"
  | "big"
  | "contrast"
  | "tts"
  | "simple"
  | "steps"
  | "pictos"
  | "pauses"
  | "time"
  | "oral"
  | "written";

export type ServiceRequestType = "cons" | "visit" | "form" | "acc" | "mat" | "exam";

export type PalettePreset = "Classique" | "Pastel" | "Daltonien" | "Personnalisée";

export interface DifficultyDef {
  key: DifficultyKey;
  labelFr: string;
  labelAr: string;
  defaultColor: string;
  recommendedAdaptations: AdaptationKey[];
  reflexTips: Array<{
    situation: string;
    whatToDo: string;
    whatToAvoid: string;
  }>;
  resources: Array<{
    title: string;
    category: string;
    discipline: string;
  }>;
}

export const DIFFICULTIES: Record<DifficultyKey, DifficultyDef> = {
  dys: {
    key: "dys",
    labelFr: "Dyslexie",
    labelAr: "عسر القراءة (Dyslexie)",
    defaultColor: "#2563eb",
    recommendedAdaptations: ["font", "big", "tts", "time", "oral"],
    reflexTips: [
      {
        situation: "L'élève refuse d'écrire",
        whatToDo: "Alléger l'écrit, accepter l'oral ou la dictée, valoriser le contenu plutôt que l'orthographe.",
        whatToAvoid: "Le faire lire à voix haute devant la classe sans préparation.",
      },
      {
        situation: "L'élève lit lentement",
        whatToDo: "Donner le texte en gros caractères avec interligne large, lire la consigne à voix haute.",
        whatToAvoid: "Sanctionner l'orthographe dans toutes les matières non linguistiques.",
      },
    ],
    resources: [
      { title: "Texte de lecture en police adaptée", category: "Fiche simplifiée", discipline: "Français" },
      { title: "Dictée aménagée à trous", category: "Exercice", discipline: "Français" },
    ],
  },
  tdah: {
    key: "tdah",
    labelFr: "TDAH",
    labelAr: "فرط الحركة وتشتت الانتباه (TDAH)",
    defaultColor: "#ea580c",
    recommendedAdaptations: ["steps", "pauses", "simple"],
    reflexTips: [
      {
        situation: "L'élève ne termine pas ses exercices",
        whatToDo: "Un exercice à la fois, minuteur visible, valoriser chaque étape, réduire la quantité.",
        whatToAvoid: "Retirer la récréation pour terminer un devoir non achevé.",
      },
      {
        situation: "L'élève se lève sans arrêt",
        whatToDo: "Confier de petites missions utiles, prévoir des pauses motrices, le placer près de l'enseignant.",
        whatToAvoid: "Le punir pour son besoin physiologique de bouger.",
      },
    ],
    resources: [
      { title: "Consignes en étapes numérotées", category: "Support visuel", discipline: "Toutes matières" },
      { title: "Minuteur visuel à imprimer", category: "Affiche", discipline: "Classe" },
    ],
  },
  vis: {
    key: "vis",
    labelFr: "Déficience visuelle",
    labelAr: "ضعف البصر (Déficience visuelle)",
    defaultColor: "#7c3aed",
    recommendedAdaptations: ["big", "contrast", "tts", "time"],
    reflexTips: [
      {
        situation: "L'élève ne voit pas le tableau",
        whatToDo: "Placer au premier rang face au tableau, verbaliser ce qui est écrit, donner un support papier individuel.",
        whatToAvoid: "Dire « regardez là » ou « ici » sans préciser l'emplacement exact.",
      },
      {
        situation: "L'élève se fatigue vite",
        whatToDo: "Prévoir des pauses visuelles, agrandir les documents (police 18-20), limiter la copie manuelle.",
        whatToAvoid: "Exiger de recopier de longs textes denses du tableau.",
      },
    ],
    resources: [
      { title: "Fiche de mathématiques en gros caractères", category: "Gros caractères", discipline: "Mathématiques" },
      { title: "Texte en contraste élevé", category: "Contraste", discipline: "Français" },
    ],
  },
  aud: {
    key: "aud",
    labelFr: "Déficience auditive",
    labelAr: "ضعف السمع (Déficience auditive)",
    defaultColor: "#0d9488",
    recommendedAdaptations: ["written", "pictos"],
    reflexTips: [
      {
        situation: "L'élève ne comprend pas la consigne orale",
        whatToDo: "Se placer bien en face de lui pour la lecture labiale, écrire la consigne, illustrer par un schéma.",
        whatToAvoid: "Parler en écrivant au tableau ou en tournant le dos.",
      },
      {
        situation: "L'élève décroche pendant les échanges collectifs",
        whatToDo: "Désigner clairement l'élève qui prend la parole, résumer l'idée essentielle au tableau.",
        whatToAvoid: "Supposer qu'il a compris sans vérification visuelle.",
      },
    ],
    resources: [
      { title: "Leçon avec schémas légendés", category: "Support visuel", discipline: "Sciences" },
      { title: "Consignes illustrées et repères", category: "Pictogrammes", discipline: "Toutes matières" },
    ],
  },
  tsa: {
    key: "tsa",
    labelFr: "Autisme",
    labelAr: "طيف التوحد (Autisme / TSA)",
    defaultColor: "#db2777",
    recommendedAdaptations: ["simple", "pictos", "steps"],
    reflexTips: [
      {
        situation: "L'élève panique lors d'un changement",
        whatToDo: "Prévenir à l'avance, afficher l'emploi du temps visuel séquencé, prévoir un coin calme.",
        whatToAvoid: "Modifier le programme de manière impromptue sans transition visuelle.",
      },
      {
        situation: "L'élève comprend mal les consignes imagées",
        whatToDo: "Utiliser des phrases courtes, univoques et littérales, sans ironie ni métaphore.",
        whatToAvoid: "Utiliser des expressions imagées ou des consignes à double sens.",
      },
    ],
    resources: [
      { title: "Emploi du temps visuel séquencé", category: "Pictogrammes", discipline: "Classe" },
      { title: "Activité décomposée en images", category: "Support visuel", discipline: "Toutes matières" },
    ],
  },
  comp: {
    key: "comp",
    labelFr: "Difficultés de compréhension",
    labelAr: "صعوبات الفهم والإدراك",
    defaultColor: "#65a30d",
    recommendedAdaptations: ["simple", "pictos", "tts"],
    reflexTips: [
      {
        situation: "L'élève ne comprend pas la leçon",
        whatToDo: "Partir d'exemples concrets du quotidien, reformuler avec d'autres mots, valider par une question simple.",
        whatToAvoid: "Répéter la même explication abstraite à l'identique avec le même niveau de langue.",
      },
      {
        situation: "L'élève n'ose pas demander de l'aide",
        whatToDo: "Instaurer un signal discret sur le bureau, passer le voir de façon bienveillante dès le début du travail.",
        whatToAvoid: "L'interroger à froid devant toute la classe sans étayage préalable.",
      },
    ],
    resources: [
      { title: "Texte en version simplifiée FALC", category: "FALC", discipline: "Français" },
      { title: "Problème mathématique en 3 étapes guidées", category: "Fiche simplifiée", discipline: "Mathématiques" },
    ],
  },
};

export const DIFFICULTY_KEYS: DifficultyKey[] = ["dys", "tdah", "vis", "aud", "tsa", "comp"];

export const PALETTES: Record<"Classique" | "Pastel" | "Daltonien", string[]> = {
  Classique: ["#2563eb", "#ea580c", "#7c3aed", "#0d9488", "#db2777", "#65a30d"],
  Pastel: ["#7aa7f7", "#f6a96b", "#b79af5", "#6cc9bf", "#f29bc0", "#a8d36a"],
  Daltonien: ["#0072B2", "#E69F00", "#CC79A7", "#009E73", "#D55E00", "#56B4E9"],
};

export const ADAPTATIONS: Record<AdaptationKey, { labelFr: string; labelAr: string; descFr: string }> = {
  font: {
    labelFr: "Police adaptée dyslexie",
    labelAr: "خط ملائم لعسر القراءة",
    descFr: "Verdana / OpenDyslexic, espacement renforcé, interligne aéré.",
  },
  big: {
    labelFr: "Gros caractères",
    labelAr: "خط كبير مكبّر",
    descFr: "Taille de police agrandie (20px / 16pt) pour soulager l'effort visuel.",
  },
  contrast: {
    labelFr: "Contraste élevé",
    labelAr: "تباين بصري عالٍ",
    descFr: "Texte jaune vif sur fond noir pur pour une lisibilité maximale.",
  },
  tts: {
    labelFr: "Lecture vocale",
    labelAr: "قراءة صوتية آلية",
    descFr: "Synthèse vocale intégrée pour écouter les consignes et textes.",
  },
  simple: {
    labelFr: "Consignes simplifiées (FALC)",
    labelAr: "تعليمات مبسطة (FALC)",
    descFr: "Vocabulaire courant, phrases courtes à structure directe sujet-verbe-complément.",
  },
  steps: {
    labelFr: "Une question par page",
    labelAr: "سؤال واحد في كل صفحة",
    descFr: "Découpage séquentiel pour réduire la surcharge cognitive et l'éparpillement.",
  },
  pictos: {
    labelFr: "Pictogrammes",
    labelAr: "رموز ورسوم إرشادية",
    descFr: "Repères visuels universels pour illustrer les actions requises.",
  },
  pauses: {
    labelFr: "Pauses programmées",
    labelAr: "استراحات مجدولة",
    descFr: "Micro-pauses de récupération toutes les 10 minutes d'activité soutenue.",
  },
  time: {
    labelFr: "Temps majoré +33 %",
    labelAr: "وقت إضافي +33%",
    descFr: "Tiers-temps additionnel pour compenser la lenteur de lecture ou d'écriture.",
  },
  oral: {
    labelFr: "Réponse orale possible",
    labelAr: "إمكانية الإجابة الشفوية",
    descFr: "Autorisation de formuler la réponse à l'oral ou via dictée vocale.",
  },
  written: {
    labelFr: "Consignes écrites + schémas",
    labelAr: "تعليمات كتابية ومخططات",
    descFr: "Supports visuels écrits systématiques pour pallier le déficit auditif.",
  },
};

export const ADAPTATION_KEYS: AdaptationKey[] = [
  "font",
  "big",
  "contrast",
  "tts",
  "simple",
  "steps",
  "pictos",
  "pauses",
  "time",
  "oral",
  "written",
];

export const SERVICE_CATALOG: Record<
  ServiceRequestType,
  { labelFr: string; labelAr: string; descFr: string; descAr: string }
> = {
  cons: {
    labelFr: "Consultation d'un spécialiste",
    labelAr: "استشارة أخصائي معتمد",
    descFr: "Conseil à distance ou visio sur une situation d'élève ou d'équipe précise.",
    descAr: "إرشاد وتوجيه بيداغوجي ونفسي عن بعد لحالة صفية محددة.",
  },
  visit: {
    labelFr: "Visite d'un conseiller",
    labelAr: "زيارة مستشار إدماج ميدانية",
    descFr: "Accompagnement et observation directement au sein de votre établissement.",
    descAr: "مرافقة ميدانية داخل المؤسسة لمعاينة الترتيبات الصفية.",
  },
  form: {
    labelFr: "Formation des enseignants",
    labelAr: "تكوين الفرق البيداغوجية",
    descFr: "Modules certifiants en ligne ou sessions sur site adaptées à votre équipe.",
    descAr: "تكوينات تطبيقية للأساتذة في استراتيجيات التدريس الدامج.",
  },
  acc: {
    labelFr: "Diagnostic d'accessibilité",
    labelAr: "تشخيص النفاذية والتيسير",
    descFr: "Évaluation complète des locaux, de la signalétique et des aménagements.",
    descAr: "تقييم شامل للفضاءات المدرسية ومعايير النفاذية الشاملة.",
  },
  mat: {
    labelFr: "Prêt de matériel adapté",
    labelAr: "إعارة تجهيزات ومعدات مساعدة",
    descFr: "Mise à disposition de loupes, claviers contrastés, casques antibruit et logiciels.",
    descAr: "توفير أدوات تقنية، شاشات مكبرة وبرمجيات ناطقة.",
  },
  exam: {
    labelFr: "Examens aménagés",
    labelAr: "ترتيبات وتكييف الامتحانات",
    descFr: "Conseil méthodologique et organisationnel pour les épreuves certifiantes.",
    descAr: "تنظيم وتكييف الامتحانات والمناظرات الوطنية للتلاميذ.",
  },
};

export const SELF_EVALUATION_QUESTIONS = [
  {
    index: 0,
    textFr: "Les locaux sont accessibles (rampes, ascenseurs, signalétique contrastée)",
    textAr: "المباني مهيأة وتدعم النفاذية (ممرات مائلة، علامات واضحة، سهولة حركة)",
    relatedService: "acc" as ServiceRequestType,
  },
  {
    index: 1,
    textFr: "Les enseignants sont formés aux pratiques de l'éducation inclusive",
    textAr: "المدرسون مدربون على ممارسات وبيداغوجيا التعليم الدامج",
    relatedService: "form" as ServiceRequestType,
  },
  {
    index: 2,
    textFr: "Un référent inclusion est désigné au sein de l'établissement",
    textAr: "تم تعيين منسق أو مرجع للدمج المدرسي داخل المؤسسة",
    relatedService: "cons" as ServiceRequestType,
  },
  {
    index: 3,
    textFr: "Les fiches de besoins des élèves sont régulièrement renseignées et à jour",
    textAr: "ملفات الترتيبات الفردية للتلاميذ محينة ومنتظمة باستمرار",
    relatedService: "cons" as ServiceRequestType,
  },
  {
    index: 4,
    textFr: "Les évaluations et devoirs peuvent être aménagés (temps, police, support)",
    textAr: "يتم تكييف الفروض والامتحانات (الوقت، الخط، الوسائط البديلة)",
    relatedService: "exam" as ServiceRequestType,
  },
  {
    index: 5,
    textFr: "Du matériel pédagogique adapté est disponible pour les élèves qui en ont besoin",
    textAr: "تتوفر وسائل تعليمية وتكنولوجيات مساعدة للمتعلمين ذوي الإعاقة",
    relatedService: "mat" as ServiceRequestType,
  },
  {
    index: 6,
    textFr: "Les familles sont régulièrement associées au suivi personnalisé de l'élève",
    textAr: "الأولياء شركاء فاعلون في متابعة وتقييم الخطة التربوية الفردية",
    relatedService: "cons" as ServiceRequestType,
  },
  {
    index: 7,
    textFr: "Les élèves de la classe sont sensibilisés à l'empathie et à la différence",
    textAr: "يتم تحسيس وتوعية التلاميذ بقيم تقبل الاختلاف والتعاطف المشترك",
    relatedService: "visit" as ServiceRequestType,
  },
];

/**
 * Computes deduplicated recommended adaptations based on selected difficulties
 */
export function computeRecommendedAdaptations(difficulties: DifficultyKey[]): AdaptationKey[] {
  const set = new Set<AdaptationKey>();
  for (const d of difficulties) {
    const def = DIFFICULTIES[d];
    if (def) {
      for (const a of def.recommendedAdaptations) {
        set.add(a);
      }
    }
  }
  return Array.from(set);
}

/**
 * Resolves difficulty color according to palette preset or custom colors
 */
export function getDifficultyColor(
  key: DifficultyKey,
  preset: PalettePreset = "Classique",
  customColors?: Record<string, string> | null,
): string {
  if (preset === "Personnalisée" && customColors && customColors[key]) {
    return customColors[key];
  }
  const idx = DIFFICULTY_KEYS.indexOf(key);
  if (idx < 0) return "#2563eb";

  if (preset === "Pastel") return PALETTES.Pastel[idx];
  if (preset === "Daltonien") return PALETTES.Daltonien[idx];
  return PALETTES.Classique[idx];
}

export const COLOR_PALETTES = PALETTES;
export const SERVICE_TYPES = SERVICE_CATALOG;
export const SELF_EVAL_QUESTIONS = SELF_EVALUATION_QUESTIONS.map((q) => ({
  questionFr: q.textFr,
  questionAr: q.textAr,
  associatedService: q.relatedService,
}));
export const PARTNERSHIP_STAGES = [
  "Demande envoyée",
  "Convention en cours d'examen",
  "Convention à signer",
  "Partenariat actif",
];
export const SERVICE_REQUEST_STAGES = [
  "Envoyée",
  "Reçue",
  "En cours",
  "Rendez-vous fixé",
  "Traitée",
];
