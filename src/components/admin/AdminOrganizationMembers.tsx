"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = { id: string; userId: string; role: string; status: string };
const roles = ["OWNER", "MANAGER", "STAFF", "VIEWER"];

export function AdminOrganizationMembers({ organizationId, members, locale }: {
  organizationId: string; members: Member[]; locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("VIEWER");

  async function patch(membershipId: string, body: Record<string, unknown>) {
    setSaving(membershipId);
    setError(null);
    const res = await fetch(`/api/admin/organizations/${organizationId}/members/${membershipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error === "LAST_OWNER"
        ? (ar ? "لا يمكن ترك المؤسسة بدون مالك نشط." : "Impossible de laisser l’organisation sans propriétaire actif.")
        : (ar ? "فشلت العملية." : "Échec de l’opération."));
      return;
    }
    router.refresh();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setSaving("new");
    setError(null);
    const res = await fetch(`/api/admin/organizations/${organizationId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: newUserId, role: newRole }),
    });
    setSaving(null);
    if (!res.ok) {
      setError(ar ? "فشلت الإضافة." : "Échec de l’ajout.");
      return;
    }
    setNewUserId("");
    router.refresh();
  }

  return <div>
    <form onSubmit={addMember} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 16 }}>
      <label>{ar ? "معرف المستخدم" : "ID utilisateur"}<input required value={newUserId} onChange={(e) => setNewUserId(e.target.value)} /></label>
      <label>{ar ? "الدور" : "Rôle"}<select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select></label>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving === "new"}>{ar ? "إضافة عضو" : "Ajouter un membre"}</button>
    </form>
    {error ? <p className="admin-error">{error}</p> : null}
    <div className="admin-list">
      {members.filter((m) => m.status === "ACTIVE").map((m) => (
        <article key={m.id}>
          <div><strong>{m.userId}</strong></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={m.role} disabled={saving === m.id} onChange={(e) => patch(m.id, { role: e.target.value })}>
              {roles.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button type="button" className="btn btn-ghost btn-sm" disabled={saving === m.id} onClick={() => patch(m.id, { revoke: true })}>
              {ar ? "إلغاء" : "Révoquer"}
            </button>
          </div>
        </article>
      ))}
    </div>
  </div>;
}
