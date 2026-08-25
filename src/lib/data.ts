import type { AvsProfile, Course, NewsItem, Resource, Webinar } from "@/types";

export const courses: Course[] = [
  {
    slug: "fondamentaux-education-inclusive",
    category: "education",
    title: { en: "Foundations of inclusive education", fr: "Fondamentaux de l’éducation inclusive", ar: "أساسيات التربية الدامجة" },
    description: {
      en: "Understand the principles, intervention frameworks and practices that make schools meaningfully inclusive.",
      fr: "Comprendre les principes, les cadres d’intervention et les pratiques qui rendent l’école réellement inclusive.",
      ar: "فهم مبادئ وأطر التدخل والممارسات التي تجعل المدرسة دامجة فعليًا."
    },
    objectives: {
      en: ["Identify additional learning needs", "Adapt the learning environment", "Build an individual support plan"],
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
    title: { en: "Professional practice for AVS support", fr: "AVS : accompagnement professionnel", ar: "المرافق المدرسي: مرافقة مهنية" },
    description: {
      en: "A practical pathway for supporting learners with method, ethics and multidisciplinary coordination.",
      fr: "Un parcours pratique pour accompagner l’élève avec méthode, éthique et coordination pluridisciplinaire.",
      ar: "مسار عملي لمرافقة التلميذ بمنهجية وأخلاقيات وتنسيق متعدد الاختصاصات."
    },
    objectives: {
      en: ["Observe without over-interpreting", "Build learner autonomy", "Work with the education team"],
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
    title: { en: "Autism and the inclusive classroom", fr: "TSA et classe inclusive", ar: "طيف التوحّد والقسم الدامج" },
    description: {
      en: "Concrete strategies to structure the classroom, support communication and anticipate complex situations.",
      fr: "Stratégies concrètes pour structurer la classe, soutenir la communication et anticiper les situations complexes.",
      ar: "استراتيجيات عملية لتنظيم القسم ودعم التواصل واستباق المواقف المعقدة."
    },
    objectives: {
      en: ["Structure classroom routines", "Support communication", "Prevent sensory overload"],
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
    title: { en: "Differentiated teaching", fr: "Différenciation pédagogique", ar: "التفريد البيداغوجي" },
    description: {
      en: "Design accessible activities for different learner profiles without lowering academic expectations.",
      fr: "Concevoir des activités accessibles à plusieurs profils d’apprenants sans réduire l’exigence pédagogique.",
      ar: "تصميم أنشطة متاحة لمتعلمين بملفات مختلفة دون خفض المستوى التربوي."
    },
    objectives: {
      en: ["Vary materials and instructions", "Use varied assessment methods", "Plan reasonable adaptations"],
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
    title: { en: "Augmentative and alternative communication", fr: "Communication alternative et améliorée", ar: "التواصل البديل والمعزّز" },
    description: {
      en: "Explore AAC tools and learn to integrate them into everyday education settings.",
      fr: "Découvrir les outils de CAA et apprendre à les intégrer dans des situations éducatives quotidiennes.",
      ar: "اكتشاف أدوات التواصل البديل ودمجها في المواقف التربوية اليومية."
    },
    objectives: {
      en: ["Choose an appropriate support", "Create communication routines", "Measure progress"],
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
    title: { en: "Families as partners in inclusion", fr: "Parents partenaires de l’inclusion", ar: "الأولياء شركاء في الدمج" },
    description: {
      en: "Strengthen family-school cooperation with practical tools for dialogue, follow-up and joint planning.",
      fr: "Renforcer la coopération famille-école avec des outils de dialogue, de suivi et de co-construction.",
      ar: "تعزيز التعاون بين الأسرة والمدرسة بأدوات للحوار والمتابعة والبناء المشترك."
    },
    objectives: {
      en: ["Prepare for meetings", "Share useful observations", "Define shared goals"],
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
    title: { en: "Inclusive schools: from intention to action", fr: "École inclusive : de l’intention à l’action", ar: "المدرسة الدامجة: من النية إلى التطبيق" },
    description: { en: "A practical route from isolated initiatives to a whole-school approach.", fr: "Une feuille de route pour passer d’initiatives isolées à une démarche d’établissement.", ar: "خارطة طريق للانتقال من مبادرات فردية إلى مقاربة مؤسساتية." },
    date: "2026-08-20",
    time: "18:00",
    trainer: "Dr. Amira Ben Salem",
    status: "upcoming"
  },
  {
    id: 2,
    title: { en: "Understanding executive functions", fr: "Comprendre les fonctions exécutives", ar: "فهم الوظائف التنفيذية" },
    description: { en: "Clear reference points and tools for attention, planning and inhibition.", fr: "Repères simples et outils pour soutenir attention, planification et inhibition.", ar: "مفاهيم وأدوات لدعم الانتباه والتخطيط والتحكم." },
    date: "2026-09-03",
    time: "19:00",
    trainer: "Dr. Youssef Trabelsi",
    status: "upcoming"
  },
  {
    id: 3,
    title: { en: "Working with families", fr: "Coopérer avec les familles", ar: "التعاون مع العائلات" },
    description: { en: "Communication techniques for building durable partnerships.", fr: "Techniques de communication pour construire une alliance durable.", ar: "تقنيات تواصل لبناء شراكة مستدامة." },
    date: "2026-06-10",
    time: "18:30",
    trainer: "Sonia Ayari",
    status: "replay"
  }
];

export const avsProfiles: AvsProfile[] = [
  { id: 1, name: "Salma Karray", city: { en: "Tunis", fr: "Tunis", ar: "تونس" }, specialty: { en: "Autism and communication", fr: "TSA & communication", ar: "طيف التوحّد والتواصل" }, availability: { en: "Available weekdays", fr: "Disponible en semaine", ar: "متاحة خلال الأسبوع" }, certified: true, initials: "SK" },
  { id: 2, name: "Mohamed Ali Jebali", city: { en: "Ariana", fr: "Ariana", ar: "أريانة" }, specialty: { en: "Specific learning differences", fr: "Troubles DYS", ar: "اضطرابات التعلم" }, availability: { en: "Available mornings", fr: "Disponible le matin", ar: "متاح صباحًا" }, certified: true, initials: "MJ" },
  { id: 3, name: "Rim Ben Amor", city: { en: "Sousse", fr: "Sousse", ar: "سوسة" }, specialty: { en: "Intellectual disability", fr: "Déficience intellectuelle", ar: "الإعاقة الذهنية" }, availability: { en: "Available now", fr: "Disponible immédiatement", ar: "متاحة فورًا" }, certified: true, initials: "RB" },
  { id: 4, name: "Aymen Chaabane", city: { en: "Sfax", fr: "Sfax", ar: "صفاقس" }, specialty: { en: "Learner independence", fr: "Autonomie scolaire", ar: "الاستقلالية المدرسية" }, availability: { en: "Available part-time", fr: "Disponible à mi-temps", ar: "متاح بدوام جزئي" }, certified: true, initials: "AC" }
];

export const resources: Resource[] = [
  {
    id: 1,
    title: { en: "Practical guide for AVS professionals", fr: "Guide pratique de l’AVS", ar: "الدليل العملي للمرافق المدرسي" },
    description: { en: "Reference points, observation tools, follow-up templates and professional practice.", fr: "Repères, outils d’observation, modèles de suivi et bonnes pratiques professionnelles.", ar: "مراجع وأدوات للملاحظة ونماذج للمتابعة وممارسات مهنية جيدة." },
    audience: { en: "AVS professionals and educators", fr: "AVS & éducateurs", ar: "المرافقون والمربون" },
    type: "guide",
    price: 38,
    accent: "blue"
  },
  {
    id: 2,
    title: { en: "Classroom observation framework", fr: "Grille d’observation en classe", ar: "شبكة الملاحظة داخل القسم" },
    description: { en: "A structured framework for documenting context, behaviour, support and development.", fr: "Une grille structurée pour documenter contexte, comportement, aides et évolution.", ar: "شبكة منظمة لتوثيق السياق والسلوك والدعم والتطور." },
    audience: { en: "Teachers and psychologists", fr: "Enseignants & psychologues", ar: "المدرسون والأخصائيون النفسيون" },
    type: "sheet",
    price: 16,
    accent: "cyan"
  },
  {
    id: 3,
    title: { en: "Inclusive school toolkit", fr: "Kit école inclusive", ar: "حقيبة المدرسة الدامجة" },
    description: { en: "Posters, checklists, meeting sheets and coordination tools for schools.", fr: "Affiches, checklists, fiches de réunion et outils de coordination pour les établissements.", ar: "ملصقات وقوائم تحقق وأوراق اجتماعات وأدوات تنسيق للمؤسسات." },
    audience: { en: "Schools", fr: "Établissements scolaires", ar: "المؤسسات التعليمية" },
    type: "tool",
    price: 64,
    accent: "green"
  },
  {
    id: 4,
    title: { en: "Family-school cooperation manual", fr: "Manuel : coopération famille-école", ar: "دليل التعاون بين الأسرة والمدرسة" },
    description: { en: "Methods for preparing meetings, agreeing goals and writing useful follow-up notes.", fr: "Méthodes de préparation des entretiens, objectifs partagés et comptes rendus utiles.", ar: "طرق لإعداد المقابلات وصياغة الأهداف المشتركة والتقارير المفيدة." },
    audience: { en: "Families and professionals", fr: "Parents & professionnels", ar: "الأولياء والمهنيون" },
    type: "manual",
    price: 29,
    accent: "violet"
  }
];

export const newsItems: NewsItem[] = [
  {
    id: 1,
    title: { en: "Enrollment opens for the 2026 intake", fr: "Ouverture des inscriptions - rentrée 2026", ar: "فتح التسجيل لدورة 2026" },
    excerpt: { en: "Enrollment is open for new certificate pathways across several learning formats.", fr: "Les nouveaux parcours certifiants sont ouverts aux inscriptions avec plusieurs formats d’apprentissage.", ar: "تم فتح التسجيل في المسارات الجديدة مع صيغ تعلم متعددة." },
    date: "2026-07-22",
    tag: { en: "Learning", fr: "Formation", ar: "تكوين" }
  },
  {
    id: 2,
    title: { en: "A new certification framework for AVS professionals", fr: "Nouveau référentiel de certification AVS", ar: "مرجع جديد لاعتماد المرافق المدرسي" },
    excerpt: { en: "The AVS pathway now includes more supervised practice and competency-based assessment.", fr: "Le parcours AVS évolue avec davantage de pratique supervisée et d’évaluation par compétences.", ar: "يتطور مسار المرافق المدرسي مع مزيد من التطبيق المؤطر والتقييم بالكفاءات." },
    date: "2026-07-15",
    tag: { en: "Certification", fr: "Certification", ar: "اعتماد" }
  },
  {
    id: 3,
    title: { en: "A partnership for accessible learning", fr: "Partenariat pour l’accessibilité pédagogique", ar: "شراكة من أجل الإتاحة التربوية" },
    excerpt: { en: "A new collaboration strengthens the production of accessible bilingual resources.", fr: "Une nouvelle collaboration renforce la production de ressources accessibles et bilingues.", ar: "تعاون جديد يعزز إنتاج موارد تعليمية ميسّرة وثنائية اللغة." },
    date: "2026-07-05",
    tag: { en: "Partnership", fr: "Partenariat", ar: "شراكة" }
  }
];
