import { PERSONA_OPTIONS } from "./constants";
import type { StepProps } from "./types";

export function PersonaStep({ data, errors, ar, set }: StepProps) {
  return (
    <fieldset className="wizard-fields" style={{ border: 0, padding: 0, margin: 0 }}>
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
