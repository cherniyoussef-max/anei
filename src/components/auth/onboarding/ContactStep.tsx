import { normalizeTunisiaPhone } from "@/lib/tunisia/phone";
import { getDelegationsForGovernorate, isValidGovernorateDelegation, TUNISIA_LOCATIONS } from "@/lib/tunisia/locations";
import { PhoneField } from "./PhoneField";
import { Combobox } from "./Combobox";
import { TunisiaFlag } from "./TunisiaFlag";
import type { StepProps } from "./types";

const GOVERNORATE_OPTIONS = TUNISIA_LOCATIONS.map((g) => ({ value: g.nameFr, label: g.nameFr }));

export function ContactStep({ data, errors, ar, set }: StepProps) {
  const delegationOptions = getDelegationsForGovernorate(data.governorate).map((d) => ({ value: d.nameFr, label: d.nameFr }));

  return (
    <div className="wizard-fields">
      <PhoneField value={data.phoneNumber} onChange={(digits) => set("phoneNumber", digits)} error={errors.phoneNumber} ar={ar} />

      <div className="wizard-field">
        <span className="wizard-label">{ar ? "الدولة" : "Pays"}</span>
        <span className="wizard-country-badge">
          <TunisiaFlag size={16} /> {ar ? "تونس" : "Tunisie"}
        </span>
      </div>

      <div className="wizard-field-grid">
        <Combobox
          id="governorate"
          label={ar ? "الولاية" : "Gouvernorat"}
          value={data.governorate}
          onChange={(value) => {
            set("governorate", value);
            if (data.city && !isValidGovernorateDelegation(value, data.city)) set("city", "");
          }}
          options={GOVERNORATE_OPTIONS}
          placeholder={ar ? "ابحث عن ولاية..." : "Rechercher un gouvernorat..."}
          error={errors.governorate}
          ar={ar}
        />
        <Combobox
          id="city"
          label={ar ? "المدينة / المعتمدية" : "Ville / délégation"}
          value={data.city}
          onChange={(value) => set("city", value)}
          options={delegationOptions}
          placeholder={ar ? "ابحث..." : "Rechercher..."}
          disabledHint={ar ? "اختر الولاية أولاً" : "Sélectionnez d'abord un gouvernorat"}
          error={errors.city}
          ar={ar}
        />
      </div>

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

export function validateContactStep(data: { phoneNumber: string; governorate: string; city: string }, ar: boolean) {
  const errs: Record<string, string> = {};
  if (!normalizeTunisiaPhone(data.phoneNumber)) {
    errs.phoneNumber = ar ? "رقم هاتف غير صالح (8 أرقام)." : "Numéro de téléphone invalide (8 chiffres).";
  }
  if (!data.governorate) errs.governorate = ar ? "الولاية مطلوبة." : "Le gouvernorat est requis.";
  if (!data.city) {
    errs.city = ar ? "المدينة/المعتمدية مطلوبة." : "La ville / délégation est requise.";
  } else if (data.governorate && !isValidGovernorateDelegation(data.governorate, data.city)) {
    errs.city = ar ? "هذه المعتمدية لا تنتمي إلى هذه الولاية." : "Cette délégation n'appartient pas à ce gouvernorat.";
  }
  return errs;
}
