"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Membership = { persona: string; status: string; isPrimary: boolean };
const statuses = ["PENDING_REVIEW", "ACTIVE", "SUSPENDED", "REJECTED"];

export function AdminUserPersonas({ userId, memberships, canEdit }: {
  userId: string; memberships: Membership[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);

  async function patch(persona: string, body: Record<string, unknown>) {
    setSaving(persona);
    await fetch(`/api/admin/users/${userId}/personas`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ persona, ...body }),
    });
    setSaving(null);
    router.refresh();
  }

  if (!memberships.length) return <p className="admin-empty">Aucune persona.</p>;
  return <div className="admin-list">
    {memberships.map((m) => <article key={m.persona}>
      <div><strong>{m.persona}</strong>{m.isPrimary ? <small> · primary</small> : null}</div>
      {canEdit ? <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <select value={m.status} disabled={saving === m.persona} onChange={(e) => patch(m.persona, { status: e.target.value })}>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {!m.isPrimary ? <button type="button" className="btn btn-ghost btn-sm" disabled={saving === m.persona} onClick={() => patch(m.persona, { makePrimary: true })}>Set primary</button> : null}
      </div> : <span className={`table-status role-${m.status.toLowerCase()}`}>{m.status}</span>}
    </article>)}
  </div>;
}
