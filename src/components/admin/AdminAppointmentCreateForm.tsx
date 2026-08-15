"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAppointmentCreateForm({ organizationId, members, locale }: {
  organizationId: string;
  members: { userId: string; name: string }[];
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [contactId, setContactId] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState(members[0]?.userId ?? "");
  const [type, setType] = useState("ASSESSMENT");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        contactId,
        assignedToUserId,
        type,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        note: note || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.error === "SLOT_CONFLICT") setError(ar ? "تعارض في الموعد الحجز." : "Conflit d’horaire : créneau déjà pris.");
      else setError(ar ? "فشل إنشاء الموعد." : "Échec de la création du rendez-vous.");
      return;
    }
    setContactId("");
    setStartAt("");
    setEndAt("");
    setNote("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginBottom: 16 }}>
      <label><span>{ar ? "معرف جهة الاتصال" : "ID du contact"}</span><input required value={contactId} onChange={(e) => setContactId(e.target.value)} /></label>
      <label><span>{ar ? "المسؤول" : "Assigné à"}</span>
        <select required value={assignedToUserId} onChange={(e) => setAssignedToUserId(e.target.value)}>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
        </select>
      </label>
      <label><span>{ar ? "النوع" : "Type"}</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ASSESSMENT">{ar ? "تقييم" : "Évaluation"}</option>
          <option value="INFO_MEETING">{ar ? "اجتماع إعلامي" : "Entretien d’info"}</option>
          <option value="FOLLOW_UP">{ar ? "متابعة" : "Suivi"}</option>
          <option value="OTHER">{ar ? "أخرى" : "Autre"}</option>
        </select>
      </label>
      <label><span>{ar ? "البداية" : "Début"}</span><input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} /></label>
      <label><span>{ar ? "النهاية" : "Fin"}</span><input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)} /></label>
      <label><span>{ar ? "ملاحظة" : "Note"}</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "إنشاء موعد" : "Créer le rendez-vous"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}