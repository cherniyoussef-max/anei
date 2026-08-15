"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCrmStageForm({ organizationId, pipelineId, nextPosition, locale }: {
  organizationId: string; pipelineId: string; nextPosition: number; locale: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/crm/pipelines/${pipelineId}/stages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, name, position: nextPosition }),
    });
    setSaving(false);
    if (!res.ok) { setError(ar ? "فشل الإنشاء." : "Échec de la création."); return; }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
      <label>{ar ? "مرحلة جديدة" : "Nouvelle étape"}<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{ar ? "إضافة" : "Ajouter"}</button>
      {error ? <span className="admin-error">{error}</span> : null}
    </form>
  );
}
