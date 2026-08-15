"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAdmissionActions({ organizationId, admissionId, decision, locale }: {
  organizationId: string;
  admissionId: string;
  decision: string;
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(target: "ACCEPTED" | "REJECTED") {
    setSaving(target);
    setError(null);
    const res = await fetch(`/api/admin/crm/admissions/${admissionId}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, decision: target, reason: reason || null }),
    });
    setSaving(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      if (payload?.error === "INVALID_TRANSITION") setError(ar ? "تم البت في الملف مسبقًا." : "Dossier déjà décidé.");
      else setError(ar ? "فشلت العملية." : "Échec de l’opération.");
      return;
    }
    router.refresh();
  }

  if (decision !== "PENDING") {
    return (
      <div className="admin-list">
        <article><div><strong>{ar ? "القرار" : "Décision"}</strong><small>{decision}</small></div></article>
      </div>
    );
  }

  return (
    <div className="admin-list">
      <article>
        <div><strong>{ar ? "البت في القرار" : "Décision"}</strong></div>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%" }}
          placeholder={ar ? "السبب (اختياري)" : "Motif (optionnel)"} />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" className="btn btn-primary btn-sm" disabled={saving === "ACCEPTED"}
            onClick={() => decide("ACCEPTED")}>{ar ? "قبول" : "Accepter"}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "REJECTED"}
            onClick={() => decide("REJECTED")}>{ar ? "رفض" : "Rejeter"}</button>
        </div>
      </article>
      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  );
}