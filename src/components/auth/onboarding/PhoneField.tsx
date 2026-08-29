import { extractNationalDigits, formatNationalDigits } from "@/lib/tunisia/phone";
import { TunisiaFlag } from "./TunisiaFlag";

/**
 * Tunisia-only phone input: fixed, non-editable +216 prefix paired with the
 * flag, the user only ever types the 8-digit national number. `value` is
 * the raw national digits (max 8); the caller normalizes to "+216XXXXXXXX"
 * at submit time via normalizeTunisiaPhone.
 */
export function PhoneField({
  value,
  onChange,
  error,
  ar,
}: {
  value: string;
  onChange: (digits: string) => void;
  error?: string;
  ar: boolean;
}) {
  return (
    <label className="wizard-field">
      <span className="wizard-label">{ar ? "رقم الهاتف/واتساب" : "Téléphone / WhatsApp"}</span>
      <div className="wizard-phone-group" dir="ltr">
        <span className="wizard-phone-prefix">
          <TunisiaFlag size={16} />
          <span>+216</span>
        </span>
        <input
          id="phoneNumber"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="20 311 900"
          value={formatNationalDigits(value)}
          onChange={(event) => onChange(extractNationalDigits(event.target.value))}
          aria-describedby={["phone-status", error ? "err-phoneNumber" : null].filter(Boolean).join(" ")}
          aria-invalid={Boolean(error)}
          aria-label={ar ? "رقم الهاتف المحلي المكوّن من 8 أرقام" : "Numéro de téléphone local, 8 chiffres"}
          required
        />
      </div>
      <span id="phone-status" className="wizard-hint">
        {ar ? "سيُطلب التحقق عبر واتساب في مرحلة لاحقة." : "La vérification WhatsApp sera demandée à une étape suivante."}
      </span>
      {error && (
        <span id="err-phoneNumber" className="wizard-field-error" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}
