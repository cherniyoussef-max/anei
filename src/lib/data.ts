import type { AvsProfile, Course, NewsItem, Resource, Webinar } from "@/types";

export const courses: Course[] = [
  {
    slug: "fondamentaux-education-inclusive",
    category: "education",
    title: { fr: "Fondamentaux de l’éducation inclusive", ar: "أساسيات التربية الدامجة" },
    description: {
      fr: "Comprendre les principes, les cadres d’intervention et les pratiques qui rendent l’école réellement inclusive.",
      ar: "فهم مبادئ وأطر التدخل والممارسات التي تجعل المدرسة دامجة فعليًا."
    },
    objectives: {
      fr: ["Identifier les besoins éducatifs particuliers", "Adapter l’environnement d’apprentissage", "Construire un plan d’accompagnement"],
      ar: ["تحديد الاحتياجات التربوية الخاصة", "تكييف بيئة التعلم", "بناء خطة مرافقة"]
    },
    duration: "24 h",
    startDate: "2026-09-12",
    trainer: "Dr. Amira Ben Salem",
    price: 240,
    mode: "hybrid",
    level: "beginner",
    accent: "blue"
  },
  {
    slug: "avs-accompagnement-professionnel",
    category: "avs",
    title: { fr: "AVS : accompagnement professionnel", ar: "المرافق المدرسي: مرافقة مهنية" },
    description: {
      fr: "Un parcours pratique pour accompagner l’élève avec méthode, éthique et coordination pluridisciplinaire.",
      ar: "مسار عملي لمرافقة التلميذ بمنهجية وأخلاقيات وتنسيق متعدد الاختصاصات."
    },
    objectives: {
      fr: ["Observer sans surinterpréter", "Favoriser l’autonomie", "Collaborer avec l’équipe éducative"],
      ar: ["الملاحظة دون تأويل زائد", "تعزيز الاستقلالية", "التعاون مع الفريق التربوي"]
    },
    duration: "36 h",
    startDate: "2026-09-28",
    trainer: "Nadia Gharbi",
    price: 320,
    mode: "online",
    level: "intermediate",
    accent: "cyan"
  },
  {
    slug: "tsa-classe-inclusive",
    category: "special-needs",
    title: { fr: "TSA et classe inclusive", ar: "طيف التوحّد والقسم الدامج" },
    description: {
      fr: "Stratégies concrètes pour structurer la classe, soutenir la communication et anticiper les situations complexes.",
      ar: "استراتيجيات عملية لتنظيم القسم ودعم التواصل واستباق المواقف المعقدة."
    },
    objectives: {
      fr: ["Structurer les routines", "Soutenir la communication", "Prévenir les surcharges sensorielles"],
      ar: ["تنظيم الروتين", "دعم التواصل", "الوقاية من فرط التحفيز الحسي"]
    },
    duration: "18 h",
    startDate: "2026-10-05",
    trainer: "Dr. Youssef Trabelsi",
    price: 210,
    mode: "online",
    level: "intermediate",
    accent: "violet"
  },
  {
    slug: "differenciation-pedagogique",
    category: "teaching",
    title: { fr: "Différenciation pédagogique", ar: "التفريد البيداغوجي" },
    description: {
      fr: "Concevoir des activités accessibles à plusieurs profils d’apprenants sans réduire l’exigence pédagogique.",
      ar: "تصميم أنشطة متاحة لمتعلمين بملفات مختلفة دون خفض المستوى التربوي."
    },
    objectives: {
      fr: ["Varier supports et consignes", "Évaluer autrement", "Planifier des adaptations raisonnables"],
      ar: ["تنويع الوسائط والتعليمات", "تنويع التقييم", "تخطيط تكييفات مناسبة"]
    },
    duration: "16 h",
    startDate: "2026-10-19",
    trainer: "Inès Jlassi",
    price: 190,
    mode: "onsite",
    level: "beginner",
    accent: "green"
  },
  {
    slug: "communication-alternative-aac",
    category: "communication",
    title: { fr: "Communication alternative et améliorée", ar: "التواصل البديل والمعزّز" },
    description: {
      fr: "Découvrir les outils de CAA et apprendre à les intégrer dans des situations éducatives quotidiennes.",
      ar: "اكتشاف أدوات التواصل البديل ودمجها في المواقف التربوية اليومية."
    },
    objectives: {
      fr: ["Choisir un support adapté", "Créer des routines de communication", "Mesurer la progression"],
      ar: ["اختيار وسيلة مناسبة", "إنشاء روتين للتواصل", "قياس التقدم"]
    },
    duration: "20 h",
    startDate: "2026-11-02",
    trainer: "Meriem Khelifi",
    price: 260,
    mode: "hybrid",
    level: "advanced",
    accent: "orange"
  },
  {
    slug: "parents-partenaires-inclusion",
    category: "family",
    title: { fr: "Parents partenaires de l’inclusion", ar: "الأولياء شركاء في الدمج" },
    description: {
      fr: "Renforcer la coopération famille-école avec des outils de dialogue, de suivi et de co-construction.",
      ar: "تعزيز التعاون بين الأسرة والمدرسة بأدوات للحوار والمتابعة والبناء المشترك."
    },
    objectives: {
      fr: ["Préparer les réunions", "Partager des observations utiles", "Définir des objectifs communs"],
      ar: ["إعداد الاجتماعات", "تبادل ملاحظات مفيدة", "تحديد أهداف مشتركة"]
    },
    duration: "10 h",
    startDate: "2026-11-14",
    trainer: "Sonia Ayari",
    price: 120,
    mode: "online",
    level: "beginner",
    accent: "rose"
  }
];

export const webinars: Webinar[] = [
  {
    id: 1,
    title: { fr: "École inclusive : de l’intention à l’action", ar: "المدرسة الدامجة: من النية إلى التطبيق" },
    description: { fr: "Une feuille de route pour passer d’initiatives isolées à une démarche d’établissement.", ar: "خارطة طريق للانتقال من مبادرات فردية إلى مقاربة مؤسساتية." },
    date: "2026-08-20",
    time: "18:00",
    trainer: "Dr. Amira Ben Salem",
    status: "upcoming"
  },
  {
    id: 2,
    title: { fr: "Comprendre les fonctions exécutives", ar: "فهم الوظائف التنفيذية" },
    description: { fr: "Repères simples et outils pour soutenir attention, planification et inhibition.", ar: "مفاهيم وأدوات لدعم الانتباه والتخطيط والتحكم." },
    date: "2026-09-03",
    time: "19:00",
    trainer: "Dr. Youssef Trabelsi",
    status: "upcoming"
  },
  {
    id: 3,
    title: { fr: "Coopérer avec les familles", ar: "التعاون مع العائلات" },
    description: { fr: "Techniques de communication pour construire une alliance durable.", ar: "تقنيات تواصل لبناء شراكة مستدامة." },
    date: "2026-06-10",
    time: "18:30",
    trainer: "Sonia Ayari",
    status: "replay"
  }
];

export const avsProfiles: AvsProfile[] = [
  { id: 1, name: "Salma Karray", city: { fr: "Tunis", ar: "تونس" }, specialty: { fr: "TSA & communication", ar: "طيف التوحّد والتواصل" }, availability: { fr: "Disponible en semaine", ar: "متاحة خلال الأسبوع" }, certified: true, initials: "SK" },
  { id: 2, name: "Mohamed Ali Jebali", city: { fr: "Ariana", ar: "أريانة" }, specialty: { fr: "Troubles DYS", ar: "اضطرابات التعلم" }, availability: { fr: "Disponible le matin", ar: "متاح صباحًا" }, certified: true, initials: "MJ" },
  { id: 3, name: "Rim Ben Amor", city: { fr: "Sousse", ar: "سوسة" }, specialty: { fr: "Déficience intellectuelle", ar: "الإعاقة الذهنية" }, availability: { fr: "Disponible immédiatement", ar: "متاحة فورًا" }, certified: true, initials: "RB" },
  { id: 4, name: "Aymen Chaabane", city: { fr: "Sfax", ar: "صفاقس" }, specialty: { fr: "Autonomie scolaire", ar: "الاستقلالية المدرسية" }, availability: { fr: "Disponible à mi-temps", ar: "متاح بدوام جزئي" }, certified: true, initials: "AC" }
];

export const resources: Resource[] = [
  {
    id: 1,
    title: { fr: "Guide pratique de l’AVS", ar: "الدليل العملي للمرافق المدرسي" },
    description: { fr: "Repères, outils d’observation, modèles de suivi et bonnes pratiques professionnelles.", ar: "مراجع وأدوات للملاحظة ونماذج للمتابعة وممارسات مهنية جيدة." },
    audience: { fr: "AVS & éducateurs", ar: "المرافقون والمربون" },
    type: "guide",
    price: 38,
    accent: "blue"
  },
  {
    id: 2,
    title: { fr: "Grille d’observation en classe", ar: "شبكة الملاحظة داخل القسم" },
    description: { fr: "Une grille structurée pour documenter contexte, comportement, aides et évolution.", ar: "شبكة منظمة لتوثيق السياق والسلوك والدعم والتطور." },
    audience: { fr: "Enseignants & psychologues", ar: "المدرسون والأخصائيون النفسيون" },
    type: "sheet",
    price: 16,
    accent: "cyan"
  },
  {
    id: 3,
    title: { fr: "Kit école inclusive", ar: "حقيبة المدرسة الدامجة" },
    description: { fr: "Affiches, checklists, fiches de réunion et outils de coordination pour les établissements.", ar: "ملصقات وقوائم تحقق وأوراق اجتماعات وأدوات تنسيق للمؤسسات." },
    audience: { fr: "Établissements scolaires", ar: "المؤسسات التعليمية" },
    type: "tool",
    price: 64,
    accent: "green"
  },
  {
    id: 4,
    title: { fr: "Manuel : coopération famille-école", ar: "دليل التعاون بين الأسرة والمدرسة" },
    description: { fr: "Méthodes de préparation des entretiens, objectifs partagés et comptes rendus utiles.", ar: "طرق لإعداد المقابلات وصياغة الأهداف المشتركة والتقارير المفيدة." },
    audience: { fr: "Parents & professionnels", ar: "الأولياء والمهنيون" },
    type: "manual",
    price: 29,
    accent: "violet"
  }
];

export const newsItems: NewsItem[] = [
  {
    id: 1,
    title: { fr: "Ouverture des inscriptions – rentrée 2026", ar: "فتح التسجيل لدورة 2026" },
    excerpt: { fr: "Les nouveaux parcours certifiants sont ouverts aux inscriptions avec plusieurs formats d’apprentissage.", ar: "تم فتح التسجيل في المسارات الجديدة مع صيغ تعلم متعددة." },
    date: "2026-07-22",
    tag: { fr: "Formation", ar: "تكوين" }
  },
  {
    id: 2,
    title: { fr: "Nouveau référentiel de certification AVS", ar: "مرجع جديد لاعتماد المرافق المدرسي" },
    excerpt: { fr: "Le parcours AVS évolue avec davantage de pratique supervisée et d’évaluation par compétences.", ar: "يتطور مسار المرافق المدرسي مع مزيد من التطبيق المؤطر والتقييم بالكفاءات." },
    date: "2026-07-15",
    tag: { fr: "Certification", ar: "اعتماد" }
  },
  {
    id: 3,
    title: { fr: "Partenariat pour l’accessibilité pédagogique", ar: "شراكة من أجل الإتاحة التربوية" },
    excerpt: { fr: "Une nouvelle collaboration renforce la production de ressources accessibles et bilingues.", ar: "تعاون جديد يعزز إنتاج موارد تعليمية ميسّرة وثنائية اللغة." },
    date: "2026-07-05",
    tag: { fr: "Partenariat", ar: "شراكة" }
  }
];
