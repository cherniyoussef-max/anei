"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import { AdminSudoModal } from "@/components/admin/AdminSudoModal";

const STATUS_MESSAGES: Record<number, { fr: string; ar: string }> = {
  403: { fr: "Action non autorisée.", ar: "غير مصرح بهذا الإجراء." },
  404: { fr: "Élément introuvable (déjà supprimé ?).", ar: "العنصر غير موجود (ربما تم حذفه بالفعل)." },
  409: { fr: "Conflit : l'élément a changé, rechargez la page.", ar: "تعارض: تغيّر العنصر، أعد تحميل الصفحة." },
  429: { fr: "Trop de tentatives, réessayez dans un instant.", ar: "محاولات كثيرة جدًا، أعد المحاولة بعد قليل." },
};

export function AdminDeleteButton({ locale, endpoint, confirmMessage, label }: {
  locale: Locale; endpoint: string; confirmMessage: string; label?: string;
}) {
  const ar = locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sudoOpen, setSudoOpen] = useState(false);

  async function executeDelete() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (res.ok) {
        const body = await res.json().catch(() => null) as { archived?: boolean } | null;
        if (body?.archived) {
          setMessage(ar ? "تم الأرشفة بدل الحذف (توجد تسجيلات/مشتريات مرتبطة)." : "Archivé plutôt que supprimé (des inscriptions/achats y sont liés).");
        }
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 && data.error === "SUDO_REQUIRED") {
        setSudoOpen(true);
        return;
      }
      setMessage(STATUS_MESSAGES[res.status]?.[ar ? "ar" : "fr"] ?? (ar ? "فشلت العملية." : "Échec de l'opération."));
    } catch {
      setMessage(ar ? "خطأ في الشبكة." : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  async function onClick() {
    if (!window.confirm(confirmMessage)) return;
    await executeDelete();
  }

  return <>
    <div style={{ display: "inline-grid", gap: 4 }}>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClick}>
        {busy ? (ar ? "جارٍ الحذف..." : "Suppression...") : label ?? (ar ? "حذف" : "Supprimer")}
      </button>
      {message ? <span className="form-error" style={{ padding: "4px 8px", fontSize: ".72rem" }}>{message}</span> : null}
    </div>
    <AdminSudoModal
      isOpen={sudoOpen}
      locale={locale}
      actionTitle={ar ? "تأكيد حذف الدورة" : "Confirmation de suppression de formation"}
      actionDescription={ar ? "حذف هذه الدورة إجراء حساس لا يمكن التراجع عنه. أدخل كلمة مرورك للمتابعة." : "La suppression d'une formation est une action irréversible. Veuillez confirmer votre mot de passe administrateur pour valider."}
      onSuccess={() => {
        setSudoOpen(false);
        executeDelete();
      }}
      onCancel={() => setSudoOpen(false)}
    />
  </>;
}
