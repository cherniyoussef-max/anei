"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminWhatsAppAccountForm({
  organizationId,
  locale,
  account,
}: {
  organizationId: string;
  locale: string;
  account: {
    phoneNumberId: string;
    businessAccountId: string;
    displayPhoneNumber: string | null;
    status: string;
  } | null;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const [phoneNumberId, setPhoneNumberId] = useState(account?.phoneNumberId ?? "");
  const [businessAccountId, setBusinessAccountId] = useState(account?.businessAccountId ?? "");
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState(account?.displayPhoneNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/crm/whatsapp/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        phoneNumberId,
        businessAccountId,
        displayPhoneNumber: displayPhoneNumber || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.status === 409 ? (ar ? "رقم الهاتف مستخدم من قبل منظمة أخرى." : "Ce numéro est déjà utilisé par une autre organisation.") : (ar ? "فشل حفظ الإعدادات." : "Échec de l’enregistrement."));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="admin-filter-panel">
      <label><span>{ar ? "معرّف رقم الهاتف" : "ID numéro de téléphone"}</span><input required value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="111222333444555" /></label>
      <label><span>{ar ? "معرّف حساب الأعمال" : "ID compte professionnel"}</span><input required value={businessAccountId} onChange={(e) => setBusinessAccountId(e.target.value)} placeholder="106661234567890" /></label>
      <label><span>{ar ? "رقم الهاتف المعروض" : "Numéro affiché"}</span><input value={displayPhoneNumber} onChange={(e) => setDisplayPhoneNumber(e.target.value)} placeholder="+216 20 123 456" /></label>
      <button className="admin-primary-button" disabled={saving}>{ar ? "حفظ" : "Enregistrer"}</button>
      {error ? <p className="admin-error">{error}</p> : null}
      {account ? <p className="admin-muted">{ar ? "الحالة:" : "Statut :"} {account.status}</p> : null}
    </form>
  );
}