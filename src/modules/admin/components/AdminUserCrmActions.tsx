"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

interface AdminUserCrmActionsProps {
  userEmail: string;
  userName: string;
  locale: string;
}

export function AdminUserCrmActions({ userEmail, userName, locale }: AdminUserCrmActionsProps) {
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleResetPassword = async () => {
    setResetting(true);
    setMessage(null);
    try {
      const res = await authClient.requestPasswordReset({
        email: userEmail,
        redirectTo: `/${locale}/reset-password`,
      });
      if (res.error) {
        setMessage(locale === "ar" ? "فشل إرسال الرابط." : "Échec de l'envoi.");
      } else {
        setMessage(
          locale === "ar"
            ? `تم إرسال رابط التعيين إلى ${userEmail}.`
            : `Un lien a été envoyé à ${userEmail}.`
        );
      }
    } catch (err) {
      setMessage(locale === "ar" ? "حدث خطأ." : "Une erreur s'est produite.");
    } finally {
      setResetting(false);
    }
  };

  const ar = locale === "ar";

  return (
    <div style={{ marginTop: 24, padding: "18px 22px", background: "#fff", border: "1px solid #e2e5ea", borderRadius: 10 }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#1e3a5f" }}>
        {ar ? "إجراءات CRM (المشرف المتميز)" : "Actions CRM (Super Admin)"}
      </h3>
      <p style={{ fontSize: 13, color: "#6b7a8d", marginBottom: 16 }}>
        {ar 
          ? "إدارة أمان حساب المستخدم واستعادة الوصول."
          : "Gérer la sécurité du compte utilisateur et la récupération d'accès."}
      </p>
      
      <button 
        onClick={handleResetPassword} 
        disabled={resetting}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "9px 16px", borderRadius: 8,
          fontSize: 13, fontWeight: 600, cursor: resetting ? "not-allowed" : "pointer",
          background: "#fff", color: "#1e3a5f", border: "1px solid #e2e5ea",
          opacity: resetting ? 0.7 : 1
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
        </svg>
        {resetting ? (ar ? "جاري الإرسال..." : "Envoi en cours...") : (ar ? "إرسال رابط إعادة تعيين كلمة المرور" : "Envoyer un lien de réinitialisation")}
      </button>

      {message && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#16a34a", fontWeight: 500 }}>
          {message}
        </div>
      )}
    </div>
  );
}
