"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

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

  async function onClick() {
    if (!window.confirm(confirmMessage)) return;
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
      setMessage(STATUS_MESSAGES[res.status]?.[ar ? "ar" : "fr"] ?? (ar ? "فشلت العملية." : "Échec de l'opération."));
    } catch {
      setMessage(ar ? "خطأ في الشبكة." : "Erreur réseau.");
    } finally {
      setBusy(false);
    }
  }

  return <div style={{ display: "inline-grid", gap: 4 }}>
    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClick}>
      {busy ? (ar ? "جارٍ الحذف..." : "Suppression...") : label ?? (ar ? "حذف" : "Supprimer")}
    </button>
    {message ? <span className="form-error" style={{ padding: "4px 8px", fontSize: ".72rem" }}>{message}</span> : null}
  </div>;
}
