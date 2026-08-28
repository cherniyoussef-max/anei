import { Field } from "./Field";
import { GOVERNORATES, normalizePhoneNumber } from "./constants";
import type { StepProps } from "./types";
import { Icon } from "@/components/ui/Icon";

export function ContactStep({ data, errors, ar, set }: StepProps) {
  return (
    <div className="wizard-fields">
      <label className="wizard-field">
        <span className="wizard-label">{ar ? "رقم الهاتف/واتساب" : "Téléphone / WhatsApp"}</span>
        <input
          type="tel"
          placeholder="+216XXXXXXXX"
          value={data.phoneNumber}
          onChange={(event) => set("phoneNumber", event.target.value)}
          aria-describedby="phone-status err-phoneNumber"
          aria-invalid={Boolean(errors.phoneNumber)}
          required
        />
        <span id="phone-status" className="wizard-phone-status">
          <Icon name="phone" size={12} /> {ar ? "غير موثّق" : "Non vérifié"}
        </span>
        <small>{ar ? "سيُطلب التحقق عبر واتساب في مرحلة لاحقة." : "La vérification WhatsApp sera demandée à une étape suivante."}</small>
        {errors.phoneNumber && (
          <span id="err-phoneNumber" className="wizard-field-error" role="alert">
            {errors.phoneNumber}
          </span>
        )}
      </label>
      <Field label={ar ? "الدولة" : "Pays"} id="country" value={data.country} onChange={(v) => set("country", v)} error={errors.country} required />
      <label className="wizard-field">
        <span className="wizard-label">{ar ? "الولاية" : "Gouvernorat"}</span>
        <select
          value={data.governorate}
          onChange={(event) => set("governorate", event.target.value)}
          aria-describedby={errors.governorate ? "err-governorate" : undefined}
          aria-invalid={Boolean(errors.governorate)}
          required
        >
          <option value="" disabled>
            {ar ? "اختر الولاية" : "Sélectionnez un gouvernorat"}
          </option>
          {GOVERNORATES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        {errors.governorate && (
          <span id="err-governorate" className="wizard-field-error" role="alert">
            {errors.governorate}
          </span>
        )}
      </label>
      <Field label={ar ? "المدينة" : "Ville"} id="city" value={data.city} onChange={(v) => set("city", v)} error={errors.city} required />
      <label className="wizard-field">
        <span className="wizard-label">{ar ? "اللغة المفضلة" : "Langue préférée"}</span>
        <select value={data.preferredLocale} onChange={(event) => set("preferredLocale", event.target.value as "fr" | "ar")}>
          <option value="fr">Français</option>
          <option value="ar">العربية</option>
        </select>
      </label>
    </div>
  );
}

export function validateContactStep(data: { phoneNumber: string; country: string; governorate: string; city: string }, ar: boolean) {
  const errs: Record<string, string> = {};
  const phone = normalizePhoneNumber(data.phoneNumber);
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) errs.phoneNumber = ar ? "رقم هاتف غير صالح." : "Numéro de téléphone invalide.";
  if (!data.country.trim()) errs.country = ar ? "الدولة مطلوبة." : "Le pays est requis.";
  if (!data.governorate) errs.governorate = ar ? "الولاية مطلوبة." : "Le gouvernorat est requis.";
  if (!data.city.trim()) errs.city = ar ? "المدينة مطلوبة." : "La ville est requise.";
  return errs;
}
