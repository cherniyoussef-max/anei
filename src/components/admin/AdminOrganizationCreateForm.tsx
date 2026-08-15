"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminOrganizationCreateForm({ locale }: { locale: string }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, ownerUserId }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(ar ? "فشل الإنشاء. تحقق من الحقول." : "Échec de la création. Vérifiez les champs.");
      return;
    }
    setName(""); setSlug(""); setOwnerUserId("");
    router.refresh();
  }

  return <form onSubmit={submit} className="admin-form" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
    <label>{ar ? "الاسم" : "Nom"}<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
    <label>{ar ? "المعرف" : "Slug"}<input required value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
    <label>{ar ? "معرف المالك (userId)" : "ID propriétaire (userId)"}<input required value={ownerUserId} onChange={(e) => setOwnerUserId(e.target.value)} /></label>
    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{ar ? "إنشاء" : "Créer"}</button>
    {error ? <span className="admin-error">{error}</span> : null}
  </form>;
}
