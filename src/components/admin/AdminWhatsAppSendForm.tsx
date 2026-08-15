"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildWhatsAppSendPayload } from "@/modules/whatsapp/domain/send-payload";

type Template = {
  id: string;
  name: string;
  language: string;
  status: string;
  parameterCount: number;
};

type Contact = { id: string; firstName: string; lastName: string; phone: string | null };

export function AdminWhatsAppSendForm({
  organizationId,
  locale,
  templates,
}: {
  organizationId: string;
  locale: string;
  templates: Template[];
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const approved = templates.filter((t) => t.status === "APPROVED");

  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [templateId, setTemplateId] = useState(approved[0]?.id ?? "");
  const [parameters, setParameters] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedTemplate = approved.find((t) => t.id === templateId);
  const paramCount = selectedTemplate?.parameterCount ?? 0;

  async function searchContacts(q: string) {
    setContactQuery(q);
    if (q.trim().length < 2) {
      setContacts([]);
      return;
    }
    const url = `/api/admin/crm/contacts?organizationId=${encodeURIComponent(organizationId)}&q=${encodeURIComponent(q.trim())}&pageSize=8`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { items: Contact[] };
      setContacts(data.items);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!contactId || !templateId) return;
    const built = buildWhatsAppSendPayload({
      organizationId,
      contactId,
      templateId,
      templateLanguage: selectedTemplate?.language,
      parameters,
    });
    if (!built.ok) {
      setError(ar ? "القالب غير صالح." : "Modèle invalide.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/crm/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.payload),
    });
    setSaving(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        body.error === "CONTACT_NOT_FOUND" ? (ar ? "جهة الاتصال غير موجودة." : "Contact introuvable.")
          : body.error === "CONTACT_NO_PHONE" ? (ar ? "لا يوجد رقم هاتف لهذه الجهة." : "Ce contact n’a pas de téléphone.")
          : body.error === "INVALID_TEMPLATE" ? (ar ? "القالب غير معتمد." : "Modèle non approuvé.")
          : body.error === "NO_ACCOUNT" ? (ar ? "لم يتم إعداد حساب واتساب." : "Compte WhatsApp non configuré.")
          : body.error === "PROVIDER_ERROR" ? (ar ? "فشل الإرسال عبر المزوّد." : "Échec d’envoi côté fournisseur.")
          : (ar ? "فشل الإرسال." : "Échec de l’envoi."),
      );
      return;
    }
    setNotice(ar ? "تم الإرسال." : "Message envoyé.");
    router.refresh();
  }

  const selectedContact = useMemo(() => contacts.find((c) => c.id === contactId), [contacts, contactId]);

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ flexDirection: "column", alignItems: "stretch", gap: 12 }}>
      <label><span>{ar ? "جهة الاتصال" : "Contact"}</span>
        <input
          list="admin-whatsapp-contacts"
          value={contactQuery}
          onChange={(e) => searchContacts(e.target.value)}
          placeholder={ar ? "ابحث عن جهة اتصال…" : "Rechercher un contact…"}
          autoComplete="off"
        />
        <datalist id="admin-whatsapp-contacts">
          {contacts.map((c) => (
            <option key={c.id} value={`${c.firstName} ${c.lastName}`} />
          ))}
        </datalist>
      </label>
      {contacts.length ? (
        <label><span>{ar ? "اختر جهة الاتصال" : "Choisir le contact"}</span>
          <select value={contactId} onChange={(e) => { setContactId(e.target.value); const c = contacts.find((x) => x.id === e.target.value); setContactQuery(c ? `${c.firstName} ${c.lastName}` : ""); }}>
            <option value="">{ar ? "— اختر —" : "— Choisir —"}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.phone ? ` (${c.phone})` : ""}</option>)}
          </select>
        </label>
      ) : null}
      {selectedContact ? <p className="admin-muted">{selectedContact.firstName} {selectedContact.lastName}</p> : null}

      <label><span>{ar ? "القالب" : "Modèle"}</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} disabled={!approved.length}>
          {approved.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
        </select>
      </label>

      {!approved.length ? <p className="admin-error">{ar ? "لا توجد قوالب معتمدة. قم بمزامنتها أولاً." : "Aucun modèle approuvé. Synchronisez d’abord."}</p> : null}

      {paramCount > 0 ? (
        <div className="admin-list" style={{ padding: 0 }}>
          {Array.from({ length: paramCount }, (_, i) => (
            <label key={i}><span>{ar ? `معامل ${i + 1}` : `Paramètre ${i + 1}`}</span>
              <input value={parameters[i] ?? ""} onChange={(e) => { const next = [...parameters]; next[i] = e.target.value; setParameters(next); }} />
            </label>
          ))}
        </div>
      ) : null}

      <button className="admin-primary-button" disabled={saving || !contactId || !templateId || !approved.length}>
        {ar ? "إرسال" : "Envoyer"}
      </button>
      {error ? <p className="admin-error">{error}</p> : null}
      {notice ? <p className="admin-muted">{notice}</p> : null}
    </form>
  );
}