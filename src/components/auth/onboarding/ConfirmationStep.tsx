import Image from "next/image";
import { Icon } from "@/components/ui/Icon";

export function ConfirmationStep({ ar, onContinue }: { ar: boolean; onContinue: () => void }) {
  return (
    <div className="wizard-confirm text-center py-4" role="status" aria-live="polite">
      <div
        style={{
          width: 104,
          height: 104,
          margin: "0 auto 16px",
          borderRadius: "50%",
          background: "#fdfbf7",
          border: "2px solid #eedec4",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 26px rgba(8, 45, 85, 0.12)",
        }}
      >
        <Image
          src="/media/auth-guide-celebrate.webp"
          alt=""
          width={104}
          height={104}
          className="object-cover"
          priority
        />
      </div>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#ecfdf5",
          color: "#059669",
          padding: "4px 12px",
          borderRadius: 999,
          fontWeight: 750,
          fontSize: "0.78rem",
          marginBottom: 10,
          border: "1px solid #a7f3d0",
        }}
      >
        <Icon name="check" size={14} />
        <span>{ar ? "تم إكمال الملف بنجاح" : "Profil validé avec succès"}</span>
      </div>

      <h2 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#082d55", margin: "0 0 8px" }}>
        {ar ? "مرحبًا بك في الأكاديمية!" : "Bienvenue dans l’Académie !"}
      </h2>

      <p style={{ color: "#64748b", fontSize: "0.88rem", lineHeight: 1.5, margin: "0 auto 22px", maxWidth: "44ch" }}>
        {ar
          ? "تم حفظ بياناتك وتخصيص مسارك التعليمي. سننقلك الآن لتأكيد جلستك والبدء في استكشاف دوراتك."
          : "Vos informations sont enregistrées et votre espace est prêt. Nous vous accompagnons pour confirmer votre session et démarrer."}
      </p>

      <button type="button" className="btn btn-primary btn-block auth-submit-btn" onClick={onContinue}>
        <span>{ar ? "الانتقال إلى مساحتي" : "Accéder à mon espace"}</span>
        <span aria-hidden="true">{ar ? " ←" : " →"}</span>
      </button>
    </div>
  );
}
