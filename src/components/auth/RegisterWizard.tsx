"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import type { Locale } from "@/types";
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
  Phone,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  MapPin,
  Sparkles,
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

export type CategoryChoice = "LEARNER" | "AVS" | "SPECIALIST";

export function RegisterWizard({ locale }: { locale: Locale }) {
  const router = useRouter();
  const search = useSearchParams();
  const ar = locale === "ar";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Category
  const [category, setCategory] = useState<CategoryChoice>(() => {
    const roleParam = search.get("role")?.toLowerCase();
    if (roleParam === "avs") return "AVS";
    if (roleParam === "specialist") return "SPECIALIST";
    return "LEARNER";
  });

  // Step 2: Coordinates
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+216 ");
  const [governorate, setGovernorate] = useState("Tunis");
  const [city, setCity] = useState("Tunis");
  const [acquisitionSource, setAcquisitionSource] = useState("FACEBOOK_INSTAGRAM");
  const [ageGroup, setAgeGroup] = useState("26-35");

  // Step 3: Learner
  const [subRole, setSubRole] = useState("Parent d'un enfant à besoin spécifique");
  const [educationLevel, setEducationLevel] = useState("Licence");
  const [institutionName, setInstitutionName] = useState("");
  const [interests, setInterests] = useState<string[]>(["Autisme (TSA)", "Troubles DYS"]);

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
    return firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
      phone.trim().replace(/\s+/g, "").length >= 8 &&
      governorate.length > 0 &&
      city.length > 0;
  }, [firstName, lastName, email, phone, governorate, city]);

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
            ? "حدّدوا صفتكم الرئيسية. تتيح لكم الوصول إلى مساحة عملكم والميزات المخصصة."
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
        if (category === "LEARNER") {
          return {
            title: ar ? "حدّدوا صفة ملفكم التعليمي" : "Précisez votre profil d'apprenant",
            subtitle: ar
              ? "خصّصوا اهتماماتكم ومساركم التعليمي للحصول على أفضل التوصيات."
              : "Personnalisez vos recommandations de formation et vos parcours d'apprentissage.",
          };
        } else if (category === "AVS") {
          return {
            title: ar ? "إعداد بطاقتكم العامة لمرافق الحياة المدرسية" : "Configurez votre fiche publique d'AVS",
            subtitle: ar
              ? "ستُعرض هذه التفاصيل على بطاقتكم في الدليل الرسمي لمرافقي الحياة المدرسية /avs."
              : "Ces détails seront affichés sur votre profil dans l'annuaire officiel des AVS.",
          };
        } else {
          return {
            title: ar ? "إعداد بطاقتكم العيادية في دليل الأخصائيين" : "Configurez votre fiche de Spécialiste & Cabinet",
            subtitle: ar
              ? "سيتم إدراج عيادتكم تلقائيًا في دليل /specialistes مع وسائل الاتصال وجدول المواعيد."
              : "Votre profil sera automatiquement référencé dans l'annuaire /specialistes avec vos coordonnées et créneaux.",
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
  }, [step, category, ar]);

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
      category,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      governorate,
      city,
      acquisitionSource,
      ageGroup,
      locale,
      password,
      referredByCode: search.get("ref")?.trim() || undefined,
      // Category specifics
      ...(category === "LEARNER"
        ? {
            subRole,
            educationLevel,
            institutionName: institutionName.trim() || undefined,
            interests,
          }
        : category === "AVS"
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
        : {
            specialty,
            workplaceName: workplaceName.trim() || undefined,
            workplaceAddress: workplaceAddress.trim() || undefined,
            licenseOrOrderNumber: licenseOrOrderNumber.trim() || undefined,
            experienceYears: Number(specExperienceYears) || 3,
            interventionDomains: specDomains,
            inPersonPriceMillimes: Math.round(inPersonRateTnd * 1000),
            onlineVisioPriceMillimes: Math.round(specOnlineRateTnd * 1000),
            bio: specBio.trim() || undefined,
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
          <div className="space-y-4 mb-8" role="radiogroup" aria-label={ar ? "اختر صفتك" : "Choisissez votre profil"}>
            {/* Card 1: Learner / Parent / Educator */}
            <div
              onClick={() => setCategory("LEARNER")}
              className={`group cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                category === "LEARNER"
                  ? "border-[#0A192F] bg-slate-50/60 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="relative w-full sm:w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <Image
                  src="/media/domain-pedagogie.webp"
                  alt="Apprenant & Famille"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-2 start-2 w-8 h-8 rounded-lg bg-[#0A192F]/80 text-white flex items-center justify-center backdrop-blur-xs">
                  <GraduationCap className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-bold text-[#0A192F]">
                    {ar ? "طالب، ولي أمر أو مربّي" : "Apprenant, Parent ou Enseignant"}
                  </h3>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      category === "LEARNER"
                        ? "border-[#0A192F] bg-[#0A192F] text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {category === "LEARNER" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-2.5">
                  {ar
                    ? "متابعة الدورات التدريبية المعتمدة، نيل الشهادات وحجز الحصص مع الممارسين."
                    : "Suivre les formations certifiantes, obtenir des diplômes ANEI et réserver des séances avec des AVS ou Spécialistes."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {ar ? "تكوين" : "Formations"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {ar ? "شهادات" : "Certificats"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {ar ? "أولياء وأطر تربوية" : "Parents & Familles"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: AVS */}
            <div
              onClick={() => setCategory("AVS")}
              className={`group cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                category === "AVS"
                  ? "border-[#0A192F] bg-slate-50/60 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="relative w-full sm:w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <Image
                  src="/media/domain-avs.webp"
                  alt="Accompagnant de Vie Scolaire"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-2 start-2 w-8 h-8 rounded-lg bg-[#0A192F]/80 text-white flex items-center justify-center backdrop-blur-xs">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-bold text-[#0A192F]">
                    {ar ? "مرافق حياة مدرسية (AVS)" : "Accompagnant de Vie Scolaire (AVS)"}
                  </h3>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      category === "AVS"
                        ? "border-[#0A192F] bg-[#0A192F] text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {category === "AVS" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-2.5">
                  {ar
                    ? "مرافقة التلاميذ في الوسط المدرسي أو المنزلي والظهور التلقائي في الدليل الرسمي."
                    : "Accompagner les élèves en milieu scolaire ou à domicile et apparaître automatiquement dans l'annuaire officiel /avs."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[11px] font-semibold text-blue-700">
                    {ar ? "دليل /avs الرسمي" : "Annuaire /avs"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                    {ar ? "0% عمولة حضوري" : "0% commission présentiel"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {ar ? "مدارس وتدخلات" : "Établissements"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Specialist */}
            <div
              onClick={() => setCategory("SPECIALIST")}
              className={`group cursor-pointer p-4 sm:p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row items-start sm:items-center gap-4 ${
                category === "SPECIALIST"
                  ? "border-[#0A192F] bg-slate-50/60 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="relative w-full sm:w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <Image
                  src="/media/about-care-team-v1.webp"
                  alt="Spécialiste & Clinicien"
                  fill
                  className="object-cover"
                />
                <span className="absolute top-2 start-2 w-8 h-8 rounded-lg bg-[#0A192F]/80 text-white flex items-center justify-center backdrop-blur-xs">
                  <Stethoscope className="w-4 h-4 text-white" />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-bold text-[#0A192F]">
                    {ar ? "أخصائي عيادي وصاحب عيادة" : "Spécialiste & Clinicien"}
                  </h3>
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      category === "SPECIALIST"
                        ? "border-[#0A192F] bg-[#0A192F] text-white"
                        : "border-slate-300"
                    }`}
                  >
                    {category === "SPECIALIST" && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-2.5">
                  {ar
                    ? "أخصائي تخاطب، نفساني، حركي، وظيفي — نشر العيادة في دليل /specialistes وإدارة المواعيد."
                    : "Orthophoniste, Psychologue, Psychomotricien, Pédopsychiatre, Ergothérapeute — publier votre cabinet dans /specialistes et gérer vos rendez-vous."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[11px] font-semibold text-purple-700">
                    {ar ? "دليل /specialistes" : "Annuaire /specialistes"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    {ar ? "عيادة وتطبيب عن بعد" : "Cabinet & Téléconsultation"}
                  </span>
                </div>
              </div>
            </div>
          </div>
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
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nom@exemple.com"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors text-left dir-ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "رقم الهاتف الرسمي" : "Numéro de téléphone (+216)"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4" />
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+216 98 123 456"
                  className="w-full h-12 ps-11 pe-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors text-left dir-ltr"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {ar ? "مهم للتواصل المباشر مع الأولياء وإشعارات المواعيد الرسمية." : "Enregistré pour votre compte et affiché pour les prises de contact."}
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
                    className="w-full h-12 ps-10 pe-8 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors appearance-none"
                  >
                    {TUNISIA_GOVERNORATES_BILINGUAL.map((g) => (
                      <option key={g.fr} value={g.fr}>
                        {ar ? `${g.ar} (${g.fr})` : `${g.fr} — ${g.ar}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المدينة / المعتمدية" : "Ville / Délégation"} <span className="text-red-500">*</span>
                </label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                >
                  {availableDelegations.map((d) => (
                    <option key={d.code} value={d.nameFr}>
                      {d.nameFr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "كيف تعرفتم على ANEI؟" : "Canal d'acquisition"}
                </label>
                <select
                  value={acquisitionSource}
                  onChange={(e) => setAcquisitionSource(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
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
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "الفئة العمرية" : "Tranche d'âge"}
                </label>
                <select
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                >
                  <option value="18-25">18 - 25 ans</option>
                  <option value="26-35">26 - 35 ans</option>
                  <option value="36-50">36 - 50 ans</option>
                  <option value="+50">+50 ans</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: DYNAMIC CATEGORY FIELDS                           */}
        {/* ========================================================= */}
        {step === 3 && category === "LEARNER" && (
          <div className="space-y-5 mb-8">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "الصّفة الدقيقة" : "Sous-profil d'apprenant"}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    id: "Parent d'un enfant à besoin spécifique",
                    label: ar ? "ولي أمر طفل ذو حاجة خصوصية" : "Parent d'enfant",
                    icon: HeartHandshake,
                  },
                  {
                    id: "Enseignant / Cadre éducatif",
                    label: ar ? "مدرس / إطار تربوي" : "Enseignant / Éducateur",
                    icon: BookOpen,
                  },
                  {
                    id: "Étudiant / Futur AVS",
                    label: ar ? "طالب / مترشح لمرافقة AVS" : "Étudiant / Futur AVS",
                    icon: GraduationCap,
                  },
                  {
                    id: "Professionnel de santé",
                    label: ar ? "ممارس صحي أو مهتم" : "Professionnel de santé",
                    icon: Stethoscope,
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
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                >
                  <option value="Baccalauréat">Baccalauréat</option>
                  <option value="Licence">Licence</option>
                  <option value="Master">Master</option>
                  <option value="Doctorat">Doctorat</option>
                  <option value="Formation professionnelle">Formation professionnelle</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  {ar ? "المؤسسة أو الهيئة (اختياري)" : "Établissement / Institution"}
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder={ar ? "اسم المدرسة أو الجامعة" : "Ex. École primaire, Faculté..."}
                  className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                {ar ? "المجالات ذات الأولوية" : "Centres d'intérêt prioritaires"}
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
                  { id: "Orthophoniste", label: "🗣️ Orthophoniste", desc: "Langage, communication, DYS" },
                  { id: "Psychologue Clinicien", label: "🧠 Psychologue Clinicien", desc: "Bilans, TSA, TDAH, suivi" },
                  { id: "Psychomotricien", label: "🤸 Psychomotricien", desc: "Sensori-moteur, schéma corporel" },
                  { id: "Ergothérapeute", label: "🖐️ Ergothérapeute", desc: "Autonomie quotidienne & scolaire" },
                  { id: "Pédopsychiatre", label: "🩺 Pédopsychiatre", desc: "Diagnostic & prise en charge" },
                  { id: "Éducateur Spécialisé", label: "🧩 Éducateur Spécialisé", desc: "Programmes ABA / TEACCH" },
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
        {/* STEP 4: SECURITY & RECAPITULATIVE SUMMARY                 */}
        {/* ========================================================= */}
        {step === 4 && (
          <div className="space-y-6 mb-8">
            {/* Visual Summary Card */}
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-slate-50/80">
              <div className="flex items-center gap-3.5 mb-3">
                <span className="w-10 h-10 rounded-xl bg-[#0A192F] text-white flex items-center justify-center font-bold">
                  {category === "SPECIALIST" ? (
                    <Stethoscope className="w-5 h-5" />
                  ) : category === "AVS" ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <GraduationCap className="w-5 h-5" />
                  )}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#0A192F]">
                    {firstName} {lastName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {category === "SPECIALIST"
                      ? `${specialty} • ${governorate}`
                      : category === "AVS"
                      ? `AVS • ${governorate}`
                      : `${subRole} • ${governorate}`}
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
                  <span className="font-semibold text-slate-800 block dir-ltr text-start">{phone}</span>
                </div>
              </div>

              {(category === "AVS" || category === "SPECIALIST") && (
                <div className="mt-3.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">
                    {ar
                      ? "✓ سيتم نشر بطاقتكم المهنية في الدليل الرسمي فور إنشاء الحساب."
                      : "✓ Votre fiche professionnelle sera publiée dans l'annuaire dès la création du compte."}
                  </span>
                </div>
              )}
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
                  className="w-full h-12 ps-10 pe-11 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
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
                      {ar ? "✓ الطول مطابق (15 حرفًا فأكثر)" : "✓ Longueur conforme (15 caractères ou plus)"}
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
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="•••••••••••••••"
                className="w-full h-12 px-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
              />
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
