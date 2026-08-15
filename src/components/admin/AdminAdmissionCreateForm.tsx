"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAdmissionCreateForm({ organizationId, locale }: {
  organizationId: string;
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [contactId, setContactId] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/admissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, contactId, assessmentId: assessmentId || null, reason: reason || null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(ar ? "فشل إنشاء ملف القبول." : "Échec de la création du dossier d’admission.");
      return;
    }
    setContactId("");
    setAssessmentId("");
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginBottom: 16 }}>
      <label><span>{ar ? "معرف جهة الاتصال" : "ID du contact"}</span><input required value={contactId} onChange={(e) => setContactId(e.target.value)} /></label>
      <label><span>{ar ? "معرف التقييم" : "ID de l’évaluation"}</span><input value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} /></label>
      <label><span>{ar ? "سبب" : "Motif"}</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "فتح ملف قبول" : "Ouvrir un dossier"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}