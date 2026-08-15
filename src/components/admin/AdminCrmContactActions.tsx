"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = { id: string; name: string };
type Member = { userId: string; role: string };
type Tag = { id: string; name: string };

export function AdminCrmContactActions({
  organizationId,
  contactId,
  status,
  linkedUserId,
  assignedToUserId,
  currentStageId,
  stages,
  members,
  tags,
  contactTags,
  locale,
}: {
  organizationId: string;
  contactId: string;
  status: string;
  linkedUserId: string | null;
  assignedToUserId: string | null;
  currentStageId: string | null;
  stages: Stage[];
  members: Member[];
  tags: Tag[];
  contactTags: Tag[];
  locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkUserId, setLinkUserId] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [selectedTag, setSelectedTag] = useState(tags[0]?.id ?? "");

  async function call(url: string, method: string, body: Record<string, unknown>, key: string) {
    setSaving(key);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(null);
    if (!res.ok) {
      setError(ar ? "فشلت العملية." : "Échec de l’opération.");
      return false;
    }
    router.refresh();
    return true;
  }

  const attachedTagIds = new Set(contactTags.map((t) => t.id));
  const availableTags = tags.filter((t) => !attachedTagIds.has(t.id));

  return (
    <div className="admin-list">
      <article>
        <div><strong>{ar ? "الحالة" : "Statut"}</strong><small>{status}</small></div>
        <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "status"}
          onClick={() => call(`/api/admin/crm/contacts/${contactId}/${status === "ACTIVE" ? "archive" : "restore"}`, "POST", { organizationId }, "status")}>
          {status === "ACTIVE" ? (ar ? "أرشفة" : "Archiver") : (ar ? "استعادة" : "Restaurer")}
        </button>
      </article>

      <article>
        <div><strong>{ar ? "المسؤول" : "Assigné à"}</strong></div>
        <select defaultValue={assignedToUserId ?? ""} disabled={saving === "assign"}
          onChange={(e) => call(`/api/admin/crm/contacts/${contactId}/assign`, "POST", { organizationId, assignedToUserId: e.target.value || null }, "assign")}>
          <option value="">{ar ? "بدون" : "Non assigné"}</option>
          {members.map((m) => <option key={m.userId} value={m.userId}>{m.userId} ({m.role})</option>)}
        </select>
      </article>

      <article>
        <div><strong>{ar ? "مرحلة المسار" : "Étape du pipeline"}</strong></div>
        <select defaultValue={currentStageId ?? ""} disabled={saving === "stage" || !stages.length}
          onChange={(e) => e.target.value && call(`/api/admin/crm/contacts/${contactId}/stage`, "POST", { organizationId, stageId: e.target.value }, "stage")}>
          <option value="">{ar ? "بدون مرحلة" : "Aucune étape"}</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </article>

      <article>
        <div><strong>{ar ? "الحساب المرتبط" : "Compte lié"}</strong><small>{linkedUserId ?? (ar ? "غير مرتبط" : "Non lié")}</small></div>
        {linkedUserId ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving === "link"}
            onClick={() => call(`/api/admin/crm/contacts/${contactId}/link`, "DELETE", { organizationId }, "link")}>
            {ar ? "إلغاء الربط" : "Délier"}
          </button>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); call(`/api/admin/crm/contacts/${contactId}/link`, "POST", { organizationId, linkedUserId: linkUserId }, "link").then((ok) => ok && setLinkUserId("")); }}
            style={{ display: "flex", gap: 8 }}>
            <input required placeholder={ar ? "معرف المستخدم" : "ID utilisateur"} value={linkUserId} onChange={(e) => setLinkUserId(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving === "link"}>{ar ? "ربط" : "Lier"}</button>
          </form>
        )}
      </article>

      <article>
        <div><strong>{ar ? "الوسوم" : "Tags"}</strong></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {contactTags.map((t) => (
            <span key={t.id} className="admin-provider">
              {t.name}{" "}
              <button type="button" className="btn btn-ghost btn-sm" disabled={saving === `detag-${t.id}`}
                onClick={() => call(`/api/admin/crm/contacts/${contactId}/tags/${t.id}`, "DELETE", { organizationId }, `detag-${t.id}`)}>
                ×
              </button>
            </span>
          ))}
        </div>
        {availableTags.length ? (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)}>
              {availableTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={saving === "tag" || !selectedTag}
              onClick={() => call(`/api/admin/crm/contacts/${contactId}/tags`, "POST", { organizationId, tagId: selectedTag }, "tag")}>
              {ar ? "إضافة" : "Ajouter"}
            </button>
          </div>
        ) : null}
      </article>

      <article>
        <div><strong>{ar ? "ملاحظة جديدة" : "Nouvelle note"}</strong></div>
        <form onSubmit={(e) => { e.preventDefault(); call(`/api/admin/crm/contacts/${contactId}/notes`, "POST", { organizationId, body: noteBody }, "note").then((ok) => ok && setNoteBody("")); }}>
          <textarea required value={noteBody} onChange={(e) => setNoteBody(e.target.value)} rows={3} style={{ width: "100%" }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving === "note"}>{ar ? "إضافة ملاحظة" : "Ajouter la note"}</button>
        </form>
      </article>

      {error ? <p className="admin-error">{error}</p> : null}
    </div>
  );
}
