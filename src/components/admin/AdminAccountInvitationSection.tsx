"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAccountInvitationSection({
  organizationId,
  contactId,
  invitation,
  eligible,
  locale,
}: {
  organizationId: string;
  contactId: string;
  invitation: {
    status: string;
    destinationPhone: string;
    sentAt: string | null;
    phoneVerifiedAt: string | null;
    consumedAt: string | null;
    revokedAt: string | null;
  } | null;
  eligible: boolean;
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationId }) });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? (ar ? "فشلت العملية." : "Échec de l’opération."));
      return;
    }
    router.refresh();
  }

  const isTerminal = invitation ? ["REVOKED", "CONSUMED", "EXPIRED"].includes(invitation.status) : false;
  const canCreate = eligible && (!invitation || isTerminal);
  const canResend = invitation && ["PENDING_SEND", "SENT", "SEND_FAILED"].includes(invitation.status);
  const canRevoke = invitation && !isTerminal;

  return (
    <section className="admin-surface">
      <h3>{ar ? "دعوة إنشاء حساب" : "Invitation de compte"}</h3>
      <div className="admin-list">
        {invitation ? (
          <article>
            <div>
              <strong>{ar ? "الحالة" : "Statut"}</strong>
              <small>{invitation.status} · ••••{invitation.destinationPhone.slice(-4)}</small>
            </div>
            <div className="admin-actions">
              {canResend ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => call(`/api/admin/crm/contacts/${contactId}/invitation/resend`)}>
                  {ar ? "إعادة الإرسال" : "Renvoyer"}
                </button>
              ) : null}
              {canRevoke ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => call(`/api/admin/crm/contacts/${contactId}/invitation/revoke`)}>
                  {ar ? "إلغاء الدعوة" : "Révoquer"}
                </button>
              ) : null}
              {canCreate ? (
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(`/api/admin/crm/contacts/${contactId}/invitation`)}>
                  {ar ? "إرسال دعوة جديدة" : "Envoyer une nouvelle invitation"}
                </button>
              ) : null}
            </div>
          </article>
        ) : (
          <article>
            <div>
              <strong>{ar ? "لا توجد دعوة بعد" : "Aucune invitation pour le moment"}</strong>
              {!eligible ? <small>{ar ? "غير مؤهل حاليًا (يتطلب قبول الملف وهاتف صالح وإعداد واتساب)." : "Non éligible actuellement (dossier accepté, téléphone valide et WhatsApp configuré requis)."}</small> : null}
            </div>
            {canCreate ? (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => call(`/api/admin/crm/contacts/${contactId}/invitation`)}>
                {ar ? "إرسال دعوة" : "Envoyer une invitation"}
              </button>
            ) : null}
          </article>
        )}
        {error ? <p className="admin-error">{error}</p> : null}
      </div>
    </section>
  );
}
