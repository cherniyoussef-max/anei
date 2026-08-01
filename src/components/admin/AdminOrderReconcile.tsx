"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function AdminOrderReconcile({ orderId, locale, enabled }: { orderId: string; locale: Locale; enabled: boolean }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!enabled) return <span className="small-muted">—</span>;
  return <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={async () => {
    setBusy(true);
    const response = await fetch(`/api/admin/orders/${orderId}/reconcile`, { method: "POST" });
    setBusy(false);
    if (response.ok) router.refresh();
  }}>{busy ? (ar ? "تحقق..." : "Vérification…") : ar ? "تسوية" : "Réconcilier"}</button>;
}
