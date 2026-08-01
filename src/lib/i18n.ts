import type { Locale } from "@/types";

export const locales: Locale[] = ["fr", "ar"];

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export const copy = {
  fr: {
    academy: "Académie Nationale de l’Éducation Inclusive",
    academyShort: "ANEI",
    arabicName: "الأكاديمية الوطنية للتربية الدامجة",
    slogan: "Former, accompagner, inclure.",
    nav: {
      home: "Accueil",
      about: "À propos",
      courses: "Formations",
      webinars: "Webinaires",
      library: "Librairie",
      avs: "Trouver un AVS",
      news: "Actualités",
      contact: "Contact"
    },
    actions: {
      login: "Se connecter",
      register: "Créer un compte",
      discover: "Découvrir les formations",
      details: "Voir les détails",
      enroll: "S’inscrire",
      buy: "Acheter",
      download: "Télécharger",
      contact: "Contacter",
      browse: "Tout voir",
      replay: "Voir le replay",
      dashboard: "Mon espace",
      admin: "Administration",
      learnMore: "En savoir plus"
    }
  },
  ar: {
    academy: "الأكاديمية الوطنية للتربية الدامجة",
    academyShort: "ANEI",
    arabicName: "Académie Nationale de l’Éducation Inclusive",
    slogan: "نتكوّن، نرافق، ندمج.",
    nav: {
      home: "الرئيسية",
      about: "عن الأكاديمية",
      courses: "الدورات",
      webinars: "الندوات",
      library: "المكتبة",
      avs: "ابحث عن مرافق مدرسي",
      news: "الأخبار",
      contact: "اتصل بنا"
    },
    actions: {
      login: "تسجيل الدخول",
      register: "إنشاء حساب",
      discover: "اكتشف الدورات",
      details: "عرض التفاصيل",
      enroll: "سجّل الآن",
      buy: "شراء",
      download: "تحميل",
      contact: "تواصل",
      browse: "عرض الكل",
      replay: "مشاهدة الإعادة",
      dashboard: "مساحتي",
      admin: "الإدارة",
      learnMore: "اعرف المزيد"
    }
  }
} satisfies Record<Locale, unknown>;

export function t(locale: Locale) {
  return copy[locale];
}

export function formatPrice(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "ar-TN", {
    style: "currency",
    currency: "TND",
    maximumFractionDigits: 0
  }).format(value);
}

export function formatMillimes(value: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "ar-TN", {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value / 1000);
}

export function formatDate(value: string | Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "ar-TN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}
