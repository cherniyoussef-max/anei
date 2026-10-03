import type { Locale } from "@/types";

export const avsNameMap: Record<string, { ar: string; initialsAr: string }> = {
  "Aymen Chaabane": { ar: "أيمن شعبان", initialsAr: "أ.ش" },
  "Mohamed Ali Jebali": { ar: "محمد علي الجبالي", initialsAr: "م.ج" },
  "Nourhene Trabelsi": { ar: "نورهان الطرابلسي", initialsAr: "ن.ط" },
  "Salma Karray": { ar: "سلمى كراي", initialsAr: "س.ك" },
  "Rim Ben Amor": { ar: "ريم بن عمر", initialsAr: "ر.ع" },
  "Yassine Mansour": { ar: "ياسين منصور", initialsAr: "ي.م" },
  "Salma Ben Youssef": { ar: "سلمى بن يوسف", initialsAr: "س.ي" },
  "Ahmed Triki": { ar: "أحمد التريكي", initialsAr: "أ.ت" },
};

export const trainerNameMap: Record<string, { ar: string; initialsAr: string }> = {
  "Dr. Amira Ben Salem": { ar: "د. أميرة بن سالم", initialsAr: "أ.س" },
  "Dr. Youssef Trabelsi": { ar: "د. يوسف الطرابلسي", initialsAr: "ي.ط" },
  "Nadia Gharbi": { ar: "نادية الغربي", initialsAr: "ن.غ" },
  "Meriem Khelifi": { ar: "مريم الخليفي", initialsAr: "م.خ" },
  "Sonia Ayari": { ar: "سنية العياري", initialsAr: "س.ع" },
};

export const domainLabels: Record<string, string> = {
  "Autisme (TSA)": "طيف التوحد (TSA)",
  "Troubles de la communication": "اضطرابات التواصل",
  "Gestion des émotions": "التحكم في الانفعالات",
  "Intégration scolaire": "الاندماج المدرسي",
  "Dyslexie / Dysorthographie": "عسر القراءة والإملاء",
  "Dyspraxie": "عسر الحركة والتعذر الإرادي",
  "TDAH": "فرط الحركة وتشتت الانتباه",
  "Adaptations numériques": "التكييف الرقمي للمناهج",
  "Trisomie 21": "متلازمة داون",
  "Déficience intellectuelle": "الإعاقة الذهنية",
  "Autonomie quotidienne": "الاستقلالية اليومية",
  "Activités sensori-motrices": "الأنشطة الحركية والحسية",
  "Handicap moteur": "الإعاقة الحركية",
  "Ergonomie de classe": "التهيئة المادية للقسم",
  "Assistance aux gestes scolaires": "المساعدة في الأنشطة المدرسية",
  "Autonomie": "الاستقلالية",
  "Déficience visuelle": "ضعف أو كف البصر",
  "Déficience auditive": "ضعف أو فقدان السمع",
  "Intégration sensorielle": "التكامل الحسي",
  "Maternelle / CP": "التحضيري والسنوات الأولى",
  "Gestion des crises": "التعامل مع نوبات التوتر",
  "Habiletés sociales": "المهارات الاجتماعية",
  "Renforcement motivationnel": "التحفيز الإيجابي",
  "Liaison école-famille": "الربط بين المدرسة والأسرة",
  "Accompagnement scolaire général": "مرافقة مدرسية شاملة",
  "Adaptations pédagogiques": "تكييفات بيداغوجية",
};

export const methodLabels: Record<string, string> = {
  "PECS": "نظام بيكس (PECS)",
  "TEACCH": "منهج تيتش (TEACCH)",
  "ABA fonctionnel": "تحليل السلوك التطبيقي (ABA)",
  "Guidance visuelle": "التوجيه البصري",
  "Gestion mentale": "التدبير الذهني",
  "Outils numériques inclusifs": "الأدوات الرقمية الدامجة",
  "Organisation des cahiers": "تنظيم الدفاتر والأدوات",
  "Montessori adapté": "منتسوري مكيّف",
  "Programme Makaton": "برنامج ماكاتون (Makaton)",
  "Séquençage des tâches": "تفكيك وتسلسل المهام",
  "Adaptation posturale": "تعديل الجلسة والوضعية",
  "Guidance physique estompée": "المساعدة الحركية المتدرجة",
  "Outils d'écriture adaptés": "أدوات كتابة مكيّفة",
  "Supports tactiles": "الوسائط اللمسية",
  "Langage gestuel simplifié": "لغة الإشارة المبسطة",
  "Structuration visuelle": "الهيكلة البصرية",
  "Contrats comportementaux": "عقود السلوك",
  "Scénarios sociaux": "القصص والسيناريوهات الاجتماعية",
  "Renforcement différentiel": "التعزيز التفاضلي",
  "Renforcement positif": "التعزيز الإيجابي",
};

export const courseLevelLabels: Record<string, { ar: string; en: string; fr: string }> = {
  beginner: { ar: "مبتدئ", en: "Beginner", fr: "Débutant" },
  intermediate: { ar: "متوسط", en: "Intermediate", fr: "Intermédiaire" },
  advanced: { ar: "متقدم", en: "Advanced", fr: "Avancé" },
};

export const courseModeLabels: Record<string, { ar: string; en: string; fr: string }> = {
  online: { ar: "عن بعد", en: "Online", fr: "En ligne" },
  hybrid: { ar: "هجين", en: "Hybrid", fr: "Hybride" },
  onsite: { ar: "حضوري", en: "On site", fr: "Présentiel" },
};

export const courseCategoryLabels: Record<string, { ar: string; en: string; fr: string }> = {
  "pedagogie-inclusive": { ar: "البيداغوجيا الدامجة", en: "Inclusive Pedagogy", fr: "Pédagogie inclusive" },
  "accompagnement-scolaire": { ar: "المرافقة المدرسية", en: "School Support", fr: "Accompagnement scolaire" },
  "troubles-apprentissage": { ar: "صعوبات التعلم", en: "Learning Disabilities", fr: "Troubles de l'apprentissage" },
  "adaptation-pedagogique": { ar: "التكييف البيداغوجي", en: "Pedagogical Adaptation", fr: "Adaptation pédagogique" },
  "gestion-comportement": { ar: "إدارة السلوك والتواصل", en: "Behavior Management", fr: "Gestion des comportements" },
  "outils-numeriques": { ar: "الأدوات الرقمية الدامجة", en: "Digital Inclusive Tools", fr: "Outils numériques inclusifs" },
};

function defaultInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

export function localizeAvsName(name: string, locale: Locale): string {
  if (locale === "ar" && avsNameMap[name]) {
    return avsNameMap[name].ar;
  }
  return name;
}

export function localizeAvsInitials(name: string, locale: Locale): string {
  if (locale === "ar" && avsNameMap[name]) {
    return avsNameMap[name].initialsAr;
  }
  return defaultInitials(name);
}

export function localizeTrainerName(name: string, locale: Locale): string {
  if (locale === "ar" && trainerNameMap[name]) {
    return trainerNameMap[name].ar;
  }
  return name;
}

export function localizeTrainerInitials(name: string, locale: Locale): string {
  if (locale === "ar" && trainerNameMap[name]) {
    return trainerNameMap[name].initialsAr;
  }
  return defaultInitials(name);
}

export function localizeDomain(domain: string, locale: Locale): string {
  if (locale === "ar" && domainLabels[domain]) {
    return domainLabels[domain];
  }
  return domain;
}

export function localizeMethod(method: string, locale: Locale): string {
  if (locale === "ar" && methodLabels[method]) {
    return methodLabels[method];
  }
  return method;
}

export function localizeCourseLevel(level: string, locale: Locale): string {
  const item = courseLevelLabels[level.toLowerCase()];
  if (item) return item[locale] || item.fr;
  return level;
}

export function localizeCourseMode(mode: string, locale: Locale): string {
  const item = courseModeLabels[mode.toLowerCase()];
  if (item) return item[locale] || item.fr;
  return mode;
}

export function localizeCourseCategory(category: string, locale: Locale): string {
  const normalized = category.toLowerCase().replace(/\s+/g, "-");
  const item = courseCategoryLabels[normalized];
  if (item) return item[locale] || item.fr;
  return category.replaceAll("-", " ");
}
