"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";
import { getDelegationsForGovernorate } from "@/lib/tunisia/locations";
import {
  GraduationCap,
  Stethoscope,
  HeartHandshake,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,

  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Sparkles,
  Building2,
  ChevronDown,
  Mail,
} from "lucide-react";

export const TUNISIA_GOVERNORATES_BILINGUAL = [
  { fr: "Ariana", ar: "أريانة" },
  { fr: "Béja", ar: "باجة" },
  { fr: "Ben Arous", ar: "بن عروس" },
  { fr: "Bizerte", ar: "بنزرت" },
  { fr: "Gabès", ar: "قابس" },
  { fr: "Gafsa", ar: "قفصة" },
  { fr: "Jendouba", ar: "جندوبة" },
  { fr: "Kairouan", ar: "القيروان" },
  { fr: "Kasserine", ar: "القصرين" },
  { fr: "Kébili", ar: "قبلي" },
  { fr: "Le Kef", ar: "الكاف" },
  { fr: "Mahdia", ar: "المهدية" },
  { fr: "La Manouba", ar: "منوبة" },
  { fr: "Médenine", ar: "مدنين" },
  { fr: "Monastir", ar: "المنستير" },
  { fr: "Nabeul", ar: "نابل" },
  { fr: "Sfax", ar: "صفاقس" },
  { fr: "Sidi Bouzid", ar: "سيدي بوزيد" },
  { fr: "Siliana", ar: "سليانة" },
  { fr: "Sousse", ar: "سوسة" },
  { fr: "Tataouine", ar: "تطاوين" },
  { fr: "Tozeur", ar: "توزر" },
  { fr: "Tunis", ar: "تونس" },
  { fr: "Zaghouan", ar: "زغوان" },
];

export type CategoryChoice = "LEARNER" | "STUDENT" | "PARENT" | "TEACHER" | "AVS" | "SPECIALIST" | "ORGANIZATION";
export type ProfileTypeChoice = "STUDENT" | "PARENT" | "TEACHER" | "AVS" | "SPECIALIST" | "ORGANIZATION";

export interface ProfileTypeItem {
  id: ProfileTypeChoice;
  category: CategoryChoice;
  subRole: string;
  icon: typeof GraduationCap;
  image: string;
  titleFr: string;
  titleAr: string;
  descriptionFr: string;
  descriptionAr: string;
  badgesFr: string[];
  badgesAr: string[];
  badgeColorClass: string;
}

export const PROFILE_DEFINITIONS: ProfileTypeItem[] = [
  {
    id: "STUDENT",
    category: "STUDENT",
    subRole: "Étudiant / En reconversion",
    icon: GraduationCap,
    image: "/media/persona-student.webp",
    titleFr: "Apprenant / Étudiant",
    titleAr: "طالب / متعلم",
    descriptionFr: "Suivre des formations certifiantes, développer ses compétences en éducation inclusive et obtenir des diplômes et attestations officielles ANEI.",
    descriptionAr: "متابعة الدورات التدريبية المعتمدة، اكتساب مهارات التربية الدامجة ونيل الشهادات التخصصية الرسمية.",
    badgesFr: ["Espace Apprenant", "Formations certifiantes", "Diplômes ANEI"],
    badgesAr: ["فضاء المتعلم", "دورات معتمدة", "شهادات رسمية"],
    badgeColorClass: "bg-slate-100 text-slate-700",
  },
  {
    id: "PARENT",
    category: "PARENT",
    subRole: "Parent d'un enfant à besoin spécifique",
    icon: HeartHandshake,
    image: "/media/persona-parent.webp",
    titleFr: "Parent d'élève",
    titleAr: "ولي أمر",
    descriptionFr: "Accompagner son enfant, réserver des séances avec des AVS ou Spécialistes certifiés et accéder à votre Espace Famille dédié.",
    descriptionAr: "مرافقة الطفل، حجز حصص مباشرة مع مرافقين مدرسيين وأخصائيين والوصول إلى فضاء العائلة المخصص.",
    badgesFr: ["Espace Famille", "Réservation AVS", "Suivi spécialistes"],
    badgesAr: ["فضاء العائلة", "حجز AVS", "أخصائيون معتمدون"],
    badgeColorClass: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  },
  {
    id: "TEACHER",
    category: "TEACHER",
    subRole: "Enseignant / Cadre éducatif",
    icon: BookOpen,
    image: "/media/persona-teacher.webp",
    titleFr: "Enseignant / Éducateur",
    titleAr: "مربي / إطار تربوي",
    descriptionFr: "Mettre en place des adaptations pédagogiques (PEI/GEVA-Sco), gérer une classe inclusive et collaborer avec les familles et spécialistes.",
    descriptionAr: "تطبيق التكييفات البيداغوجية، إدارة الأقسام الدامجة والتنسيق المتكامل مع الأسر والأخصائيين والمرافقين.",
    badgesFr: ["Espace Formateur", "Pédagogie inclusive", "Outils & PEI"],
    badgesAr: ["فضاء المربي", "تربية دامجة", "أدوات و PEI"],
    badgeColorClass: "bg-amber-50 text-amber-800 border border-amber-100",
  },
  {
    id: "AVS",
    category: "AVS",
    subRole: "Accompagnant de Vie Scolaire",
    icon: ShieldCheck,
    image: "/media/persona-avs.webp",
    titleFr: "Accompagnant de Vie Scolaire (AVS)",
    titleAr: "مرافق حياة مدرسية (AVS)",
    descriptionFr: "Accompagner les élèves en milieu scolaire ou à domicile, valoriser vos interventions et apparaître automatiquement dans l'annuaire certifié /avs.",
    descriptionAr: "مرافقة التلاميذ في المدارس أو المنازل، توثيق الخبرات والظهور التلقائي في الدليل الرسمي لمرافقي الحياة المدرسية.",
    badgesFr: ["Espace AVS", "Annuaire officiel /avs", "0% commission présentiel"],
    badgesAr: ["فضاء AVS", "دليل /avs الرسمي", "0% عمولة حضوري"],
    badgeColorClass: "bg-blue-50 text-blue-700 border border-blue-100",
  },
  {
    id: "SPECIALIST",
    category: "SPECIALIST",
    subRole: "Spécialiste & Clinicien",
    icon: Stethoscope,
    image: "/media/persona-specialist.webp",
    titleFr: "Spécialiste & Clinicien",
    titleAr: "أخصائي عيادي وصاحب عيادة",
    descriptionFr: "Orthophoniste, Psychologue, Psychomotricien, Ergothérapeute — référencer votre cabinet dans /specialistes et recevoir des rendez-vous.",
    descriptionAr: "أخصائي تخاطب، نفساني، حركي، وظيفي — نشر العيادة في دليل /specialistes وإدارة الحجوزات والاستشارات الحضورية وعن بعد.",
    badgesFr: ["Espace Spécialiste", "Annuaire /specialistes", "Cabinet & Téléconsultation"],
    badgesAr: ["فضاء الأخصائي", "دليل /specialistes", "عيادة واستشارات"],
    badgeColorClass: "bg-purple-50 text-purple-700 border border-purple-100",
  },
  {
    id: "ORGANIZATION",
    category: "ORGANIZATION",
    subRole: "Établissement & Organisation",
    icon: Building2,
    image: "/media/persona-institution.webp",
    titleFr: "Établissement & Organisation",
    titleAr: "مؤسسة تعليمية / منظمة",
    descriptionFr: "Écoles, centres médico-éducatifs, associations et universités — former vos équipes, certifier votre structure et piloter vos cohortes d'inclusion.",
    descriptionAr: "المدارس، المراكز التربوية والجمعيات — تدريب الفرق، اعتماد المؤسسات الدامجة وإدارة المجموعات والشراكات المؤسسية.",
    badgesFr: ["Espace Organisation", "Formation d'équipes", "Gestion des cohortes"],
    badgesAr: ["فضاء المؤسسة", "تدريب الفرق", "إدارة المجموعات"],
    badgeColorClass: "bg-indigo-50 text-indigo-700 border border-indigo-100",
  },
];

export function RegisterWizard({
  locale,
  googleConfigured = false,
}: {
  locale: Locale;
  googleConfigured?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const ar = locale === "ar";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const destination = `/${locale}/complete-profile`;
      const errorCallbackURL = `/${locale}/inscription?${new URLSearchParams({
        error: "google_auth_failed",
      })}`;

      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: destination,
        errorCallbackURL,
      });

      if (res?.error) {
        throw new Error(res.error.message || "GOOGLE_AUTH_ERROR");
      }
    } catch {
      setError(
        ar
          ? "تعذر التسجيل باستخدام حساب Google. يُرجى متابعة التسجيل أدناه."
          : "Échec de connexion avec Google. Veuillez poursuivre l'inscription ci-dessous.",
      );
      setGoogleLoading(false);
    }
  }

  // Step 1: Profile Type & Category
  const [profileType, setProfileType] = useState<ProfileTypeChoice>(() => {
    const roleParam = search.get("role")?.toLowerCase();
    if (roleParam === "avs") return "AVS";
    if (roleParam === "specialist" || roleParam === "cabinet") return "SPECIALIST";
    if (roleParam === "parent") return "PARENT";
    if (roleParam === "teacher" || roleParam === "enseignant") return "TEACHER";
    if (roleParam === "institution" || roleParam === "organization") return "ORGANIZATION";
    return "STUDENT";
  });

  const category: CategoryChoice = profileType;

  const [subRole, setSubRole] = useState<string>(() => {
    const roleParam = search.get("role")?.toLowerCase();
    if (roleParam === "parent") return "Parent d'un enfant à besoin spécifique";
    if (roleParam === "teacher" || roleParam === "enseignant") return "Enseignant / Cadre éducatif";
    if (roleParam === "institution" || roleParam === "organization") return "Établissement & Organisation";
    return "Étudiant / En reconversion";
  });

  const handleSelectProfileType = (pt: ProfileTypeChoice) => {
    setProfileType(pt);
    if (pt === "STUDENT") {
      setSubRole("Étudiant / En reconversion");
    } else if (pt === "PARENT") {
      setSubRole("Parent d'un enfant à besoin spécifique");
    } else if (pt === "TEACHER") {
      setSubRole("Enseignant / Cadre éducatif");
    } else if (pt === "ORGANIZATION") {
      setSubRole("Établissement & Organisation");
    }
  };

  // Step 2: Coordinates
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [governorate, setGovernorate] = useState("Tunis");
  const [city, setCity] = useState("Tunis");
  const [acquisitionSource, setAcquisitionSource] = useState("FACEBOOK_INSTAGRAM");
  const [ageGroup, setAgeGroup] = useState("26-35");

  // Step 3: Learner / Student
  const [educationLevel, setEducationLevel] = useState("Licence");
  const [institutionName, setInstitutionName] = useState("");
  const [interests, setInterests] = useState<string[]>(["Autisme (TSA)", "Troubles DYS"]);

  // Step 3: Parent
  const [childNeeds, setChildNeeds] = useState<string[]>(["Autisme (TSA)", "Troubles DYS"]);
  const [childCycle, setChildCycle] = useState("Primaire");
  const [childSchool, setChildSchool] = useState("");
  const [familyPriorities, setFamilyPriorities] = useState<string[]>([
    "Trouver un(e) AVS certifié(e)",
    "Suivi avec des spécialistes",
  ]);

  // Step 3: Teacher
  const [teachingCycle, setTeachingCycle] = useState("Primaire");
  const [discipline, setDiscipline] = useState("");
  const [teacherSchool, setTeacherSchool] = useState("");
  const [teacherExperienceYears, setTeacherExperienceYears] = useState(5);
  const [teacherObjectives, setTeacherObjectives] = useState<string[]>([
    "Élaboration de PEI & GEVA-Sco",
    "Différenciation des apprentissages",
  ]);

  // Step 3: AVS
  const [accompanimentType, setAccompanimentType] = useState("Maternelle & Primaire");
  const [schoolsCovered, setSchoolsCovered] = useState("");
  const [experienceYears, setExperienceYears] = useState(3);
  const avsQualification = "Certificat ANEI Accompagnant Scolaire";
  const avsDomains = ["Autisme (TSA)", "Troubles DYS"];
  const pedagogicalMethods = ["Montessori adapté", "Programme Makaton"];
  const [availability, setAvailability] = useState("Temps plein");
  const [hourlyRateTnd, setHourlyRateTnd] = useState(25);
  const [onlineRateTnd, setOnlineRateTnd] = useState(35);
  const [avsBio, setAvsBio] = useState("");

  // Step 3: Specialist
  const [specialty, setSpecialty] = useState("Orthophoniste");
  const [workplaceName, setWorkplaceName] = useState("");
  const [workplaceAddress, setWorkplaceAddress] = useState("");
  const [licenseOrOrderNumber, setLicenseOrOrderNumber] = useState("");
  const specExperienceYears = 4;
  const specDomains = ["Autisme (TSA)", "Troubles DYS", "Retard de langage"];
  const [inPersonRateTnd, setInPersonRateTnd] = useState(40);
  const [specOnlineRateTnd, setSpecOnlineRateTnd] = useState(35);
  const [specBio, setSpecBio] = useState("");

  // Step 3: Organization
  const [organizationType, setOrganizationType] = useState("École privée");
  const [organizationName, setOrganizationName] = useState("");
  const [representativeRole, setRepresentativeRole] = useState("Directeur / Chef d'établissement");
  const [organizationSize, setOrganizationSize] = useState("50 à 200 personnes");
  const [organizationNeeds, setOrganizationNeeds] = useState<string[]>([
    "Formation certifiante des équipes",
    "Convention de partenariat ANEI",
  ]);

  // Step 4: Security
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(true);

  // Available delegations for chosen governorate
  const availableDelegations = useMemo(() => {
    const list = getDelegationsForGovernorate(governorate);
    return list.length ? list : [{ code: "DEFAULT", nameFr: governorate }];
  }, [governorate]);

  // Update city if current delegation isn't valid for new governorate
  const handleGovernorateChange = (newGov: string) => {
    setGovernorate(newGov);
    const delList = getDelegationsForGovernorate(newGov);
    if (delList.length) {
      setCity(delList[0].nameFr);
    } else {
      setCity(newGov);
    }
  };

  // Password Strength Calculation (4 segments)
  const passwordCriteria = useMemo(() => {
    return {
      length: password.length >= 15,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumberOrSymbol: /[\d\W]/.test(password),
    };
  }, [password]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 10) score++;
    if (passwordCriteria.length) score++;
    if (passwordCriteria.hasUpper && passwordCriteria.hasLower) score++;
    if (passwordCriteria.hasNumberOrSymbol) score++;
    return score;
  }, [password, passwordCriteria]);

  // Step validation
  const canProceedStep2 = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      phoneDigits.trim().length === 8 &&
      governorate.length > 0 &&
      city.length > 0
    );
  }, [firstName, lastName, email, phoneDigits, governorate, city]);

  const canProceedStep4 = useMemo(() => {
    return (
      passwordCriteria.length &&
      password === confirmPassword &&
      termsAccepted
    );
  }, [passwordCriteria.length, password, confirmPassword, termsAccepted]);

  // Step titles & subtitles
  const stepMeta = useMemo(() => {
    switch (step) {
      case 1:
        return {
          title: ar ? "ما هي صفتكم داخل الأكاديمية؟" : "Quel est votre profil au sein de l'Académie ANEI ?",
          subtitle: ar
            ? "حدّدوا صفتكم الرئيسية للوصول إلى بيئة التعلم أو بطاقتكم المهنية المعتمدة."
            : "Sélectionnez votre profil principal. Il détermine votre espace de travail et vos fonctionnalités.",
        };
      case 2:
        return {
          title: ar ? "ما هي بياناتكم الرسمية؟" : "Quelles sont vos coordonnées officielles ?",
          subtitle: ar
            ? "تُستخدم هذه المعلومات لتخصيص حسابكم، إصدار شهاداتكم والتواصل معكم."
            : "Ces informations permettent de personnaliser votre compte, d'émettre vos certificats et de vous joindre.",
        };
      case 3:
        if (profileType === "STUDENT") {
          return {
            title: ar ? "الملف التعليمي والمجالات ذات الأولوية" : "Profil d'apprentissage & centres d'intérêt",
            subtitle: ar
              ? "حدّدوا مساركم واهتماماتكم لتخصيص بيئة التعلم واقتراح الدورات الأنسب لكم."
              : "Précisez votre parcours et vos thématiques prioritaires pour personnaliser votre espace d'apprentissage.",
          };
        } else if (profileType === "PARENT") {
          return {
            title: ar ? "ملف الطفل واحتياجات المرافقة الأسرية" : "Profil de l'enfant & besoins d'accompagnement",
            subtitle: ar
              ? "تساعدنا هذه المعلومات على توجيهكم نحو أفضل مرافقي الحياة المدرسية والأخصائيين المعتمدين."
              : "Ces informations permettent de vous orienter vers les meilleurs AVS et praticiens spécialisés pour votre enfant.",
          };
        } else if (profileType === "TEACHER") {
          return {
            title: ar ? "الإطار التربوي والصف الدامج" : "Cadre pédagogique & classe inclusive",
            subtitle: ar
              ? "حدّدوا مستواكم واحتياجاتكم البيداغوجية للوصول إلى أدوات تكييف المناهج وتصميم PEI."
              : "Renseignez vos cycles et outils prioritaires pour accéder aux ressources d'adaptation pédagogique et PEI.",
          };
        } else if (profileType === "AVS") {
          return {
            title: ar ? "إعداد بطاقتكم العامة لمرافق الحياة المدرسية" : "Configurez votre fiche publique d'AVS",
            subtitle: ar
              ? "ستُعرض هذه التفاصيل على بطاقتكم في الدليل الرسمي لمرافقي الحياة المدرسية /avs."
              : "Ces détails seront affichés sur votre profil dans l'annuaire officiel des AVS.",
          };
        } else if (profileType === "SPECIALIST") {
          return {
            title: ar ? "إعداد بطاقتكم العيادية في دليل الأخصائيين" : "Configurez votre fiche de Spécialiste & Cabinet",
            subtitle: ar
              ? "سيتم إدراج عيادتكم تلقائيًا في دليل /specialistes مع وسائل الاتصال وجدول المواعيد."
              : "Votre profil sera automatiquement référencé dans l'annuaire /specialistes avec vos coordonnées et créneaux.",
          };
        } else {
          return {
            title: ar ? "بيانات المؤسسة واحتياجات التكوين" : "Profil de l'établissement & besoins institutionnels",
            subtitle: ar
              ? "خصّصوا احتياجات فرقكم التعليمية والتربوية للاستفادة من برامج الشراكة والاعتماد المؤسسي."
              : "Définissez les besoins de vos équipes pour bénéficier de nos conventions partenariales et programmes de certification.",
          };
        }
      case 4:
        return {
          title: ar ? "تأكيد وتأمين حسابكم" : "Finalisez et sécurisez votre compte",
          subtitle: ar
            ? "اختر كلمة مرور قوية لتأمين حسابك ومراجعة ملخص تسجيلك قبل التأكيد."
            : "Choisissez un mot de passe robuste pour protéger vos données et vérifiez votre profil.",
        };
    }
  }, [step, profileType, ar]);

  // Submit Handler
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (step < 4) {
      setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
      return;
    }

    if (!canProceedStep4) {
      setError(
        ar
          ? "يرجى التحقق من كلمة المرور (15 حرفًا على الأقل) والموافقة على الشروط."
          : "Veuillez vérifier votre mot de passe (15 caractères minimum requis) et accepter les conditions.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    const payload = {
      category: profileType,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: `+216${phoneDigits.trim()}`,
      governorate,
      city,
      acquisitionSource,
      ageGroup,
      locale,
      password,
      referredByCode: search.get("ref")?.trim() || undefined,
      // Category specifics
      ...(profileType === "STUDENT"
        ? {
            subRole,
            educationLevel,
            institutionName: institutionName.trim() || undefined,
            interests,
          }
        : profileType === "PARENT"
        ? {
            childNeeds,
            childCycle,
            childSchool: childSchool.trim() || undefined,
            familyPriorities,
          }
        : profileType === "TEACHER"
        ? {
            teachingCycle,
            discipline: discipline.trim() || undefined,
            institutionName: teacherSchool.trim() || undefined,
            experienceYears: Number(teacherExperienceYears) || 3,
            teacherObjectives,
          }
        : profileType === "AVS"
        ? {
            accompanimentType,
            schoolsCovered: schoolsCovered.trim() || undefined,
            experienceYears: Number(experienceYears) || 3,
            qualification: avsQualification.trim(),
            interventionDomains: avsDomains,
            pedagogicalMethods,
            availability,
            hourlyRateMillimes: Math.round(hourlyRateTnd * 1000),
            onlineVisioPriceMillimes: Math.round(onlineRateTnd * 1000),
            bio: avsBio.trim() || undefined,
          }
        : profileType === "SPECIALIST"
        ? {
            specialty,
            workplaceName: workplaceName.trim() || undefined,
            workplaceAddress: workplaceAddress.trim() || undefined,
            licenseOrOrderNumber: licenseOrOrderNumber.trim() || undefined,
            experienceYears: Number(specExperienceYears) || 3,
            interventionDomains: specDomains,
            inPersonPriceMillimes: Math.round(inPersonRateTnd * 1000),
            onlineVisioPriceMillimes: Math.round(specOnlineRateTnd * 1000),
            bio: specBio.trim() || undefined,
          }
        : {
            organizationName: organizationName.trim() || undefined,
            organizationType,
            representativeRole: representativeRole.trim() || undefined,
            organizationSize,
            organizationNeeds,
          }),
    };

    try {
      const res = await fetch("/api/auth/register-wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.message ||
            data.error ||
            (ar ? "حدث خطأ أثناء إنشاء الحساب." : "Une erreur est survenue lors de l'inscription."),
        );
      }

      // Successful registration
      const target = data.redirectUrl || `/${locale}/dashboard`;
      router.push(target);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : ar
          ? "تعذر إتمام التسجيل."
          : "Impossible de finaliser l'inscription.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <AuthWizardProgress
        currentStep={step}
        totalSteps={4}
        stepTitle={stepMeta.title}
        stepSubtitle={stepMeta.subtitle}
        locale={locale}
      />

      {error ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        {/* ========================================================= */}
        {/* STEP 1: CATEGORY SELECTION CARDS                          */}
        {/* ========================================================= */}
        {step === 1 && (
          <>
            {googleConfigured && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading || googleLoading}
                  className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all shadow-2xs hover:border-slate-300 disabled:opacity-50 cursor-pointer"
                >
                  <GoogleMark size={18} />
                  <span>
                    {googleLoading
                      ? ar
                        ? "جارٍ الاتصال..."
                        : "Connexion en cours..."
                      : ar
                        ? "التسجيل السريع باستخدام Google"
                        : "Inscription rapide avec Google"}
                  </span>
                </button>
                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200" />
                  </div>
                  <span className="relative bg-white px-3 text-xs text-slate-400 uppercase font-medium">
                    {ar ? "أو اختيار صفتك والتسجيل المخصص" : "ou choisir votre profil pour vous inscrire"}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-3.5 mb-8" role="radiogroup" aria-label={ar ? "اختر صفتك" : "Choisissez votre profil"}>
              {PROFILE_DEFINITIONS.map((p) => {
                const IconCmp = p.icon;
                const isSelected = profileType === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProfileType(p.id)}
                    className={`group cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                      isSelected
                        ? "border-[#0A192F] bg-slate-50/80 shadow-xs ring-1 ring-[#0A192F]/10"
                        : "border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/30"
                    }`}
                  >
                    <div className="relative w-full sm:w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                      <Image
                        src={p.image}
                        alt={ar ? p.titleAr : p.titleFr}
                        fill
                        className="object-cover"
                      />
                      <span className="absolute top-2 start-2 w-8 h-8 rounded-lg bg-[#0A192F]/85 text-white flex items-center justify-center backdrop-blur-xs">
                        <IconCmp className="w-4 h-4 text-white" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-base font-bold text-[#0A192F]">
                          {ar ? p.titleAr : p.titleFr}
                        </h3>
                        <span
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? "border-[#0A192F] bg-[#0A192F] text-white"
                              : "border-slate-300"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-2.5">
                        {ar ? p.descriptionAr : p.descriptionFr}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {(ar ? p.badgesAr : p.badgesFr).map((badge, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              idx === 0 ? p.badgeColorClass : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </>
      )}

        {/* ========================================================= */}
        {/* STEP 2: COORDINATES & GEOGRAPHIC LOCATION                 */}
        {/* ========================================================= */}
        {step === 2 && (
          <div className="space-y-5 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "الاسم الأول" : "Prénom"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={ar ? "محمد" : "Ex. Sarah"}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "اللقب" : "Nom"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={ar ? "الطرابلسي" : "Ex. Ben Salem"}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "البريد الإلكتروني" : "Adresse e-mail"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full h-12 auth-input-with-icon !ps-11 pe-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors text-left dir-ltr"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {ar ? "رقم الهاتف الرسمي (تونس)" : "Numéro de téléphone (+216)"} <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {phoneDigits.length === 8 ? (
                    <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{ar ? "8 أرقام (مكتمل)" : "8 chiffres (Valide)"}</span>
                    </span>
                  ) : (
                    <span>{phoneDigits.length}/8 {ar ? "أرقام" : "chiffres"}</span>
                  )}
                </span>
              </div>
              <div className="flex rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:border-[#0A192F] focus-within:ring-1 focus-within:ring-[#0A192F] transition-colors shadow-2xs">
                <div
                  className="inline-flex items-center gap-1.5 px-3.5 bg-slate-50 border-e border-slate-200 text-xs font-semibold text-slate-700 select-none shrink-0"
                  dir="ltr"
                >
                  <span className="text-base leading-none" aria-hidden="true">🇹🇳</span>
                  <span className="font-mono font-bold text-slate-800">+216</span>
                </div>
                <div className="relative flex-1 min-w-0">
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    required
                    value={phoneDigits}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setPhoneDigits(digits);
                    }}
                    onKeyDown={(e) => {
                      if (
                        ["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete", "Enter"].includes(e.key) ||
                        e.ctrlKey ||
                        e.metaKey
                      ) {
                        return;
                      }
                      if (!/^\d$/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    placeholder="98 123 456"
                    className="w-full h-12 px-3.5 text-sm font-medium tracking-wide text-slate-800 placeholder:text-slate-400 bg-transparent outline-none dir-ltr text-left"
                    dir="ltr"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {ar
                  ? "أدخل 8 أرقام فقط (مثال: 98123456 أو 20123456). الرمز الدولي +216 محدد مسبقاً."
                  : "Saisissez uniquement les 8 chiffres du numéro (ex. 98 123 456). L'indicatif +216 est pré-configuré."}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "الولاية (تونس)" : "Gouvernorat"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <select
                    value={governorate}
                    onChange={(e) => handleGovernorateChange(e.target.value)}
                    className="w-full h-12 auth-input-with-icon !ps-11 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    {TUNISIA_GOVERNORATES_BILINGUAL.map((g) => (
                      <option key={g.fr} value={g.fr}>
                        {ar ? `${g.ar} (${g.fr})` : `${g.fr} — ${g.ar}`}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المدينة / المعتمدية" : "Ville / Délégation"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </span>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-12 auth-input-with-icon !ps-11 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    {availableDelegations.map((d) => (
                      <option key={d.code} value={d.nameFr}>
                        {d.nameFr}
                      </option>
                    ))}
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "كيف تعرفتم على ANEI؟" : "Canal d'acquisition"}
                </label>
                <div className="relative">
                  <select
                    value={acquisitionSource}
                    onChange={(e) => setAcquisitionSource(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="FACEBOOK_INSTAGRAM">
                      {ar ? "إعلانات فيسبوك / إنستغرام" : "Publicité Facebook / Instagram"}
                    </option>
                    <option value="WHATSAPP">{ar ? "واتساب" : "WhatsApp"}</option>
                    <option value="RECOMMENDATION">
                      {ar ? "توصية طبية أو مدرسية" : "Recommandation médicale ou scolaire"}
                    </option>
                    <option value="GOOGLE">{ar ? "بحث جوجل" : "Recherche Google"}</option>
                    <option value="WEBINAR">{ar ? "ندوة أو فعالية ANEI" : "Événement / Webinaire"}</option>
                    <option value="WORD_OF_MOUTH">{ar ? "صديق أو زميل" : "Bouche-à-oreille"}</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "الفئة العمرية" : "Tranche d'âge"}
                </label>
                <div className="relative">
                  <select
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="18-25">18 - 25 ans</option>
                    <option value="26-35">26 - 35 ans</option>
                    <option value="36-50">36 - 50 ans</option>
                    <option value="+50">+50 ans</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: STUDENT DEDICATED QUESTIONNAIRE                   */}
        {/* ========================================================= */}
        {step === 3 && profileType === "STUDENT" && (
          <div className="space-y-5 mb-8">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "الصّفة الدقيقة لمساركم" : "Votre profil d'apprenant"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "Étudiant en sciences de l'éducation / rééducation",
                    label: ar ? "طالب في علوم التربية أو التأهيل" : "Étudiant sciences de l'éducation",
                    icon: GraduationCap,
                  },
                  {
                    id: "Candidat futur AVS",
                    label: ar ? "مترشح لمهنة مرافق مدرسي AVS" : "Candidat futur AVS",
                    icon: ShieldCheck,
                  },
                  {
                    id: "En reconversion professionnelle",
                    label: ar ? "في إطار إعادة توجيه مهني" : "En reconversion professionnelle",
                    icon: BookOpen,
                  },
                  {
                    id: "Apprenant libre / Autodidacte",
                    label: ar ? "متعلم حر / مهتم بالمجال" : "Apprenant libre / Autodidacte",
                    icon: Sparkles,
                  },
                ].map((item) => {
                  const IconCmp = item.icon;
                  const isSel = subRole === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSubRole(item.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                        isSel
                          ? "border-[#0A192F] bg-slate-50 text-[#0A192F] font-semibold"
                          : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                      }`}
                    >
                      <IconCmp className={`w-4 h-4 ${isSel ? "text-[#0056D2]" : "text-slate-400"}`} />
                      <span className="text-xs sm:text-sm">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المستوى الدراسي" : "Niveau d'études"}
                </label>
                <div className="relative">
                  <select
                    value={educationLevel}
                    onChange={(e) => setEducationLevel(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="Baccalauréat">Baccalauréat</option>
                    <option value="Licence">Licence</option>
                    <option value="Master">Master</option>
                    <option value="Doctorat">Doctorat</option>
                    <option value="Formation professionnelle">Formation professionnelle</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المؤسسة أو الجامعة (اختياري)" : "Établissement / Université"}
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder={ar ? "اسم الكلية أو المعهد" : "Ex. Faculté des Sciences Humaines..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "المجالات التدريبية ذات الأولوية" : "Thématiques prioritaires à explorer"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Autisme (TSA)",
                  "Troubles DYS",
                  "TDAH",
                  "Trisomie 21",
                  "Accompagnement AVS",
                  "Guidance parentale",
                ].map((tag) => {
                  const isChecked = interests.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setInterests((prev) =>
                          isChecked ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: PARENT DEDICATED QUESTIONNAIRE                    */}
        {/* ========================================================= */}
        {step === 3 && profileType === "PARENT" && (
          <div className="space-y-5 mb-8">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "حاجيات ومواصفات طفلكم" : "Profil & besoins spécifiques de votre enfant"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Autisme (TSA)",
                  "Troubles DYS (Dyslexie, Dyspraxie...)",
                  "TDAH (Attention / Hyperactivité)",
                  "Trisomie 21 & Retard global",
                  "Polyhandicap & Moteur",
                  "Difficultés scolaires & langage",
                ].map((tag) => {
                  const isChecked = childNeeds.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setChildNeeds((prev) =>
                          isChecked ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المرحلة الدراسية للطفل" : "Cycle scolaire de l'enfant"}
                </label>
                <div className="relative">
                  <select
                    value={childCycle}
                    onChange={(e) => setChildCycle(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="Maternelle">{ar ? "التعليم التحضيري / الروضة" : "Maternelle"}</option>
                    <option value="Primaire">{ar ? "التعليم الابتدائي" : "Primaire"}</option>
                    <option value="Collège">{ar ? "التعليم الإعدادي" : "Collège"}</option>
                    <option value="Lycée">{ar ? "التعليم الثانوي" : "Lycée"}</option>
                    <option value="Établissement spécialisé">{ar ? "مركز تربية مختصة" : "Établissement spécialisé"}</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المدرسة أو المؤسسة الحالية (اختياري)" : "Établissement scolaire actuel"}
                </label>
                <input
                  type="text"
                  value={childSchool}
                  onChange={(e) => setChildSchool(e.target.value)}
                  placeholder={ar ? "اسم المدرسة الابتدائية أو الإعدادية" : "Ex. École primaire Al Manar..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "أولويات الدعم التي تبحثون عنها" : "Vos besoins prioritaires pour la famille"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Trouver un(e) AVS certifié(e)",
                  "Suivi avec des spécialistes (Orthophonie...)",
                  "Aménagements d'examens & PEI",
                  "Guidance parentale & formations ANEI",
                ].map((tag) => {
                  const isChecked = familyPriorities.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setFamilyPriorities((prev) =>
                          isChecked ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: TEACHER DEDICATED QUESTIONNAIRE                   */}
        {/* ========================================================= */}
        {step === 3 && profileType === "TEACHER" && (
          <div className="space-y-5 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "الطور التعليمي" : "Cycle d'enseignement"}
                </label>
                <div className="relative">
                  <select
                    value={teachingCycle}
                    onChange={(e) => setTeachingCycle(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="Primaire">{ar ? "التعليم الابتدائي" : "Primaire"}</option>
                    <option value="Collège">{ar ? "التعليم الإعدادي" : "Collège"}</option>
                    <option value="Lycée">{ar ? "التعليم الثانوي" : "Lycée"}</option>
                    <option value="Supérieur">{ar ? "التعليم العالي" : "Enseignement supérieur"}</option>
                    <option value="Éducation spécialisée">{ar ? "التربية المختصة" : "Éducation spécialisée"}</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المادة أو الاختصاص الرئيسي" : "Discipline / Matière principale"}
                </label>
                <input
                  type="text"
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value)}
                  placeholder={ar ? "اللغة العربية، الفرنسية، الرياضيات..." : "Ex. Français, Mathématiques, Éveil..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المؤسسة التربوية" : "Établissement scolaire"}
                </label>
                <input
                  type="text"
                  value={teacherSchool}
                  onChange={(e) => setTeacherSchool(e.target.value)}
                  placeholder={ar ? "المدرسة الابتدائية النموذجية..." : "Ex. École primaire pilote, Collège..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سنوات الخبرة التعليمية" : "Années d'expérience"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="45"
                  value={teacherExperienceYears}
                  onChange={(e) => setTeacherExperienceYears(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "أولويات التطوير البيداغوجي الدامج" : "Outils pédagogiques prioritaires recherchés"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Élaboration de PEI & GEVA-Sco",
                  "Différenciation des apprentissages",
                  "Co-intervention avec l'AVS en classe",
                  "Aménagement des évaluations",
                  "Gestion des comportements défis",
                ].map((tag) => {
                  const isChecked = teacherObjectives.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setTeacherObjectives((prev) =>
                          isChecked ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: AVS SPECIFIC FIELDS */}
        {step === 3 && category === "AVS" && (
          <div className="space-y-5 mb-8">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "نوع المرافقة الرئيسية" : "Type d'accompagnement"}
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  "Maternelle & Primaire",
                  "Collège & Lycée",
                  "Éducateur Spécialisé",
                  "Domicile & Autonomie",
                ].map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setAccompanimentType(t)}
                    className={`p-3 rounded-xl text-xs font-bold border transition-all text-start ${
                      accompanimentType === t
                        ? "bg-[#0A192F] text-white border-[#0A192F]"
                        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "المدارس المغطاة ونطاق التدخل" : "Établissements scolaires couverts"}
              </label>
              <input
                type="text"
                value={schoolsCovered}
                onChange={(e) => setSchoolsCovered(e.target.value)}
                placeholder={ar ? "مثال: المدارس الابتدائية بسوسة، سهلول، حمام سوسة" : "Ex. Écoles de Sousse, Sahloul, Hammam Sousse"}
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سنوات الخبرة" : "Années d'expérience"}
                </label>
                <input
                  type="number"
                  min="0"
                  max="40"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "أوقات التوفر" : "Disponibilité"}
                </label>
                <select
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                >
                  <option value="Temps plein">{ar ? "دوام كامل (كامل الأسبوع)" : "Temps plein"}</option>
                  <option value="Mi-temps Matin">{ar ? "نصف دوام صباحي" : "Mi-temps Matin"}</option>
                  <option value="Mi-temps Après-midi">{ar ? "نصف دوام مسائي" : "Mi-temps Après-midi"}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سعر الحصة المباشرة (دينار - 0% عمولة)" : "Tarif séance sur place (TND - 0% com.)"}
                </label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={hourlyRateTnd}
                  onChange={(e) => setHourlyRateTnd(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سعر جلسة التوجيه عن بعد (دينار)" : "Tarif séance en ligne (TND)"}
                </label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={onlineRateTnd}
                  onChange={(e) => setOnlineRateTnd(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "النبذة التعريفية والمنهجية" : "Présentation & démarche"}
              </label>
              <textarea
                rows={3}
                value={avsBio}
                onChange={(e) => setAvsBio(e.target.value)}
                placeholder={ar ? "اكتب نبذة مختصرة عن أسلوبك في مرافقة الأطفال..." : "Présentez brièvement vos méthodes et votre parcours..."}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
              />
            </div>
          </div>
        )}

        {/* STEP 3: SPECIALIST SPECIFIC FIELDS */}
        {step === 3 && category === "SPECIALIST" && (
          <div className="space-y-5 mb-8">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "التخصص العيادي" : "Spécialité clinique"} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: "Orthophoniste", label: "Orthophoniste", desc: "Langage, communication, DYS" },
                  { id: "Psychologue Clinicien", label: "Psychologue Clinicien", desc: "Bilans, TSA, TDAH, suivi" },
                  { id: "Psychomotricien", label: "Psychomotricien", desc: "Sensori-moteur, schéma corporel" },
                  { id: "Ergothérapeute", label: "Ergothérapeute", desc: "Autonomie quotidienne & scolaire" },
                  { id: "Pédopsychiatre", label: "Pédopsychiatre", desc: "Diagnostic & prise en charge" },
                  { id: "Éducateur Spécialisé", label: "Éducateur Spécialisé", desc: "Programmes ABA / TEACCH" },
                ].map((s) => {
                  const isSel = specialty === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSpecialty(s.id)}
                      className={`cursor-pointer p-3.5 rounded-xl border-2 transition-all ${
                        isSel
                          ? "border-[#0A192F] bg-slate-50 shadow-xs"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      }`}
                    >
                      <h4 className="text-xs sm:text-sm font-bold text-[#0A192F]">{s.label}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "اسم العيادة أو المركز" : "Nom du cabinet / centre"}
                </label>
                <input
                  type="text"
                  value={workplaceName}
                  onChange={(e) => setWorkplaceName(e.target.value)}
                  placeholder={ar ? "عيادة الأمل للأرثوفونيا" : "Ex. Cabinet d'Orthophonie El Manar"}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "رقم التسجيل بالعمادة / الترخيص" : "N° d'inscription / Agrément"}
                </label>
                <input
                  type="text"
                  value={licenseOrOrderNumber}
                  onChange={(e) => setLicenseOrOrderNumber(e.target.value)}
                  placeholder="Ex. 1428/2021"
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "عنوان العيادة التفصيلي" : "Adresse complète du cabinet"}
              </label>
              <input
                type="text"
                value={workplaceAddress}
                onChange={(e) => setWorkplaceAddress(e.target.value)}
                placeholder={ar ? "الشارع، العمارة، الطابق..." : "Ex. Av. Habib Bourguiba, Immeuble Al Amal, 2ème étage"}
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سعر الكشف بالعيادة (دينار - 0% عمولة)" : "Consultation cabinet (TND - 0% com.)"}
                </label>
                <input
                  type="number"
                  min="20"
                  max="300"
                  value={inPersonRateTnd}
                  onChange={(e) => setInPersonRateTnd(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "سعر الاستشارة عن بعد (دينار - Visio)" : "Téléconsultation Visio (TND)"}
                </label>
                <input
                  type="number"
                  min="20"
                  max="300"
                  value={specOnlineRateTnd}
                  onChange={(e) => setSpecOnlineRateTnd(Number(e.target.value))}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "التعريف العيادي والمجالات" : "Présentation clinique"}
              </label>
              <textarea
                rows={3}
                value={specBio}
                onChange={(e) => setSpecBio(e.target.value)}
                placeholder={ar ? "اكتب نبذة عن تخصصك وخبرتك العيادية..." : "Décrivez vos spécialisations et votre approche clinique..."}
                className="w-full p-3 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
              />
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: ORGANIZATION DEDICATED QUESTIONNAIRE              */}
        {/* ========================================================= */}
        {step === 3 && profileType === "ORGANIZATION" && (
          <div className="space-y-5 mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "نوع المؤسسة / الهيكل" : "Type d'organisation / structure"} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={organizationType}
                    onChange={(e) => setOrganizationType(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="École privée">{ar ? "مدرسة أو معهد خاص" : "École ou lycée privé"}</option>
                    <option value="École publique">{ar ? "مؤسسة تربوية عمومية" : "Établissement scolaire public"}</option>
                    <option value="Centre médico-éducatif">{ar ? "مركز طبي تربوي أو تأهيلي" : "Centre médico-éducatif"}</option>
                    <option value="Association d'inclusion">{ar ? "جمعية أو منظمة مجتمعية" : "Association d'inclusion"}</option>
                    <option value="Université">{ar ? "جامعة أو معهد عالي" : "Université / Institut supérieur"}</option>
                    <option value="Entreprise inclusive">{ar ? "مؤسسة أو شركة مشغلة" : "Entreprise engagée RSE"}</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "اسم المؤسسة أو الهيكل" : "Nom officiel de l'établissement"} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder={ar ? "مثال: مدرسة قرطاج الدولية" : "Ex. Groupe Scolaire Carthage..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "صفتكم داخل المؤسسة" : "Fonction du représentant"}
                </label>
                <input
                  type="text"
                  value={representativeRole}
                  onChange={(e) => setRepresentativeRole(e.target.value)}
                  placeholder={ar ? "مدير، منسق بيداغوجي، مسؤول تكوين..." : "Ex. Directeur, Coordinateur pédagogique..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "حجم الفريق / المتعلمين المستهدفين" : "Effectif concerné"}
                </label>
                <div className="relative">
                  <select
                    value={organizationSize}
                    onChange={(e) => setOrganizationSize(e.target.value)}
                    className="w-full h-12 px-4 pe-9 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none cursor-pointer text-slate-800 font-medium"
                  >
                    <option value="Moins de 50">{ar ? "أقل من 50 شخصًا" : "Moins de 50 personnes"}</option>
                    <option value="50 à 200">{ar ? "من 50 إلى 200 شخص" : "50 à 200 personnes"}</option>
                    <option value="200 à 500">{ar ? "من 200 إلى 500 شخص" : "200 à 500 personnes"}</option>
                    <option value="Plus de 500">{ar ? "أكثر من 500 شخص" : "Plus de 500 personnes"}</option>
                  </select>
                  <span className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-slate-400">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "أولويات الشراكة المؤسسية" : "Objectifs prioritaires de votre convention"}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Formation certifiante des équipes",
                  "Convention de partenariat ANEI",
                  "Accréditation établissement inclusif",
                  "Recrutement d'AVS qualifiés",
                  "Audit d'accessibilité & inclusion",
                ].map((tag) => {
                  const isChecked = organizationNeeds.includes(tag);
                  return (
                    <button
                      type="button"
                      key={tag}
                      onClick={() => {
                        setOrganizationNeeds((prev) =>
                          isChecked ? prev.filter((t) => t !== tag) : [...prev, tag],
                        );
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isChecked
                          ? "bg-[#0A192F] text-white border-[#0A192F]"
                          : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: SECURITY & RECAPITULATIVE SUMMARY                 */}
        {/* ========================================================= */}
        {step === 4 && (
          <div className="space-y-6 mb-8">
            {/* Visual Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3.5 mb-3">
                <span className="w-10 h-10 rounded-xl bg-[#0A192F] text-white flex items-center justify-center font-bold">
                  {profileType === "SPECIALIST" ? (
                    <Stethoscope className="w-5 h-5" />
                  ) : profileType === "AVS" ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : profileType === "TEACHER" ? (
                    <BookOpen className="w-5 h-5" />
                  ) : profileType === "PARENT" ? (
                    <HeartHandshake className="w-5 h-5" />
                  ) : profileType === "ORGANIZATION" ? (
                    <Building2 className="w-5 h-5" />
                  ) : (
                    <GraduationCap className="w-5 h-5" />
                  )}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0A192F]">
                    {firstName} {lastName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {profileType === "SPECIALIST"
                      ? `${specialty} • ${workplaceName || governorate} (${city})`
                      : profileType === "AVS"
                      ? `AVS • ${governorate} (${city})`
                      : profileType === "TEACHER"
                      ? `${ar ? "أستاذ / مربي" : "Enseignant / Éducateur"} • ${governorate} (${city})`
                      : profileType === "PARENT"
                      ? `${ar ? "ولي أمر" : "Parent d'élève"} • ${governorate} (${city})`
                      : profileType === "ORGANIZATION"
                      ? `${organizationType} • ${organizationName || governorate} (${city})`
                      : `${ar ? "طالب / متعلم" : "Apprenant / Étudiant"} • ${governorate} (${city})`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-200/80 text-slate-600">
                <div>
                  <span className="text-slate-400 block">{ar ? "البريد" : "Email"} :</span>
                  <span className="font-semibold text-slate-800 truncate block">{email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{ar ? "الهاتف" : "Téléphone"} :</span>
                  <span className="font-semibold text-slate-800 block dir-ltr text-start font-mono">
                    +216 {phoneDigits.slice(0, 2)} {phoneDigits.slice(2, 5)} {phoneDigits.slice(5, 8)}
                  </span>
                </div>
              </div>
            </div>

            {/* Password input */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "كلمة المرور الرسمية" : "Mot de passe sécurisé"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••••••••"
                  className="w-full h-12 auth-input-with-icon auth-input-with-toggle !ps-11 !pe-11 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* 4-segment security meter */}
              <div className="mt-2">
                <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      passwordScore >= 1 ? "bg-amber-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      passwordScore >= 2 ? "bg-amber-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      passwordScore >= 3 ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                  <div
                    className={`h-1 rounded-full transition-colors ${
                      passwordScore >= 4 ? "bg-emerald-600" : "bg-slate-200"
                    }`}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {passwordCriteria.length ? (
                    <span className="text-emerald-700 font-medium">
                      {ar ? "الطول مطابق (15 حرفًا فأكثر)" : "Longueur conforme (15 caractères ou plus)"}
                    </span>
                  ) : (
                    <span>
                      {ar ? "مطلوب 15 حرفًا على الأقل لضمان أمان الحساب." : "15 caractères minimum requis par la sécurité ANEI."}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "تأكيد كلمة المرور" : "Confirmation du mot de passe"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="•••••••••••••••"
                  className="w-full h-12 auth-input-with-icon !ps-11 pe-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1">
                  {ar ? "كلمتا المرور غير متطابقتين." : "Les mots de passe ne correspondent pas."}
                </p>
              )}
            </div>

            {/* Terms checkbox */}
            <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-600 pt-2">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#0A192F] focus:ring-[#0A192F] mt-0.5"
              />
              <span>
                {ar ? (
                  <>أوافق على الشروط العامة للاستخدام وسياسة حماية البيانات الشخصية الخاصة بأكاديمية ANEI.</>
                ) : (
                  <>J&apos;accepte les conditions générales d&apos;utilisation et la charte de confidentialité de l&apos;Académie ANEI.</>
                )}
              </span>
            </label>
          </div>
        )}

        {/* ========================================================= */}
        {/* BOTTOM ACTION BAR                                         */}
        {/* ========================================================= */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
              className="text-sm font-semibold text-slate-500 hover:text-[#0A192F] transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{ar ? "الرجوع" : "Retour"}</span>
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              disabled={step === 2 && !canProceedStep2}
              onClick={() => setStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm px-7 py-3.5 shadow-xs transition-all disabled:opacity-40"
            >
              <span>{ar ? "متابعة" : "Continuer"}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading || !canProceedStep4}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm px-8 py-3.5 shadow-xs transition-all disabled:opacity-40"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{ar ? "جارٍ إنشاء الحساب..." : "Création du compte..."}</span>
                </>
              ) : (
                <>
                  <span>{ar ? "إنشاء الحساب وتأكيد الملف" : "Créer mon compte"}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
