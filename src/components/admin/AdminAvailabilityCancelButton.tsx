"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminAvailabilityCancelButton({ locale, id }: { locale: Locale; id: string }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm(ar ? "هل تريد إلغاء هذه الفتحة؟" : "Annuler ce modèle de disponibilité ?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/availabilities/${id}/cancel`, { method: "POST" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClick}>
      {busy ? (ar ? "جارٍ الإلغاء..." : "Annulation...") : (ar ? "إلغاء" : "Annuler")}
    </button>
  );
}
