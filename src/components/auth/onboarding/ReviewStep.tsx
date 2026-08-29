import { PERSONA_OPTIONS } from "./constants";
import { normalizeTunisiaPhone } from "@/lib/tunisia/phone";
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
          <dd>{normalizeTunisiaPhone(data.phoneNumber) || "—"}</dd>
        </div>
        <div className="wizard-summary-row">
          <dt>{ar ? "الموقع" : "Localisation"}</dt>
          <dd>{[data.city, data.governorate, "Tunisie"].filter(Boolean).join(", ")}</dd>
        </div>
        {data.requestedPersona === "STUDENT" && data.institutionName && (
          <div className="wizard-summary-row">
            <dt>{ar ? "المؤسسة" : "Établissement"}</dt>
            <dd>{data.institutionName}</dd>
          </div>
        )}
        {data.requestedPersona === "STUDENT" && data.educationLevel && (
          <div className="wizard-summary-row">
            <dt>{ar ? "المستوى الدراسي" : "Niveau d'étude"}</dt>
            <dd>{data.educationLevel}</dd>
          </div>
        )}
        {isOrganization && data.organizationName && (
          <div className="wizard-summary-row">
            <dt>{ar ? "اسم المؤسسة" : "Organisation"}</dt>
            <dd>{data.organizationName}</dd>
          </div>
        )}
        {isOrganization && data.organizationType && (
          <div className="wizard-summary-row">
            <dt>{ar ? "نوع المؤسسة" : "Type"}</dt>
            <dd>{data.organizationType}</dd>
          </div>
        )}
        {isOrganization && data.representativeRole && (
          <div className="wizard-summary-row">
            <dt>{ar ? "صفة الممثل" : "Rôle du représentant"}</dt>
            <dd>{data.representativeRole}</dd>
          </div>
        )}
        {data.requestedPersona === "TEACHER" && data.discipline && (
          <div className="wizard-summary-row">
            <dt>{ar ? "التخصص" : "Discipline"}</dt>
            <dd>{data.discipline}</dd>
          </div>
        )}
        {(data.requestedPersona === "TEACHER" || data.requestedPersona === "AVS" || data.requestedPersona === "SPECIALIST") &&
          data.qualification && (
            <div className="wizard-summary-row">
              <dt>{ar ? "المؤهل" : "Qualification"}</dt>
              <dd>{data.qualification}</dd>
            </div>
          )}
        {data.requestedPersona === "SPECIALIST" && data.specialty && (
          <div className="wizard-summary-row">
            <dt>{ar ? "التخصص الدقيق" : "Spécialité"}</dt>
            <dd>{data.specialty}</dd>
          </div>
        )}
        {(data.requestedPersona === "TEACHER" || data.requestedPersona === "AVS" || data.requestedPersona === "SPECIALIST") &&
          data.experienceYears && (
            <div className="wizard-summary-row">
              <dt>{ar ? "سنوات الخبرة" : "Expérience"}</dt>
              <dd>{data.experienceYears}</dd>
            </div>
          )}
        {data.requestedPersona === "TEACHER" && data.levelsTaught && (
          <div className="wizard-summary-row">
            <dt>{ar ? "المستويات المُدرَّسة" : "Niveaux enseignés"}</dt>
            <dd>{data.levelsTaught}</dd>
          </div>
        )}
        {data.requestedPersona === "TEACHER" && data.professionalInstitution && (
          <div className="wizard-summary-row">
            <dt>{ar ? "المؤسسة الموظِّفة" : "Établissement / Employeur"}</dt>
            <dd>{data.professionalInstitution}</dd>
          </div>
        )}
        {data.requestedPersona === "SPECIALIST" && data.practiceStructure && (
          <div className="wizard-summary-row">
            <dt>{ar ? "إطار الممارسة" : "Structure d'exercice"}</dt>
            <dd>{data.practiceStructure}</dd>
          </div>
        )}
        {(data.requestedPersona === "AVS" || data.requestedPersona === "SPECIALIST") && data.interventionDomains && (
          <div className="wizard-summary-row">
            <dt>{ar ? "مجالات التدخل" : "Domaines d'intervention"}</dt>
            <dd>{data.interventionDomains}</dd>
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
