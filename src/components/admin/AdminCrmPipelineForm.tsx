"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCrmPipelineForm({ organizationId, locale }: { organizationId: string; locale: string }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, name }),
    });
    setSaving(false);
    if (!res.ok) { setError(ar ? "فشل الإنشاء." : "Échec de la création."); return; }
    setName("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel">
      <label><span>{ar ? "اسم المسار" : "Nom du pipeline"}</span><input required value={name} onChange={(e) => setName(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "إنشاء مسار" : "Créer un pipeline"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}
