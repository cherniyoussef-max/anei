"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAppointmentActions({ organizationId, appointmentId, status, locale }: {
  organizationId: string;
  appointmentId: string;
  status: string;
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  async function call(url: string, body: Record<string, unknown>, key: string) {
    setSaving(key);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(null);
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      if (payload?.error === "SLOT_CONFLICT") setError(ar ? "تعارض في الموعد الحجز." : "Conflit d’horaire : créneau déjà pris.");
      else if (payload?.error === "INVALID_TRANSITION") setError(ar ? "تحويل غير صالح للحالة الحالية." : "Transition invalide pour l’état actuel.");
      else setError(ar ? "فشلت العملية." : "Échec de l’opération.");
      return;
    }
    setReschedule(false);
    router.refresh();
  }

  const mutable = status === "SCHEDULED" || status === "CONFIRMED";

  return (
    <div className="admin-list">
      <article>
        <div><strong>{ar ? "الحالة" : "Statut"}</strong><small>{status}</small></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {mutable && status === "SCHEDULED" ? (
            <button type="button" className="btn btn-primary btn-sm" disabled={saving === "status"}
              onClick={() => call(`/api/admin/crm/appointments/${appointmentId}/status`, { organizationId, status: "CONFIRMED" }, "status")}>
              {ar ? "تأكيد" : "Confirmer"}
            </button>
          ) : null}
          {mutable ? (
            <>
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "complete"}
                onClick={() => call(`/api/admin/crm/appointments/${appointmentId}/status`, { organizationId, status: "COMPLETED" }, "complete")}>
                {ar ? "إتمام" : "Terminer"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "noshow"}
                onClick={() => call(`/api/admin/crm/appointments/${appointmentId}/status`, { organizationId, status: "NO_SHOW" }, "noshow")}>
                {ar ? "عدم حضور" : "Absent"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "cancel"}
                onClick={() => call(`/api/admin/crm/appointments/${appointmentId}/status`, { organizationId, status: "CANCELLED" }, "cancel")}>
                {ar ? "إلغاء" : "Annuler"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "reschedule-toggle"} onClick={() => setReschedule(!reschedule)}>
                {ar ? "إعادة جدولة" : "Reprogrammer"}
              </button>
            </>
          ) : null}
        </div>
      </article>
      {reschedule ? (
        <article>
          <div><strong>{ar ? "إعادة جدولة" : "Reprogrammation"}</strong></div>
          <form onSubmit={(e) => { e.preventDefault(); call(`/api/admin/crm/appointments/${appointmentId}/reschedule`, { organizationId, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString() }, "reschedule"); }}
            style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} aria-label={ar ? "البداية" : "Début"} />
            <input type="datetime-local" required value={endAt} onChange={(e) => setEndAt(e.target.value)} aria-label={ar ? "النهاية" : "Fin"} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving === "reschedule"}>{ar ? "حفظ" : "Enregistrer"}</button>
          </form>
        </article>
      ) : null}
      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  );
}