export type Persona = "STUDENT" | "AVS" | "PARENT" | "TEACHER" | "SPECIALIST" | "ORGANIZATION";
export type StepId = "persona" | "identity" | "contact" | "specific" | "review";

export type FormState = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  governorate: string;
  city: string;
  preferredLocale: "fr" | "ar";
  requestedPersona: Persona | "";
  // STUDENT only
  educationLevel: string;
  institutionName: string;
  // TEACHER
  discipline: string;
  levelsTaught: string;
  professionalInstitution: string;
  // TEACHER / AVS / SPECIALIST
  qualification: string;
  experienceYears: string;
  // AVS / SPECIALIST
  interventionDomains: string;
  // SPECIALIST
  specialty: string;
  practiceStructure: string;
  // ORGANIZATION
  organizationName: string;
  organizationType: string;
  representativeRole: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
};

export const PERSONA_OPTIONS: { value: Persona; fr: string; ar: string; descFr: string; descAr: string }[] = [
  { value: "STUDENT", fr: "Étudiant", ar: "طالب", descFr: "Cours, évaluations, certificats", descAr: "دورات وتقييمات وشهادات" },
  { value: "PARENT", fr: "Parent", ar: "ولي أمر", descFr: "Suivre le parcours de mon enfant", descAr: "متابعة مسار طفلي" },
  { value: "TEACHER", fr: "Enseignant", ar: "مدرّس", descFr: "Créer et animer des formations", descAr: "إنشاء دورات تكوينية وتقديمها" },
  { value: "AVS", fr: "AVS", ar: "مرافق حياة مدرسية", descFr: "Accompagnement scolaire spécialisé", descAr: "مرافقة مدرسية متخصصة" },
  { value: "SPECIALIST", fr: "Spécialiste", ar: "أخصائي", descFr: "Expertise et accompagnement professionnel", descAr: "خبرة ومرافقة مهنية" },
  { value: "ORGANIZATION", fr: "Organisation", ar: "مؤسسة", descFr: "École, association ou institution", descAr: "مدرسة أو جمعية أو مؤسسة" },
];

export const STEP_META: Record<StepId, { eyebrowFr: string; eyebrowAr: string; titleFr: string; titleAr: string; descFr: string; descAr: string }> = {
  persona: {
    eyebrowFr: "Votre profil", eyebrowAr: "ملفك الشخصي",
    titleFr: "Quel est votre profil ?", titleAr: "ما هي صفتك؟",
    descFr: "Ce choix détermine les informations demandées ensuite et l'espace ANEI qui vous sera ouvert.",
    descAr: "يحدد هذا الاختيار المعلومات المطلوبة لاحقًا والمساحة التي سيتم فتحها لك في المنصة.",
  },
  identity: {
    eyebrowFr: "Identité", eyebrowAr: "الهوية",
    titleFr: "Faisons connaissance", titleAr: "بيانات التعريف",
    descFr: "Ces informations restent privées et servent uniquement à votre dossier ANEI.",
    descAr: "تبقى هذه المعلومات خاصة وتُستخدم فقط لملفك في المنصة.",
  },
  contact: {
    eyebrowFr: "Coordonnées", eyebrowAr: "معلومات الاتصال",
    titleFr: "Comment vous joindre ?", titleAr: "كيف يمكننا التواصل معك؟",
    descFr: "Utilisées pour les notifications importantes et la localisation de votre espace.",
    descAr: "تُستخدم للإشعارات المهمة ولتحديد مكان مساحتك.",
  },
  specific: {
    eyebrowFr: "Informations spécifiques", eyebrowAr: "معلومات خاصة",
    titleFr: "Précisons votre profil", titleAr: "تفاصيل إضافية حول ملفك",
    descFr: "Ces informations aident l'équipe ANEI à activer le bon espace pour vous.",
    descAr: "تساعد هذه المعلومات فريق الأكاديمية على تفعيل المساحة المناسبة لك.",
  },
  review: {
    eyebrowFr: "Vérification", eyebrowAr: "المراجعة",
    titleFr: "Vérifiez et confirmez", titleAr: "راجع وأكّد معلوماتك",
    descFr: "Relisez vos informations avant l'enregistrement définitif.",
    descAr: "راجع معلوماتك قبل التسجيل النهائي.",
  },
};

export const ERROR_MESSAGES: Record<string, { fr: string; ar: string }> = {
  institution_required: { fr: "Merci d'indiquer votre établissement / organisme.", ar: "يرجى إدخال المؤسسة أو الهيئة." },
  education_level_required: { fr: "Merci d'indiquer votre niveau d'étude.", ar: "يرجى إدخال المستوى الدراسي." },
  invalid_phone: { fr: "Numéro de téléphone invalide (8 chiffres).", ar: "رقم هاتف غير صالح (8 أرقام)." },
  invalid_governorate: { fr: "Gouvernorat invalide.", ar: "الولاية غير صالحة." },
  invalid_delegation: { fr: "Cette délégation n'appartient pas à ce gouvernorat.", ar: "هذه المعتمدية لا تنتمي إلى هذه الولاية." },
};

export const FIELD_STEP: Record<string, StepId> = {
  requestedPersona: "persona",
  firstName: "identity",
  lastName: "identity",
  phoneNumber: "contact",
  country: "contact",
  governorate: "contact",
  city: "contact",
  educationLevel: "specific",
  institutionName: "specific",
  discipline: "specific",
  levelsTaught: "specific",
  professionalInstitution: "specific",
  qualification: "specific",
  experienceYears: "specific",
  interventionDomains: "specific",
  specialty: "specific",
  practiceStructure: "specific",
  organizationName: "specific",
  organizationType: "specific",
  representativeRole: "specific",
  termsAccepted: "review",
  privacyAccepted: "review",
};
