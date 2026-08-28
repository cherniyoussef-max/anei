import { Icon } from "@/components/ui/Icon";

export function ConfirmationStep({ ar, onContinue }: { ar: boolean; onContinue: () => void }) {
  return (
    <div className="wizard-confirm" role="status" aria-live="polite">
      <div className="status-icon">
        <Icon name="check" size={28} />
      </div>
      <h2>{ar ? "تم حفظ ملفك الشخصي" : "Profil enregistré ✓"}</h2>
      <p>
        {ar
          ? "شكرًا لك. سننقلك الآن إلى خطوة التحقق التالية."
          : "Merci. Nous vous accompagnons maintenant vers l'étape de vérification suivante."}
      </p>
      <button type="button" className="btn btn-primary btn-block" onClick={onContinue}>
        {ar ? "متابعة" : "Continuer"}
      </button>
    </div>
  );
}
