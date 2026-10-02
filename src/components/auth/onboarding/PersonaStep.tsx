import Image from "next/image";
import { PERSONA_OPTIONS } from "./constants";
import type { StepProps } from "./types";

const PERSONA_FIGURINE: Record<string, string> = {
  STUDENT: "/media/persona-student.webp",
  PARENT: "/media/persona-parent.webp",
  TEACHER: "/media/persona-teacher.webp",
  AVS: "/media/persona-avs.webp",
  SPECIALIST: "/media/persona-specialist.webp",
  ORGANIZATION: "/media/persona-institution.webp",
};

export function PersonaStep({ data, errors, ar, set }: StepProps) {
  return (
    <fieldset className="wizard-fields wizard-persona-fieldset">
      <legend className="sr-only">{ar ? "اختر صفتك" : "Choisissez votre profil"}</legend>
      <div className="wizard-persona-grid" role="radiogroup" aria-describedby={errors.requestedPersona ? "err-requestedPersona" : undefined}>
        {PERSONA_OPTIONS.map((option) => (
          <label key={option.value} className="wizard-persona-option" data-checked={data.requestedPersona === option.value}>
            <input
              type="radio"
              name="requestedPersona"
              value={option.value}
              checked={data.requestedPersona === option.value}
              onChange={() => set("requestedPersona", option.value)}
            />
            {PERSONA_FIGURINE[option.value] && (
              <span className="auth-persona-visual" style={{ width: 36, height: 36, marginBottom: 4 }}>
                <Image
                  src={PERSONA_FIGURINE[option.value]}
                  alt=""
                  width={34}
                  height={34}
                  className="auth-persona-avatar-img"
                />
              </span>
            )}
            <strong>{ar ? option.ar : option.fr}</strong>
            <span>{ar ? option.descAr : option.descFr}</span>
          </label>
        ))}
      </div>
      {errors.requestedPersona && (
        <p id="err-requestedPersona" className="wizard-field-error" role="alert">
          {errors.requestedPersona}
        </p>
      )}
    </fieldset>
  );
}
