import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { getSession } from "@/server/auth/session";
import { InvitationClaimForm } from "@/components/interactive/InvitationClaimForm";

export const dynamic = "force-dynamic";

/**
 * Authenticated claim step. Requires a real session — an unauthenticated
 * visitor is sent to login with `next` pointing back here (the token survives
 * the round-trip through safeAppRedirect). After claiming, the user lands on
 * their STUDENT dashboard.
 */
export default async function InvitationClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) notFound();

  const current = await getSession();
  if (!current) {
    const next = `/${locale}/invitation/claim?token=${encodeURIComponent(token)}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }

  const ar = locale === "ar";
  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-intro">
          <span className="eyebrow">{ar ? "الربط النهائي" : "Liaison finale"}</span>
          <h1>{ar ? "اربط هذه الدعوة بحسابك" : "Associez cette invitation à votre compte"}</h1>
          <p>
            {ar
              ? "بعد ربط الحساب، ستتوصل بمساحة المتعلم الخاصة بك."
              : "Une fois lié, vous accédez à votre espace apprenant."}
          </p>
        </div>
        <div className="auth-card">
          <h2>{ar ? "تأكيد الربط" : "Confirmer la liaison"}</h2>
          <p>{ar ? "ستتم إضافة الصفة « طالب » إلى حسابك." : "La personne « Étudiant » sera ajoutée à votre compte."}</p>
          <InvitationClaimForm token={token} locale={locale} />
        </div>
      </div>
    </section>
  );
}