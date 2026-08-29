"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { ERROR_MESSAGES, FIELD_STEP, STEP_META, type FormState, type Persona, type StepId } from "@/components/auth/onboarding/constants";
import { normalizeTunisiaPhone } from "@/lib/tunisia/phone";
import { PersonaStep } from "@/components/auth/onboarding/PersonaStep";
import { IdentityStep, validateIdentityStep } from "@/components/auth/onboarding/IdentityStep";
import { ContactStep, validateContactStep } from "@/components/auth/onboarding/ContactStep";
import { SpecificStep, validateSpecificStep } from "@/components/auth/onboarding/SpecificStep";
import { ReviewStep, validateReviewStep } from "@/components/auth/onboarding/ReviewStep";
import { ConfirmationStep } from "@/components/auth/onboarding/ConfirmationStep";

export function CompleteProfileForm({
  locale,
  email,
  name,
  initialPersona,
}: {
  locale: Locale;
  email: string;
  name: string;
  initialPersona: Persona | null;
}) {
  const router = useRouter();
  const ar = locale === "ar";

  const [first = "", ...rest] = name.trim().split(/\s+/);
  const [data, setData] = useState<FormState>({
    firstName: first,
    lastName: rest.join(" "),
    phoneNumber: "",
    country: "Tunisie",
    governorate: "",
    city: "",
    preferredLocale: locale === "ar" ? "ar" : "fr",
    requestedPersona: initialPersona ?? "",
    educationLevel: "",
    institutionName: "",
    discipline: "",
    levelsTaught: "",
    professionalInstitution: "",
    qualification: "",
    experienceYears: "",
    interventionDomains: "",
    specialty: "",
    practiceStructure: "",
    organizationName: "",
    organizationType: "",
    representativeRole: "",
    termsAccepted: false,
    privacyAccepted: false,
  });
  const [rawStepIndex, setStepIndex] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const isOrganization = data.requestedPersona === "ORGANIZATION";
  const isParent = data.requestedPersona === "PARENT";
  const isStudent = data.requestedPersona === "STUDENT";

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ["persona", "identity", "contact"];
    if (!isParent) list.push("specific");
    list.push("review");
    return list;
  }, [isParent]);

  const stepIndex = Math.min(rawStepIndex, steps.length - 1);

  useEffect(() => {
    headingRef.current?.focus();
  }, [stepIndex]);

  const currentStep = steps[stepIndex];
  const meta = STEP_META[currentStep];

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  function validateStep(step: StepId): Record<string, string> {
    switch (step) {
      case "persona":
        return data.requestedPersona
          ? {}
          : { requestedPersona: ar ? "يرجى اختيار صفتك للمتابعة." : "Choisissez votre profil pour continuer." };
      case "identity":
        return validateIdentityStep(data, ar);
      case "contact":
        return validateContactStep(data, ar);
      case "specific":
        return validateSpecificStep(data, isParent, isStudent, isOrganization, ar);
      case "review":
        return validateReviewStep(data, ar);
    }
  }

  function goBack() {
    setFieldErrors({});
    setSubmitError(null);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function goNext() {
    const errs = validateStep(currentStep);
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    if (stepIndex === steps.length - 1) {
      void submit();
      return;
    }
    setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  }

  async function submit() {
    setLoading(true);
    setSubmitError(null);

    const phoneNumber = normalizeTunisiaPhone(data.phoneNumber) ?? "";
    const payload: Record<string, unknown> = {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phoneNumber,
      country: data.country.trim(),
      governorate: data.governorate,
      city: data.city.trim(),
      preferredLocale: data.preferredLocale,
      requestedPersona: data.requestedPersona,
      termsAccepted: data.termsAccepted,
      privacyAccepted: data.privacyAccepted,
    };
    const splitList = (value: string) =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    if (isStudent) {
      payload.institutionName = data.institutionName.trim();
      payload.educationLevel = data.educationLevel.trim();
    } else if (isOrganization) {
      payload.organizationName = data.organizationName.trim();
      if (data.organizationType.trim()) payload.organizationType = data.organizationType.trim();
      if (data.representativeRole.trim()) payload.representativeRole = data.representativeRole.trim();
    } else if (data.requestedPersona === "TEACHER") {
      if (data.discipline.trim()) payload.discipline = data.discipline.trim();
      if (data.qualification.trim()) payload.qualification = data.qualification.trim();
      if (data.experienceYears.trim()) payload.experienceYears = Number(data.experienceYears);
      if (data.levelsTaught.trim()) payload.levelsTaught = splitList(data.levelsTaught);
      if (data.professionalInstitution.trim()) payload.professionalInstitution = data.professionalInstitution.trim();
    } else if (data.requestedPersona === "AVS") {
      if (data.qualification.trim()) payload.qualification = data.qualification.trim();
      if (data.experienceYears.trim()) payload.experienceYears = Number(data.experienceYears);
      if (data.interventionDomains.trim()) payload.interventionDomains = splitList(data.interventionDomains);
    } else if (data.requestedPersona === "SPECIALIST") {
      if (data.specialty.trim()) payload.specialty = data.specialty.trim();
      if (data.qualification.trim()) payload.qualification = data.qualification.trim();
      if (data.experienceYears.trim()) payload.experienceYears = Number(data.experienceYears);
      if (data.practiceStructure.trim()) payload.practiceStructure = data.practiceStructure.trim();
      if (data.interventionDomains.trim()) payload.interventionDomains = splitList(data.interventionDomains);
    }

    const response = await fetch("/api/auth/profile/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details = responseData?.details?.fieldErrors as Record<string, string[]> | undefined;
      if (details && Object.keys(details).length) {
        const mapped: Record<string, string> = {};
        for (const [key, messages] of Object.entries(details)) {
          const code = messages?.[0];
          const known = code ? ERROR_MESSAGES[code] : undefined;
          mapped[key] = known ? (ar ? known.ar : known.fr) : ar ? "قيمة غير صالحة." : "Valeur invalide.";
        }
        setFieldErrors(mapped);
        const erroredStep = steps.find((step) => Object.keys(mapped).some((key) => FIELD_STEP[key] === step));
        if (erroredStep) setStepIndex(steps.indexOf(erroredStep));
      } else {
        setSubmitError(responseData?.error || (ar ? "تعذر حفظ الملف الشخصي." : "Impossible d'enregistrer le profil."));
      }
      setLoading(false);
      return;
    }

    setLoading(false);
    setDone(true);
  }

  function continueAfterConfirmation() {
    router.push(`/${locale}/verification-channel`);
    router.refresh();
  }

  if (done) {
    return <ConfirmationStep ar={ar} onContinue={continueAfterConfirmation} />;
  }

  return (
    <div className="profile-wizard" aria-busy={loading}>
      <p className="sr-only" aria-live="polite">
        {ar
          ? `الخطوة ${stepIndex + 1} من ${steps.length}: ${meta.titleAr}`
          : `Étape ${stepIndex + 1} sur ${steps.length} : ${meta.titleFr}`}
      </p>
      <div className="wizard-progress-track" role="presentation">
        <span className={`wizard-progress-step-${stepIndex + 1}`} />
      </div>
      <ol className="wizard-progress-list" aria-hidden="true">
        {steps.map((step, index) => (
          <li key={step} data-state={index < stepIndex ? "done" : index === stepIndex ? "active" : "todo"}>
            <span className="wizard-dot">{index < stepIndex ? "✓" : index + 1}</span>
          </li>
        ))}
      </ol>
      <p className="wizard-step-meta">
        {ar ? `الخطوة ${stepIndex + 1}/${steps.length}` : `Étape ${stepIndex + 1}/${steps.length}`}
      </p>

      <form
        className="auth-form"
        onSubmit={(event) => {
          event.preventDefault();
          goNext();
        }}
      >
        <div className="wizard-step-head">
          <strong>{ar ? meta.eyebrowAr : meta.eyebrowFr}</strong>
          <h2 tabIndex={-1} ref={headingRef}>
            {ar ? meta.titleAr : meta.titleFr}
          </h2>
          <p>{ar ? meta.descAr : meta.descFr}</p>
        </div>

        {currentStep === "persona" && <PersonaStep data={data} errors={fieldErrors} ar={ar} set={set} />}
        {currentStep === "identity" && (
          <IdentityStep data={data} errors={fieldErrors} ar={ar} set={set} email={email} isOrganization={isOrganization} />
        )}
        {currentStep === "contact" && <ContactStep data={data} errors={fieldErrors} ar={ar} set={set} />}
        {currentStep === "specific" && (
          <SpecificStep data={data} errors={fieldErrors} ar={ar} set={set} isOrganization={isOrganization} isParent={isParent} isStudent={isStudent} />
        )}
        {currentStep === "review" && (
          <ReviewStep data={data} errors={fieldErrors} ar={ar} set={set} isOrganization={isOrganization} isParent={isParent} />
        )}

        {submitError && (
          <div className="wizard-error-summary" role="alert">
            {submitError}
          </div>
        )}

        <div className="wizard-nav">
          {stepIndex > 0 && (
            <button type="button" className="btn btn-ghost" onClick={goBack} disabled={loading}>
              {ar ? "السابق" : "Précédent"}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? ar
                ? "جارٍ الحفظ..."
                : "Enregistrement..."
              : stepIndex === steps.length - 1
                ? ar
                  ? "حفظ الملف"
                  : "Enregistrer le profil"
                : ar
                  ? "متابعة"
                  : "Continuer"}
          </button>
        </div>
      </form>
    </div>
  );
}
