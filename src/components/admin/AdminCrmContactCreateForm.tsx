"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCrmContactCreateForm({ organizationId, locale }: { organizationId: string; locale: string }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        firstName,
        lastName,
        email: email || null,
        phone: phone || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(ar ? "فشل إنشاء جهة الاتصال." : "Échec de la création du contact.");
      return;
    }
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel" style={{ marginBottom: 16 }}>
      <label><span>{ar ? "الاسم الأول" : "Prénom"}</span><input required value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
      <label><span>{ar ? "اسم العائلة" : "Nom"}</span><input required value={lastName} onChange={(e) => setLastName(e.target.value)} /></label>
      <label><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label><span>{ar ? "الهاتف" : "Téléphone"}</span><input value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "إضافة جهة اتصال" : "Ajouter un contact"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
    </form>
  );
}
