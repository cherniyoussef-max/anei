"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminSudoModal } from "@/components/admin/AdminSudoModal";

export function AdminUserRole({
  userId,
  role,
  canEdit,
  locale = "fr",
}: {
  userId: string;
  role: string;
  canEdit: boolean;
  locale?: Locale;
}) {
  const router = useRouter();
  const [currentRole, setCurrentRole] = useState(role);
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sudoOpen, setSudoOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!canEdit) {
    return <span className={`table-status role-${role.toLowerCase()}`}>{role}</span>;
  }

  async function performRoleChange(targetRole: string) {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setCurrentRole(targetRole);
        setPendingRole(null);
        router.refresh();
        return;
      }

      if (res.status === 403 && data.error === "SUDO_REQUIRED") {
        setPendingRole(targetRole);
        setSudoOpen(true);
        return;
      }

      setErrorMessage(data.message || (locale === "ar" ? "فشل تعديل الدور." : "Échec du changement de rôle."));
    } catch {
      setErrorMessage(locale === "ar" ? "خطأ في الاتصال." : "Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <select
        aria-label="Rôle utilisateur"
        value={currentRole}
        disabled={saving}
        onChange={(e) => performRoleChange(e.target.value)}
        style={{
          padding: "4px 8px",
          borderRadius: 6,
          border: "1px solid #cbd5e1",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
      </select>

      {errorMessage && (
        <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{errorMessage}</span>
      )}

      <AdminSudoModal
        isOpen={sudoOpen}
        locale={locale}
        actionTitle={locale === "ar" ? "تأكيد تعديل صلاحيات المستخدم" : "Confirmation de changement de rôle"}
        actionDescription={
          locale === "ar"
            ? "ترقية أو تغيير رتبة المستخدم إلى رتبة إدارية عملية حساسة تتطلب تأكيد كلمة مرورك في وضع Sudo."
            : "La modification des privilèges d'accès ou l'élévation administrative est une opération sensible protégée par le Mode Sudo. Veuillez confirmer votre mot de passe administrateur."
        }
        onSuccess={() => {
          setSudoOpen(false);
          if (pendingRole) performRoleChange(pendingRole);
        }}
        onCancel={() => {
          setSudoOpen(false);
          setPendingRole(null);
        }}
      />
    </div>
  );
}
