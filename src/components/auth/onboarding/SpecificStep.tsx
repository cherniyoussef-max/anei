import { Field } from "./Field";
import { ERROR_MESSAGES } from "./constants";
import type { StepProps } from "./types";
import type { Persona } from "./constants";

export function SpecificStep({
  data,
  errors,
  ar,
  set,
  isOrganization,
  isParent,
  isStudent,
}: StepProps & { isOrganization: boolean; isParent: boolean; isStudent: boolean }) {
  if (isParent) return null;

  if (isStudent) {
    return (
      <div className="wizard-fields">
        <Field
          label={ar ? "المؤسسة / المدرسة" : "Établissement / École"}
          id="institutionName"
          value={data.institutionName}
          onChange={(v) => set("institutionName", v)}
          error={errors.institutionName}
          required
          maxLength={160}
        />
        <Field
          label={ar ? "المستوى الدراسي" : "Niveau d'étude"}
          id="educationLevel"
          value={data.educationLevel}
          onChange={(v) => set("educationLevel", v)}
          error={errors.educationLevel}
          required
          maxLength={120}
        />
      </div>
    );
  }

  if (isOrganization) {
    return (
      <div className="wizard-fields">
        <Field
          label={ar ? "اسم المؤسسة" : "Nom de l'organisation"}
          id="organizationName"
          value={data.organizationName}
          onChange={(v) => set("organizationName", v)}
          error={errors.organizationName}
          required
          maxLength={160}
        />
        <Field
          label={ar ? "نوع المؤسسة" : "Type d'organisation"}
          id="organizationType"
          value={data.organizationType}
          onChange={(v) => set("organizationType", v)}
          error={errors.organizationType}
          maxLength={120}
          hint={ar ? "اختياري" : "Facultatif"}
        />
        <Field
          label={ar ? "صفة الممثل" : "Rôle du représentant"}
          id="representativeRole"
          value={data.representativeRole}
          onChange={(v) => set("representativeRole", v)}
          error={errors.representativeRole}
          maxLength={120}
          hint={ar ? "اختياري" : "Facultatif"}
        />
      </div>
    );
  }

  const persona = data.requestedPersona as Persona;
  const optional = ar ? "اختياري" : "Facultatif";

  return (
    <div className="wizard-fields">
      {persona === "TEACHER" && (
        <Field
          label={ar ? "التخصص" : "Discipline"}
          id="discipline"
          value={data.discipline}
          onChange={(v) => set("discipline", v)}
          error={errors.discipline}
          maxLength={120}
          hint={optional}
        />
      )}
      {(persona === "TEACHER" || persona === "AVS" || persona === "SPECIALIST") && (
        <Field
          label={ar ? "المؤهل" : "Qualification"}
          id="qualification"
          value={data.qualification}
          onChange={(v) => set("qualification", v)}
          error={errors.qualification}
          maxLength={160}
          hint={optional}
        />
      )}
      {persona === "SPECIALIST" && (
        <Field
          label={ar ? "التخصص الدقيق" : "Spécialité"}
          id="specialty"
          value={data.specialty}
          onChange={(v) => set("specialty", v)}
          error={errors.specialty}
          maxLength={120}
          hint={optional}
        />
      )}
      <Field
        label={ar ? "سنوات الخبرة" : "Années d'expérience"}
        id="experienceYears"
        type="number"
        value={data.experienceYears}
        onChange={(v) => set("experienceYears", v)}
        error={errors.experienceYears}
        hint={optional}
      />
      {persona === "TEACHER" && (
        <Field
          label={ar ? "المستويات المُدرَّسة (مفصولة بفواصل)" : "Niveaux enseignés (séparés par des virgules)"}
          id="levelsTaught"
          value={data.levelsTaught}
          onChange={(v) => set("levelsTaught", v)}
          error={errors.levelsTaught}
          maxLength={200}
          hint={optional}
        />
      )}
      {persona === "TEACHER" && (
        <Field
          label={ar ? "المؤسسة أو الهيئة الموظِّفة" : "Établissement / Employeur"}
          id="professionalInstitution"
          value={data.professionalInstitution}
          onChange={(v) => set("professionalInstitution", v)}
          error={errors.professionalInstitution}
          maxLength={160}
          hint={optional}
        />
      )}
      {persona === "SPECIALIST" && (
        <Field
          label={ar ? "إطار الممارسة" : "Structure d'exercice"}
          id="practiceStructure"
          value={data.practiceStructure}
          onChange={(v) => set("practiceStructure", v)}
          error={errors.practiceStructure}
          maxLength={160}
          hint={optional}
        />
      )}
      {(persona === "AVS" || persona === "SPECIALIST") && (
        <Field
          label={ar ? "مجالات التدخل (مفصولة بفواصل)" : "Domaines d'intervention (séparés par des virgules)"}
          id="interventionDomains"
          value={data.interventionDomains}
          onChange={(v) => set("interventionDomains", v)}
          error={errors.interventionDomains}
          maxLength={200}
          hint={optional}
        />
      )}
    </div>
  );
}

export function validateSpecificStep(
  data: { institutionName: string; educationLevel: string; organizationName: string; experienceYears: string },
  isParent: boolean,
  isStudent: boolean,
  isOrganization: boolean,
  ar: boolean,
) {
  const errs: Record<string, string> = {};
  if (isParent) return errs;

  if (isStudent) {
    if (!data.institutionName.trim()) {
      errs.institutionName = ar ? ERROR_MESSAGES.institution_required.ar : ERROR_MESSAGES.institution_required.fr;
    }
    if (!data.educationLevel.trim()) {
      errs.educationLevel = ar ? ERROR_MESSAGES.education_level_required.ar : ERROR_MESSAGES.education_level_required.fr;
    }
    return errs;
  }

  if (isOrganization) {
    if (!data.organizationName.trim()) {
      errs.organizationName = ar ? ERROR_MESSAGES.institution_required.ar : ERROR_MESSAGES.institution_required.fr;
    }
    return errs;
  }

  if (data.experienceYears.trim()) {
    const parsed = Number(data.experienceYears);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 80) {
      errs.experienceYears = ar ? "يجب أن تكون سنوات الخبرة بين 0 و80." : "Les années d'expérience doivent être comprises entre 0 et 80.";
    }
  }

  return errs;
}
