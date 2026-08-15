"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDate } from "@/lib/i18n";
import type { Locale } from "@/types";

type InvitationListItem = {
  id: string;
  status: string;
  tokenVersion: number;
  sendAttemptCount: number;
  createdAt: string;
  contactFirstName: string | null;
  contactLastName: string | null;
};

/**
 * Admin invitation management for a single contact: create, send, resend,
 * revoke. Authorization is server-side (crm.manage + MANAGER org role); this
 * section is only a UI surface. Errors are surfaced generically.
 */
export function AdminInvitationSection({
  organizationId,
  contactId,
  locale,
}: {
  organizationId: string;
  contactId: string;
  locale: Locale;
}) {
  const ar = locale === "ar";
  const [invitations, setInvitations] = useState<InvitationListItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(
      `/api/admin/crm/invitations?organizationId=${encodeURIComponent(organizationId)}&contactId=${encodeURIComponent(contactId)}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    setInvitations(Array.isArray(data.items) ? data.items : []);
  }, [organizationId, contactId]);

  useEffect(() => {
    let cancelled = false;
    fetch(
      `/api/admin/crm/invitations?organizationId=${encodeURIComponent(organizationId)}&contactId=${encodeURIComponent(contactId)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setInvitations(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [organizationId, contactId]);

  async function run(path: string, action: string) {
    if (busy) return;
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      if (res.status === 429) {
        setError(ar ? "انتظر قبل إعادة المحاولة." : "Attendez avant de réessayer.");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "INVALID_TEMPLATE") {
          setError(ar ? "قالب واتساب الدعوة غير مُعدّ في هذه المنظمة." : "Le modèle WhatsApp d’invitation n’est pas configuré dans cette organisation.");
        } else if (data?.error === "NO_ACCOUNT") {
          setError(ar ? "لم يُعدّ حساب واتساب لهذه المنظمة." : "Aucun compte WhatsApp configuré pour cette organisation.");
        } else {
          setError(ar ? "تعذر تنفيذ العملية." : "Impossible d’exécuter l’action.");
        }
        return;
      }
      setMessage(ar ? "تم بنجاح." : "Action effectuée.");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function create() {
    if (busy) return;
    setBusy("create");
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/crm/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, contactId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.error === "NOT_ELIGIBLE") {
          setError(ar ? "لا يمكن دعوة هذه الجهة: لا يوجد قبول مكتمل." : "Invitation impossible : aucun admission accepté.");
        } else if (data?.error === "ALREADY_LINKED") {
          setError(ar ? "هذه الجهة مرتبطة بحساب بالفعل." : "Ce contact est déjà lié à un compte.");
        } else if (data?.error === "INVITATION_EXISTS") {
          setError(ar ? "يوجد طلب دعوة نشط لهذه الجهة." : "Une invitation active existe déjà pour ce contact.");
        } else {
          setError(ar ? "تعذر إنشاء الدعوة." : "Impossible de créer l’invitation.");
        }
        return;
      }
      setMessage(ar ? "تم إنشاء الدعوة." : "Invitation créée.");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const live = (invitations ?? []).filter((invitation) =>
    invitation.status === "PENDING_SEND" || invitation.status === "SENT" || invitation.status === "VERIFIED",
  );

  return (
    <section className="admin-surface">
      <h3>{ar ? "دعوة الحساب" : "Invitation de compte"}</h3>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {message ? <div className="form-success" role="status"><strong>{message}</strong></div> : null}

      {invitations === null ? <p>{ar ? "جارٍ التحميل..." : "Chargement…"}</p> : null}
      {invitations && !invitations.length ? (
        <div className="admin-list">
          <article>
            <p>{ar ? "لا توجد دعوة لهذه الجهة بعد." : "Aucune invitation pour ce contact."}</p>
            <button className="btn btn-primary" onClick={create} disabled={Boolean(busy)}>
              {busy === "create" ? (ar ? "جارٍ الإنشاء..." : "Création…") : (ar ? "إنشاء دعوة" : "Créer une invitation")}
            </button>
          </article>
        </div>
      ) : null}

      {invitations && invitations.length ? (
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>{ar ? "الحالة" : "Statut"}</th>
                <th>{ar ? "النسخة" : "Version"}</th>
                <th>{ar ? "محاولات الإرسال" : "Envois"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "إجراءات" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((invitation) => (
                <tr key={invitation.id}>
                  <td>{invitation.status}</td>
                  <td>{invitation.tokenVersion}</td>
                  <td>{invitation.sendAttemptCount}</td>
                  <td>{formatDate(new Date(invitation.createdAt), locale)}</td>
                  <td>
                    <div className="admin-actions">
                      {invitation.status === "PENDING_SEND" ? (
                        <button className="btn btn-primary" onClick={() => run(`/api/admin/crm/invitations/${invitation.id}/send`, invitation.id)} disabled={Boolean(busy)}>
                          {busy === invitation.id ? (ar ? "جارٍ الإرسال..." : "Envoi…") : (ar ? "إرسال" : "Envoyer")}
                        </button>
                      ) : null}
                      {invitation.status === "SENT" ? (
                        <>
                          <button className="btn" onClick={() => run(`/api/admin/crm/invitations/${invitation.id}/resend`, invitation.id)} disabled={Boolean(busy)}>
                            {busy === invitation.id ? (ar ? "جارٍ الإرسال..." : "Envoi…") : (ar ? "إعادة إرسال" : "Renvoyer")}
                          </button>
                          <button className="btn btn-danger" onClick={() => run(`/api/admin/crm/invitations/${invitation.id}/revoke`, invitation.id)} disabled={Boolean(busy)}>
                            {ar ? "إلغاء" : "Révoquer"}
                          </button>
                        </>
                      ) : null}
                      {invitation.status === "VERIFIED" ? (
                        <button className="btn btn-danger" onClick={() => run(`/api/admin/crm/invitations/${invitation.id}/revoke`, invitation.id)} disabled={Boolean(busy)}>
                          {ar ? "إلغاء" : "Révoquer"}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {live.length === 0 && invitations && invitations.length > 0 ? (
        <p>{ar ? "جميع الدعوات منتهية أو ملغاة. يمكنك إنشاء دعوة جديدة." : "Toutes les invitations sont terminées ou révoquées. Vous pouvez en créer une nouvelle."}</p>
      ) : null}
    </section>
  );
}