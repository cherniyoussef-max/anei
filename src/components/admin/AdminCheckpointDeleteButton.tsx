"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminCheckpointDeleteButton({ locale, lessonId, checkpointId }: { locale: Locale; lessonId: string; checkpointId: string }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm(ar ? "هل تريد حذف نقطة التفاعل هذه؟" : "Supprimer ce checkpoint ?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/lessons/${lessonId}/checkpoints/${checkpointId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onClick}>
      {busy ? (ar ? "جارٍ الحذف..." : "Suppression...") : (ar ? "حذف" : "Supprimer")}
    </button>
  );
}
