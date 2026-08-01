"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";
import type { PaymentProvider } from "@/server/payments/types";

export function CheckoutButton({ itemType, itemId, locale, capabilities, label }: {
  itemType: "course" | "resource";
  itemId: string;
  locale: Locale;
  capabilities: Array<{ provider: PaymentProvider; configured: boolean }>;
  label?: string;
}) {
  const router = useRouter();
  const ar = locale === "ar";
  const available = useMemo(() => capabilities.filter((item) => item.configured), [capabilities]);
  const preferred = available.find((item) => item.provider === "flouci")?.provider ?? available[0]?.provider ?? "mock";
  const [provider, setProvider] = useState<PaymentProvider>(preferred);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true); setError(null);
    const response = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ itemType, itemId, provider, locale }),
    });
    if (response.status === 401) {
      router.push(`/${locale}/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    const body = await response.json().catch(() => ({})) as { checkoutUrl?: string; error?: string };
    if (!response.ok || !body.checkoutUrl) { setError(body.error ?? "CHECKOUT_FAILED"); setLoading(false); return; }
    location.assign(body.checkoutUrl);
  }

  return <div className="checkout-box">
    <div className="payment-methods" role="group" aria-label={ar ? "طريقة الدفع" : "Mode de paiement"}>
      {capabilities.map(({ provider: value, configured }) => <button key={value} type="button" className={`payment-method ${provider === value ? "active" : ""}`} disabled={!configured || loading} onClick={() => setProvider(value)} title={!configured ? (ar ? "غير مهيأ" : "Non configuré") : undefined}>
        <span>{value === "flouci" ? "Flouci" : value === "clicktopay" ? "ClicToPay" : (ar ? "تجربة محلية" : "Démo locale")}</span>
        <small>{configured ? (value === "mock" ? (ar ? "للتطوير" : "développement") : (ar ? "متاح" : "disponible")) : (ar ? "يتطلب عقد التاجر" : "configuration requise")}</small>
      </button>)}
    </div>
    <button className="btn btn-primary btn-block" type="button" disabled={loading || available.length === 0} onClick={checkout}>{loading ? (ar ? "جارٍ التحويل..." : "Redirection sécurisée...") : label ?? (ar ? "شراء والوصول" : "Acheter et accéder")}</button>
    {error ? <small className="form-error">{ar ? "تعذر بدء الدفع. تحقق من إعدادات الدفع." : "Impossible d’initialiser le paiement. Vérifiez la configuration du fournisseur."}</small> : null}
  </div>;
}
