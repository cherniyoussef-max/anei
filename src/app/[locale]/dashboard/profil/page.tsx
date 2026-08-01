import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ProfileForm, ChangePasswordForm } from "@/components/account/ProfileForm";
import { SessionManager } from "@/components/account/SessionManager";
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const credential = await db.query.account.findFirst({
    where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")),
  });

  return <section className="account-settings"><div className="container settings-shell">
    <Link className="back-link" href={`/${locale}/dashboard`}>← {ar ? "مساحتي" : "Mon espace"}</Link>
    <div className="settings-head"><span className="eyebrow">{ar ? "الحساب" : "Compte"}</span><h1>{ar ? "الملف والأمان" : "Profil & sécurité"}</h1><p>{session.user.email}</p></div>
    <div className="settings-grid">
      <article className="settings-card"><h2>{ar ? "الملف الشخصي" : "Profil"}</h2><ProfileForm locale={locale} name={session.user.name} image={session.user.image}/></article>
      <article className="settings-card"><h2>{ar ? "كلمة المرور" : "Mot de passe"}</h2>{credential ? <><p className="small-muted">{ar ? "سيؤدي تغيير كلمة المرور إلى إغلاق الجلسات الأخرى." : "Le changement de mot de passe révoque les autres sessions."}</p><ChangePasswordForm locale={locale}/></> : <div className="empty-panel"><p>{ar ? "هذا الحساب يستخدم تسجيل الدخول الاجتماعي. لا توجد كلمة مرور محلية لتغييرها." : "Ce compte utilise une connexion sociale. Aucun mot de passe local n’est associé à ce compte."}</p></div>}</article>
      <article className="settings-card"><h2>{ar ? "طرق تسجيل الدخول" : "Méthodes de connexion"}</h2><ConnectedAccounts locale={locale}/></article>
      <article className="settings-card settings-card-wide"><h2>{ar ? "الأجهزة والجلسات" : "Appareils & sessions"}</h2><SessionManager locale={locale}/></article>
      <article className="settings-card settings-card-wide"><h2>{ar ? "بياناتي" : "Mes données"}</h2><p className="small-muted">{ar ? "نزّل نسخة من بيانات الحساب والتعلّم والتسجيلات المرتبطة بك." : "Téléchargez une copie de vos données de compte, apprentissage, achats et inscriptions."}</p><Link className="btn btn-secondary" href="/api/account/export" prefetch={false}>{ar ? "تصدير بياناتي" : "Exporter mes données"}</Link></article>
    </div>
  </div></section>;
}
