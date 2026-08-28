import { Field } from "./Field";
import type { StepProps } from "./types";

export function IdentityStep({
  data,
  errors,
  ar,
  set,
  email,
  isOrganization,
}: StepProps & { email: string; isOrganization: boolean }) {
  return (
    <div className="wizard-fields">
      <label className="wizard-field">
        <span>Email</span>
        <input type="email" value={email} disabled />
      </label>
      <Field
        label={isOrganization ? (ar ? "اسم ممثل المؤسسة" : "Nom du représentant") : ar ? "الاسم" : "Prénom"}
        id="firstName"
        value={data.firstName}
        onChange={(v) => set("firstName", v)}
        error={errors.firstName}
        required
        maxLength={80}
      />
      <Field label={ar ? "اللقب" : "Nom"} id="lastName" value={data.lastName} onChange={(v) => set("lastName", v)} error={errors.lastName} required maxLength={80} />
    </div>
  );
}

export function validateIdentityStep(data: { firstName: string; lastName: string }, ar: boolean) {
  const errs: Record<string, string> = {};
  if (!data.firstName.trim()) errs.firstName = ar ? "الاسم مطلوب." : "Le prénom est requis.";
  if (!data.lastName.trim()) errs.lastName = ar ? "اللقب مطلوب." : "Le nom est requis.";
  return errs;
}
