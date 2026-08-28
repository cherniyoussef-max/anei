import { Field } from "./Field";
import { ERROR_MESSAGES } from "./constants";
import type { StepProps } from "./types";

export function SpecificStep({
  data,
  errors,
  ar,
  set,
  isOrganization,
  isParent,
  isStudent,
}: StepProps & { isOrganization: boolean; isParent: boolean; isStudent: boolean }) {
  return (
    <div className="wizard-fields">
      {!isParent && (
        <Field
          label={
            isOrganization
              ? ar ? "اسم المؤسسة" : "Nom de l'organisation"
              : isStudent
                ? ar ? "المؤسسة / المدرسة" : "Établissement / École"
                : ar ? "المؤسسة أو الهيئة الموظِّفة" : "Établissement / Employeur"
          }
          id="institutionName"
          value={data.institutionName}
          onChange={(v) => set("institutionName", v)}
          error={errors.institutionName}
          required
          maxLength={160}
        />
      )}
      {!isOrganization && (
        <Field
          label={isStudent ? (ar ? "المستوى الدراسي" : "Niveau d'étude") : ar ? "المؤهل / التخصص" : "Qualification / Spécialité"}
          id="educationLevel"
          value={data.educationLevel}
          onChange={(v) => set("educationLevel", v)}
          error={errors.educationLevel}
          required={isStudent}
          maxLength={120}
          hint={!isStudent ? (ar ? "اختياري" : "Facultatif") : undefined}
        />
      )}
    </div>
  );
}

export function validateSpecificStep(data: { institutionName: string; educationLevel: string }, isParent: boolean, isStudent: boolean, ar: boolean) {
  const errs: Record<string, string> = {};
  if (!isParent && !data.institutionName.trim()) {
    errs.institutionName = ar ? ERROR_MESSAGES.institution_required.ar : ERROR_MESSAGES.institution_required.fr;
  }
  if (isStudent && !data.educationLevel.trim()) {
    errs.educationLevel = ar ? ERROR_MESSAGES.education_level_required.ar : ERROR_MESSAGES.education_level_required.fr;
  }
  return errs;
}
