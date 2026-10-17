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
    date: "2026-11-12",
    time: "18:00",
    trainer: "Dr. Amira Ben Salem",
    status: "upcoming"
  },
  {
    id: 2,
    title: { en: "Understanding executive functions", fr: "Comprendre les fonctions exécutives", ar: "فهم الوظائف التنفيذية" },
    description: { en: "Clear reference points and tools for attention, planning and inhibition.", fr: "Repères simples et outils pour soutenir attention, planification et inhibition.", ar: "مفاهيم وأدوات لدعم الانتباه والتخطيط والتحكم." },
    date: "2026-11-26",
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
  {
    id: 1,
    name: "Salma Karray",
    slug: "salma-karray",
    city: { en: "Tunis", fr: "Tunis (Centre-ville & Menzah)", ar: "تونس (وسط العاصمة والمنزه)" },
    governorate: { en: "Tunis", fr: "Tunis", ar: "تونس" },
    specialty: { en: "Autism and communication (TSA)", fr: "TSA & communication adaptée", ar: "طيف التوحّد والتواصل المكيّف" },
    availability: { en: "Available weekdays (Full-time)", fr: "Disponible en semaine (Temps plein)", ar: "متاحة كامل الأسبوع (دوام كامل)" },
    certified: true,
    initials: "SK",
    interventionDomains: ["Autisme (TSA)", "Troubles de la communication", "Gestion des émotions", "Intégration scolaire"],
    pedagogicalMethods: ["PECS", "TEACCH", "ABA fonctionnel", "Guidance visuelle"],
    hourlyRateTnd: 28,
    experienceYears: 5,
    rating: 49,
    reviewCount: 24,
    schoolsCovered: {
      en: "Public and private primary schools in Tunis, Mutuelleville, El Menzah",
      fr: "Écoles primaires publiques et privées du Grand Tunis (Mutuelleville, Menzah, Manar)",
      ar: "المدارس الابتدائية العمومية والخاصة بتونس الكبرى (ميتيال فيل، المنزه، المنار)"
    },
    phone: "+216 98 123 456",
    email: "salma.karray@avs-tunisie.tn",
    bio: {
      en: "Specialized in school inclusion for children on the autism spectrum. Certified in alternative communication methods and individualized behavioral plans.",
      fr: "Accompagnante scolaire certifiée ANEI, spécialisée dans les troubles du spectre de l'autisme (TSA) et la communication alternative. Collaboration active avec les enseignants et l'équipe pluridisciplinaire pour assurer l'autonomie et la socialisation de l'enfant.",
      ar: "مرافقة مدرسية معتمدة من ANEI، مختصة في اضطرابات طيف التوحد والتواصل البديل. تنسيق مباشر مع الإطار التربوي والمختصين لتعزيز استقلالية التلميذ ومشاركته الفعالة داخل القسم."
    }
  },
  {
    id: 2,
    name: "Mohamed Ali Jebali",
    slug: "mohamed-ali-jebali",
    city: { en: "Ariana", fr: "Ariana (Ennasr & Soukra)", ar: "أريانة (النصر وسكرة)" },
    governorate: { en: "Ariana", fr: "Ariana", ar: "أريانة" },
    specialty: { en: "Learning disabilities (DYS & ADHD)", fr: "Troubles DYS & TDAH", ar: "صعوبات التعلم وتشتت الانتباه" },
    availability: { en: "Available mornings (Part-time)", fr: "Disponible les matins (Mi-temps)", ar: "متاح صباحًا (دوام جزئي)" },
    certified: true,
    initials: "MJ",
    interventionDomains: ["Dyslexie / Dysorthographie", "Dyspraxie", "TDAH", "Adaptations numériques"],
    pedagogicalMethods: ["Gestion mentale", "Outils numériques inclusifs", "Organisation des cahiers"],
    hourlyRateTnd: 25,
    experienceYears: 4,
    rating: 48,
    reviewCount: 19,
    schoolsCovered: {
      en: "Primary and secondary schools in Ennasr, Menzah 7-9, La Soukra",
      fr: "Écoles et collèges à Ennasr, Menzah et La Soukra (système tunisien et français)",
      ar: "مدارس وإعداديات بالنصر والمنازه وسكرة (المنهج التونسي والفرنسي)"
    },
    phone: "+216 52 345 678",
    email: "m.jebali@avs-tunisie.tn",
    bio: {
      en: "Accompanying students with DYS disorders and ADHD, focusing on learning strategies, digital adaptations, and working memory support.",
      fr: "Éducateur spécialisé dans l'accompagnement des élèves avec troubles DYS et déficit de l'attention. Mise en place de compensations numériques, d'aides à la prise de notes et de protocoles de gestion de l'attention.",
      ar: "مختص في مرافقة التلاميذ ذوي صعوبات التعلم وفرط الحركة وتشتت الانتباه. توظيف الوسائل الرقمية المساعدة وتنظيم الجهد الذهني لتيسير المسار التعليمي."
    }
  },
  {
    id: 3,
    name: "Rim Ben Amor",
    slug: "rim-ben-amor",
    city: { en: "Sousse", fr: "Sousse (Sahloul & Kantaoui)", ar: "سوسة (سهلول والقنطاوي)" },
    governorate: { en: "Sousse", fr: "Sousse", ar: "سوسة" },
    specialty: { en: "Intellectual disability & Down syndrome", fr: "Déficience intellectuelle & Trisomie 21", ar: "الإعاقة الذهنية ومتلازمة داون" },
    availability: { en: "Available immediately (Full-time)", fr: "Disponible immédiatement (Temps plein)", ar: "متاحة فورًا (دوام كامل)" },
    certified: true,
    initials: "RB",
    interventionDomains: ["Trisomie 21", "Déficience intellectuelle", "Autonomie quotidienne", "Activités sensori-motrices"],
    pedagogicalMethods: ["Montessori adapté", "Programme Makaton", "Séquençage des tâches"],
    hourlyRateTnd: 22,
    experienceYears: 6,
    rating: 50,
    reviewCount: 31,
    schoolsCovered: {
      en: "Schools in Sousse, Sahloul, Hammam Sousse, Kantaoui",
      fr: "Établissements scolaires de Sousse, Sahloul, Hammam Sousse",
      ar: "مؤسسات تربوية بسوسة وسهلول وحمام سوسة"
    },
    phone: "+216 93 456 789",
    email: "rim.benamor@avs-tunisie.tn",
    bio: {
      en: "Experienced AVS dedicated to personalized pacing, cognitive reinforcement, and social inclusion for children with intellectual challenges.",
      fr: "Plus de 6 ans d'expérience dans l'accompagnement d'enfants avec trisomie 21 ou retard de développement. Approche douce et structurée basée sur le jeu pédagogique, le renforcement positif et la coopération étroite avec la famille.",
      ar: "خبرة تفوق 6 سنوات في مرافقة الأطفال ذوي متلازمة داون والتأخر النمائي. اعتماد المرافقة الإيجابية والتدرج في المهارات مع إشراك العائلة والفريق الطبي المتابع."
    }
  },
  {
    id: 4,
    name: "Aymen Chaabane",
    slug: "aymen-chaabane",
    city: { en: "Sfax", fr: "Sfax (Sfax Ville & Sakiet Ezzit)", ar: "صفاقس (المدينة وساقية الزيت)" },
    governorate: { en: "Sfax", fr: "Sfax", ar: "صفاقس" },
    specialty: { en: "School independence & Motor challenges", fr: "Autonomie scolaire & Handicap moteur", ar: "الاستقلالية المدرسية والإعاقة الحركية" },
    availability: { en: "Available part-time", fr: "Disponible à mi-temps (Matin / Aprem)", ar: "متاح بدوام جزئي (صباحي / مسائي)" },
    certified: true,
    initials: "AC",
    interventionDomains: ["Handicap moteur", "Ergonomie de classe", "Assistance aux gestes scolaires", "Autonomie"],
    pedagogicalMethods: ["Adaptation posturale", "Guidance physique estompée", "Outils d'écriture adaptés"],
    hourlyRateTnd: 24,
    experienceYears: 4,
    rating: 47,
    reviewCount: 15,
    schoolsCovered: {
      en: "Schools across Sfax metropolitan area",
      fr: "Écoles primaires et collèges de Sfax Ville, Sakiet Eddaïer et Sakiet Ezzit",
      ar: "المدارس الابتدائية والإعدادية بصفاقس وساقية الدائر وساقية الزيت"
    },
    phone: "+216 25 678 901",
    email: "aymen.chaabane@avs-tunisie.tn",
    bio: {
      en: "Specialist in ergonomics and physical assistance in classroom environments for learners with motor or coordination difficulties.",
      fr: "Spécialisé dans l'accessibilité physique, l'installation ergonomique et la manipulation du matériel scolaire pour les élèves présentant un handicap moteur ou une dyspraxie visuo-spatiale.",
      ar: "مختص في التهيئة المادية والمساعدة الحركية داخل القسم، لدعم التلاميذ ذوي الصعوبات الحركية في الكتابة والتنقل واستعمال الأدوات المدرسية."
    }
  },
  {
    id: 5,
    name: "Nourhene Trabelsi",
    slug: "nourhene-trabelsi",
    city: { en: "Ben Arous", fr: "Ben Arous (Mégrine & Radès)", ar: "بن عروس (مقرين ورادس)" },
    governorate: { en: "Ben Arous", fr: "Ben Arous", ar: "بن عروس" },
    specialty: { en: "Sensory differences & Early intervention", fr: "Troubles sensoriels & Petite enfance", ar: "اضطرابات حسية وتدخل مبكر" },
    availability: { en: "Available weekdays", fr: "Disponible en semaine", ar: "متاحة كامل الأسبوع" },
    certified: true,
    initials: "NT",
    interventionDomains: ["Déficience visuelle", "Déficience auditive", "Intégration sensorielle", "Maternelle / CP"],
    pedagogicalMethods: ["Supports tactiles", "Langage gestuel simplifié", "Structuration visuelle"],
    hourlyRateTnd: 26,
    experienceYears: 5,
    rating: 49,
    reviewCount: 22,
    schoolsCovered: {
      en: "Kindergartens and primary schools in Mégrine, Radès, Hammam-Lif",
      fr: "Jardins d'enfants et écoles de Mégrine, Radès, Ezzahra et Hammam-Lif",
      ar: "رياض الأطفال والمدارس بمقرين، رادس، الزهراء وحمام الأنف"
    },
    phone: "+216 55 789 012",
    email: "nourhene.t@avs-tunisie.tn",
    bio: {
      en: "Early childhood inclusion specialist supporting young learners with sensory processing differences and sensory impairments.",
      fr: "Formée à l'accueil des jeunes enfants avec déficiences sensorielles ou hypersensibilités. Adaptation des supports visuels agrandis, repérage dans l'espace et transition douce vers l'école primaire.",
      ar: "مختصة في الإدماج المبكر للأطفال ذوي الإعاقات الحسية أو الحساسية المفرطة، مع تكييف الوسائط البصرية وتهيئة الانتقال السلس للمدرسة الابتدائية."
    }
  },
  {
    id: 6,
    name: "Yassine Mansour",
    slug: "yassine-mansour",
    city: { en: "Nabeul", fr: "Nabeul (Nabeul & Hammamet)", ar: "نابل (نابل والحمامات)" },
    governorate: { en: "Nabeul", fr: "Nabeul", ar: "نابل" },
    specialty: { en: "Behavioral guidance & Social inclusion", fr: "Régulation comportementale & Socialisation", ar: "تنظيم السلوك والاندماج الاجتماعي" },
    availability: { en: "Available flexible hours", fr: "Horaires flexibles (Scolaire & Domicile)", ar: "أوقات مرنة (مدرسي ومنزلي)" },
    certified: false,
    initials: "YM",
    interventionDomains: ["Gestion des crises", "Habiletés sociales", "Renforcement motivationnel", "Liaison école-famille"],
    pedagogicalMethods: ["Contrats comportementaux", "Scénarios sociaux", "Renforcement différentiel"],
    hourlyRateTnd: 20,
    experienceYears: 3,
    rating: 46,
    reviewCount: 11,
    schoolsCovered: {
      en: "Schools in Nabeul, Dar Chaâbane, Hammamet",
      fr: "Écoles de Nabeul, Dar Chaâbane El Fehri et Hammamet",
      ar: "مدارس نابل ودار شعبان الفهري والحمامات"
    },
    phone: "+216 21 890 123",
    email: "yassine.mansour@avs-tunisie.tn",
    bio: {
      en: "Support worker specialized in socialization and self-regulation protocols, helping students overcome anxiety and behavioral challenges.",
      fr: "Accompagnement axé sur la gestion du stress en milieu scolaire, le développement des compétences relationnelles et la prévention du décrochage chez les élèves en difficulté d'adaptation.",
      ar: "مرافقة تربوية تركز على التعامل مع التوتر والقلق داخل الفضاء المدرسي، وتنمية المهارات الاجتماعية وبناء الثقة في النفس للتلميذ."
    }
  }
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
    title: { en: "Enrollment opens for the 2026 intake", fr: "Ouverture des inscriptions — Rentrée 2026", ar: "فتح التسجيل لدورة 2026" },
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
