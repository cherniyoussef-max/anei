"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAssessmentCreateForm({ organizationId, members, locale }: {
  organizationId: string;
  members: { userId: string; name: string }[];
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [contactId, setContactId] = useState("");
  const [appointmentId, setAppointmentId] = useState("");
  const [assessorUserId, setAssessorUserId] = useState(members[0]?.userId ?? "");
  const [summary, setSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        contactId,
        appointmentId: appointmentId || null,
        assessorUserId: assessorUserId || null,
        summary: summary || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(ar ? "فشل إنشاء التقييم." : "Échec de la création de l’évaluation.");
      return;
    }
    setContactId("");
    setAppointmentId("");
    setSummary("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginBottom: 16 }}>
      <label><span>{ar ? "معرف جهة الاتصال" : "ID du contact"}</span><input required value={contactId} onChange={(e) => setContactId(e.target.value)} /></label>
      <label><span>{ar ? "معرف الموعد" : "ID du rendez-vous"}</span><input value={appointmentId} onChange={(e) => setAppointmentId(e.target.value)} /></label>
      <label><span>{ar ? "المقيّم" : "Évaluateur"}</span>
        <select required value={assessorUserId} onChange={(e) => setAssessorUserId(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label><span>{ar ? "ملخص" : "Résumé"}</span><input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "إنشاء تقييم" : "Créer l’évaluation"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}