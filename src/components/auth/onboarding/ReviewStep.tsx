import { PERSONA_OPTIONS, normalizePhoneNumber } from "./constants";
import type { StepProps } from "./types";

export function ReviewStep({
  data,
  errors,
  ar,
  set,
  isOrganization,
  isParent,
}: StepProps & { isOrganization: boolean; isParent: boolean }) {
  return (
    <div className="wizard-fields">
      <dl className="wizard-summary">
        <div className="wizard-summary-row">
          <dt>{ar ? "الصفة" : "Profil"}</dt>
          <dd>{PERSONA_OPTIONS.find((o) => o.value === data.requestedPersona)?.[ar ? "ar" : "fr"]}</dd>
        </div>
        <div className="wizard-summary-row">
          <dt>{ar ? "الاسم الكامل" : "Nom complet"}</dt>
          <dd>{`${data.firstName} ${data.lastName}`.trim()}</dd>
        </div>
        <div className="wizard-summary-row">
          <dt>{ar ? "الهاتف" : "Téléphone"}</dt>
          <dd>{normalizePhoneNumber(data.phoneNumber) || "—"}</dd>
        </div>
        <div className="wizard-summary-row">
          <dt>{ar ? "الموقع" : "Localisation"}</dt>
          <dd>{[data.city, data.governorate, data.country].filter(Boolean).join(", ")}</dd>
        </div>
        {!isParent && data.institutionName && (
          <div className="wizard-summary-row">
            <dt>{isOrganization ? (ar ? "اسم المؤسسة" : "Organisation") : ar ? "المؤسسة" : "Établissement"}</dt>
            <dd>{data.institutionName}</dd>
          </div>
        )}
      </dl>
      {isParent && (
        <p className="wizard-hint">
          {ar
            ? "سيتم ربط حسابك بالمتعلمين المصرَّح لهم من طرف فريق الأكاديمية بعد المراجعة."
            : "Le lien avec le ou les apprenants sera activé par l'équipe ANEI après vérification, de façon sécurisée."}
        </p>
      )}
      <label className="check-field">
        <input type="checkbox" checked={data.termsAccepted} onChange={(event) => set("termsAccepted", event.target.checked)} required />
        {ar ? "أوافق على الشروط" : "J'accepte les conditions"}
      </label>
      {errors.termsAccepted && (
        <p className="wizard-field-error" role="alert">
          {errors.termsAccepted}
        </p>
      )}
      <label className="check-field">
        <input type="checkbox" checked={data.privacyAccepted} onChange={(event) => set("privacyAccepted", event.target.checked)} required />
        {ar ? "أوافق على سياسة الخصوصية" : "J'accepte la politique de confidentialité"}
      </label>
      {errors.privacyAccepted && (
        <p className="wizard-field-error" role="alert">
          {errors.privacyAccepted}
        </p>
      )}
    </div>
  );
}

export function validateReviewStep(data: { termsAccepted: boolean; privacyAccepted: boolean }, ar: boolean) {
  const errs: Record<string, string> = {};
  if (!data.termsAccepted) errs.termsAccepted = ar ? "يجب الموافقة على الشروط." : "Vous devez accepter les conditions.";
  if (!data.privacyAccepted) errs.privacyAccepted = ar ? "يجب الموافقة على سياسة الخصوصية." : "Vous devez accepter la politique de confidentialité.";
  return errs;
}
