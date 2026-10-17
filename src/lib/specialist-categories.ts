export type SpecialistCategoryKey =
  | "ORTHOPHONISTE"
  | "PSYCHOLOGUE"
  | "PSYCHOMOTRICIEN"
  | "ERGOTHERAPEUTE"
  | "PEDOPSYCHIATRE"
  | "ORTHOPEDAGOGUE"
  | "AUTRE_SPECIALISTE";

export interface SpecialistCategoryMeta {
  key: SpecialistCategoryKey;
  labelFr: string;
  labelAr: string;
  descriptionFr: string;
  descriptionAr: string;
  badgeFr: string;
  badgeAr: string;
  defaultDurationMinutes: number;
  defaultInPersonPriceMillimes: number;
  defaultOnlinePriceMillimes: number;
  iconName: string;
}

export const SPECIALIST_CATEGORIES: Record<SpecialistCategoryKey, SpecialistCategoryMeta> = {
  ORTHOPHONISTE: {
    key: "ORTHOPHONISTE",
    labelFr: "Orthophoniste",
    labelAr: "أخصائي تقويم النطق والتخاطب",
    descriptionFr: "Bilans et rééducation du langage oral, écrit, bégaiement et troubles de la communication.",
    descriptionAr: "تقييم وإعادة تأهيل اضطرابات النطق والكلام واللغة الشفوية والمكتوبة وصعوبات التعلم.",
    badgeFr: "Orthophonie",
    badgeAr: "تقويم نطق",
    defaultDurationMinutes: 45,
    defaultInPersonPriceMillimes: 45000,
    defaultOnlinePriceMillimes: 40000,
    iconName: "MessageSquare",
  },
  PSYCHOLOGUE: {
    key: "PSYCHOLOGUE",
    labelFr: "Psychologue & Neuropsychologue",
    labelAr: "أخصائي نفسي وعصبي معرفي",
    descriptionFr: "Bilans psychométriques (WISC), soutien affectif, gestion des émotions et remédiation cognitive.",
    descriptionAr: "التقييم النفسي المعرفي ودعم الصحة النفسية والنمو السلوكي والعاطفي للطفل والمراهق.",
    badgeFr: "Psychologie",
    badgeAr: "علم النفس",
    defaultDurationMinutes: 60,
    defaultInPersonPriceMillimes: 60000,
    defaultOnlinePriceMillimes: 50000,
    iconName: "Brain",
  },
  PSYCHOMOTRICIEN: {
    key: "PSYCHOMOTRICIEN",
    labelFr: "Psychomotricien",
    labelAr: "أخصائي علاج حركي ذهني",
    descriptionFr: "Régulation tonique, motricité fine/globale, repérage spatio-temporel et schéma corporel.",
    descriptionAr: "تنمية وتأهيل المهارات الحركية الدقيقة والتوازن والوعي الجسدي والتناسق المكاني.",
    badgeFr: "Psychomotricité",
    badgeAr: "علاج حركي",
    defaultDurationMinutes: 45,
    defaultInPersonPriceMillimes: 45000,
    defaultOnlinePriceMillimes: 35000,
    iconName: "Activity",
  },
  ERGOTHERAPEUTE: {
    key: "ERGOTHERAPEUTE",
    labelFr: "Ergothérapeute",
    labelAr: "أخصائي علاج وظيفي",
    descriptionFr: "Autonomie aux activités quotidiennes, adaptation des outils scolaires et intégration sensorielle.",
    descriptionAr: "تمكين الطفل من الاستقلالية اليومية وتكييف الأدوات المدرسية والوسائل المساعدة.",
    badgeFr: "Ergothérapie",
    badgeAr: "علاج وظيفي",
    defaultDurationMinutes: 45,
    defaultInPersonPriceMillimes: 50000,
    defaultOnlinePriceMillimes: 40000,
    iconName: "Sparkles",
  },
  PEDOPSYCHIATRE: {
    key: "PEDOPSYCHIATRE",
    labelFr: "Pédopsychiatre",
    labelAr: "طبيب نفسي للأطفال واليافعين",
    descriptionFr: "Diagnostic médical des troubles neurodéveloppementaux (TSA, TDAH, troubles de l'humeur).",
    descriptionAr: "التشخيص الطبي المتخصص والمتابعة العلاجية لاضطرابات النمو العصبي والوجداني.",
    badgeFr: "Pédopsychiatrie",
    badgeAr: "طب نفسي أطفال",
    defaultDurationMinutes: 45,
    defaultInPersonPriceMillimes: 80000,
    defaultOnlinePriceMillimes: 70000,
    iconName: "Stethoscope",
  },
  ORTHOPEDAGOGUE: {
    key: "ORTHOPEDAGOGUE",
    labelFr: "Orthopédagogue & Éducateur Spécialisé",
    labelAr: "أخصائي تربية خاصة وصعوبات تعلم",
    descriptionFr: "Stratégies d'apprentissage personnalisées, adaptation pédagogique et guidance parentale.",
    descriptionAr: "خطط التعلم الفردية وتكييف المناهج المدرسية وتطوير استراتيجيات الفهم والاستيعاب.",
    badgeFr: "Orthopédagogie",
    badgeAr: "تربية خاصة",
    defaultDurationMinutes: 60,
    defaultInPersonPriceMillimes: 40000,
    defaultOnlinePriceMillimes: 35000,
    iconName: "GraduationCap",
  },
  AUTRE_SPECIALISTE: {
    key: "AUTRE_SPECIALISTE",
    labelFr: "Autre Spécialiste du Développement",
    labelAr: "أخصائي نمائي وتأهيلي آخر",
    descriptionFr: "Accompagnement pluridisciplinaire spécialisé en développement de l'enfant et de l'adolescent.",
    descriptionAr: "متابعة متخصصة ومرافقة تأهيلية متعددة التخصصات في نمو وتطور الطفل.",
    badgeFr: "Spécialité Dév.",
    badgeAr: "تخصص نمائي",
    defaultDurationMinutes: 45,
    defaultInPersonPriceMillimes: 45000,
    defaultOnlinePriceMillimes: 35000,
    iconName: "UserCheck",
  },
};

export const SPECIALIST_CATEGORY_LIST = Object.values(SPECIALIST_CATEGORIES);

export function getSpecialistCategoryMeta(key?: string | null): SpecialistCategoryMeta {
  if (key && key in SPECIALIST_CATEGORIES) {
    return SPECIALIST_CATEGORIES[key as SpecialistCategoryKey];
  }
  return SPECIALIST_CATEGORIES.AUTRE_SPECIALISTE;
}
