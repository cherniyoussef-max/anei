import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { mockGateway, verifyMockToken } from "@/server/payments/mock";

export default async function MockPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || !mockGateway.isConfigured()) notFound();

  const { order = "", token = "" } = await searchParams;
  const valid = Boolean(order && token && verifyMockToken(order, token));
  const ar = locale === "ar";

  return (
    <section className="status-page">
      <div className="status-card pending">
        <div className="status-icon" aria-hidden="true">TND</div>
        <h1>{ar ? "محاكاة الدفع المحلية" : "Paiement local de développement"}</h1>
        <p>
          {ar
            ? "هذه الصفحة مخصصة لاختبارات التطوير فقط ولا تنفذ معاملة مالية حقيقية."
            : "Cette page est réservée aux tests de développement et ne réalise aucune transaction bancaire réelle."}
        </p>
        {valid ? (
          <form method="post" action="/api/payments/mock/complete">
            <input type="hidden" name="order" value={order} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="locale" value={locale} />
            <button className="btn btn-primary btn-lg" type="submit">
              {ar ? "تأكيد محاكاة الدفع" : "Confirmer le paiement simulé"}
            </button>
          </form>
        ) : (
          <p className="form-error" role="alert">{ar ? "رابط اختبار غير صالح." : "Lien de test invalide."}</p>
        )}
      </div>
    </section>
  );
}
