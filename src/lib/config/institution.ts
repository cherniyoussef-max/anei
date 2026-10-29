/**
 * SINGLE SOURCE OF TRUTH — INSTITUTIONAL DATA & METADATA (ANEI)
 *
 * All public-facing institutional facts (contact, addresses, legal names,
 * hours, official channels) are centralized here.
 * Components must NOT hardcode one-off emails, phones, or addresses.
 *
 * Any fields marked with TODO(owner) await final official confirmation.
 */

export const INSTITUTION = {
  legalName: {
    fr: "L'Académie Nationale de l'Éducation Inclusive",
    ar: "الأكاديمية الوطنية للتربية الدامجة",
    short: "ANEI",
  },
  tagline: {
    fr: "Plateforme bilingue de formation continue, ressources certifiantes et réseau de professionnels au service de l'école inclusive.",
    ar: "منصة وطنية رائدة للتكوين المستمر، الموارد المتخصصة وشبكة مرافقي وأخصائيي التربية الدامجة في تونس.",
  },

  // TODO(owner): Confirm official general public contact email.
  contactEmail: "contact@anei.tn",
  supportEmail: "support@anei.tn",

  // Phone numbers (Tunisia national and regional hubs)
  // TODO(owner): Confirm reception telephone line numbers.
  phones: {
    national: "+216 71 840 100",
    tunis: "+216 71 840 100",
    sousse: "+216 73 360 220",
    sfax: "+216 74 420 330",
  },

  // Physical campus and regional locations
  // TODO(owner): Confirm exact building / street address for Tunis central campus.
  locations: {
    tunis: {
      nameFr: "Siège National & Campus Principal",
      nameAr: "المقر الوطني والحرم الجامعي الرئيسي",
      cityFr: "Grand Tunis",
      cityAr: "تونس العاصمة",
      addressFr: "Centre Urbain Nord, 1082 Tunis, Tunisie (Station Cité des Sciences)",
      addressAr: "المركز العمراني الشمالي، 1082 تونس (محطة مدينة العلوم)",
      phone: "+216 71 840 100",
      email: "contact@anei.tn",
      hoursFr: "Lundi au Vendredi · 08h30 - 17h30",
      hoursAr: "الإثنين إلى الجمعة · 08:30 - 17:30",
      transitFr: "Métro 2 (Station Cité des Sciences) • Bus 35 & 44 • Accès autoroute RN8",
      transitAr: "مترو خفيف خط 2 (محطة مدينة العلوم) • حافلات خط 35 و 44",
      accessFr: "Accès PMR universel • Rampes d'accès • Parking réservé",
      accessAr: "مهيأ بالكامل لذوي الإعاقة (PMR) • مواقف سيارات مخصصة",
    },
    sousse: {
      nameFr: "Pôle Régional Sahel & Centre",
      nameAr: "القطب الإقليمي للوسط والساحل",
      cityFr: "Sousse",
      cityAr: "سوسة",
      addressFr: "Rue Ibn Khaldoun, Sahloul, Sousse, Tunisie",
      addressAr: "نهج ابن خلدون، سهلول، سوسة، تونس",
      phone: "+216 73 360 220",
      email: "sahel@anei.tn",
      hoursFr: "Lundi au Vendredi · 09h00 - 16h30",
      hoursAr: "الإثنين إلى الجمعة · 09:00 - 16:30",
      transitFr: "Métro du Sahel (Station Sahloul)",
      transitAr: "محطة مترو الساحل سهلول",
      accessFr: "Accessible PMR",
      accessAr: "ولوج مهيأ بالكامل",
    },
    sfax: {
      nameFr: "Pôle Régional Sud",
      nameAr: "القطب الإقليمي للجنوب",
      cityFr: "Sfax",
      cityAr: "صفاقس",
      addressFr: "Route El Ain Km 1.5, Nouvelle Médina, Sfax, Tunisie",
      addressAr: "طريق العين كم 1.5، صفاقس الجديدة، تونس",
      phone: "+216 74 420 330",
      email: "sud@anei.tn",
      hoursFr: "Lundi au Vendredi · 09h00 - 16h30",
      hoursAr: "الإثنين إلى الجمعة · 09:00 - 16:30",
      transitFr: "Centre-ville Sfax • Lignes urbaines SORETRAS",
      transitAr: "وسط مدينة صفاقس • حافلات النقل الحضري",
      accessFr: "Accessible PMR",
      accessAr: "ولوج مهيأ بالكامل",
    },
  },

  // Opening hours across global touchpoints
  // TODO(owner): Confirm if campus offers Saturday morning appointments.
  generalHours: {
    fr: "Lun - Ven · 08:30 - 17:30",
    ar: "الإثنين - الجمعة · 08:30 - 17:30",
  },

  // Social media accounts
  // TODO(owner): Provide exact URLs for verified institutional accounts.
  social: {
    linkedin: process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN || null,
    facebook: process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK || null,
    youtube: process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE || null,
  },
} as const;
