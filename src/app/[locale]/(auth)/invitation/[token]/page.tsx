import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { InvitationClaimFlow } from "@/components/interactive/InvitationClaimFlow";
import { AuthShowcase } from "@/components/auth/AuthShowcase";

export const dynamic = "force-dynamic";

/**
 * Public invitation landing page. The raw token travels only in this page's
 * own URL (same convention Better Auth's password-reset link already uses —
 * see sendResetEmail in src/server/auth/index.ts) and in POST bodies to the
 * public /api/invitation/* routes; it is never sent to any third-party
 * analytics/logging integration.
 */
export default async function InvitationPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !token || token.length < 16 || token.length > 512) notFound();

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <AuthShowcase locale={locale} mode="register" stage="verify" />
        <InvitationClaimFlow token={token} locale={locale} />
      </div>
    </section>
  );
}
