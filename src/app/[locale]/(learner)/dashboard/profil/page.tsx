import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { requireUser } from "@/server/auth/session";
import { getUserProfile } from "@/server/auth/profile";
import { db } from "@/server/db";
import { account } from "@/server/db/schema";
import { ChangePasswordForm } from "@/components/account/ProfileForm";
import { SessionManager } from "@/components/account/SessionManager";
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts";
import { LearnerProfileForm } from "@/components/student/LearnerProfileForm";
import { LearnerPageHeader } from "@/components/student/LearnerPages";
import { Icon } from "@/components/ui/Icon";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireUser(locale);
  const ar = locale === "ar";
  const [credential, profile] = await Promise.all([
    db.query.account.findFirst({ where: and(eq(account.userId, session.user.id), eq(account.providerId, "credential")) }),
    getUserProfile(session.user.id),
  ]);

  return <div className="learner-page learner-profile-page"><LearnerPageHeader title={ar ? "الملف الشخصي والأمان" : "Profil et sécurité"} description={ar ? "حدّث معلومات التعلم وراجع وسائل الاتصال وأمان حسابك." : "Mettez à jour votre profil d’apprentissage et contrôlez la sécurité du compte."} />
    <section className="learner-profile-summary" aria-labelledby="identity-title"><span className="student-avatar" aria-hidden="true">{session.user.name.trim().charAt(0).toUpperCase()}</span><div><h2 id="identity-title">{session.user.name}</h2><p dir="ltr">{session.user.email}</p><span><Icon name="shield" size={15} />{ar ? "جلسة موثقة" : "Session vérifiée"}</span></div></section>
    {profile ? <section className="learner-settings-section" aria-labelledby="personal-title"><div className="learner-settings-heading"><h2 id="personal-title">{ar ? "المعلومات الشخصية والتعلم" : "Informations personnelles et apprentissage"}</h2><p>{ar ? "يمكن تعديل الحقول العادية فقط. تغيير الهاتف أو البريد يتطلب مسار تحقق مخصصًا." : "Seuls les champs ordinaires sont modifiables ici. Le téléphone et l’email utilisent un parcours de vérification dédié."}</p></div><LearnerProfileForm locale={locale} values={{ firstName: profile.firstName, lastName: profile.lastName, country: profile.country ?? "Tunisie", governorate: profile.governorate ?? "Tunis", city: profile.city ?? "", preferredLocale: profile.preferredLocale, educationLevel: profile.educationLevel ?? "", institutionName: profile.institutionName ?? "" }} /></section> : null}
    <section className="learner-settings-section" aria-labelledby="contact-title"><div className="learner-settings-heading"><h2 id="contact-title">{ar ? "بيانات الاتصال" : "Coordonnées"}</h2><p>{ar ? "هذه البيانات مرتبطة بوسائل التحقق من هويتك." : "Ces coordonnées sont liées aux mécanismes de vérification de votre identité."}</p></div><dl className="learner-contact-list"><div><dt>Email</dt><dd dir="ltr">{session.user.email}</dd></div><div><dt>{ar ? "الهاتف" : "Téléphone"}</dt><dd dir="ltr">{profile?.phoneNumber ?? (ar ? "غير مسجل" : "Non renseigné")}</dd></div><div><dt>{ar ? "حالة الهاتف" : "Vérification du téléphone"}</dt><dd>{profile?.phoneVerifiedAt ? (ar ? "موثق" : "Vérifié") : (ar ? "غير موثق" : "Non vérifié")}</dd></div></dl></section>
    <section className="learner-settings-section" aria-labelledby="security-title"><div className="learner-settings-heading"><h2 id="security-title">{ar ? "الأمان" : "Sécurité"}</h2><p>{ar ? "راجع طرق الدخول والجلسات النشطة دون كشف أي تفاصيل داخلية." : "Gérez les méthodes de connexion et les sessions actives sans exposer les données internes."}</p></div><div className="learner-security-grid"><article><h3>{ar ? "طرق تسجيل الدخول" : "Méthodes de connexion"}</h3><ConnectedAccounts locale={locale} /></article><article><h3>{ar ? "كلمة المرور" : "Mot de passe"}</h3>{credential ? <ChangePasswordForm locale={locale} /> : <p className="small-muted">{ar ? "يستخدم هذا الحساب تسجيل الدخول الاجتماعي ولا يملك كلمة مرور محلية." : "Ce compte utilise une connexion sociale sans mot de passe local."}</p>}</article><article className="is-wide"><h3>{ar ? "الأجهزة والجلسات" : "Appareils et sessions"}</h3><SessionManager locale={locale} /></article></div></section>
    <section className="learner-settings-section learner-data-export"><div><h2>{ar ? "بياناتي" : "Mes données"}</h2><p>{ar ? "نزّل نسخة من بيانات الحساب والتعلم والشراء." : "Téléchargez une copie de vos données de compte, d’apprentissage et d’achat."}</p></div><Link className="student-secondary-action" href="/api/account/export" prefetch={false}><Icon name="download" size={17} />{ar ? "تصدير بياناتي" : "Exporter mes données"}</Link></section>
  </div>;
}
