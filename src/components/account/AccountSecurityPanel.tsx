import Link from "next/link";
import type { Locale } from "@/types";
import { ChangePasswordForm } from "@/components/account/ProfileForm";
import { SessionManager } from "@/components/account/SessionManager";
import { ConnectedAccounts } from "@/components/account/ConnectedAccounts";
import { Icon } from "@/components/ui/Icon";

/**
 * Shared identity/contact/security block reused by every persona portal's
 * "Profil & sécurité" link. Deliberately omits the learner personal-info
 * form (education level, institution) — those fields are student-specific
 * and don't apply to PARENT/TEACHER/AVS/SPECIALIST/ORGANIZATION personas.
 */
export function AccountSecurityPanel({ locale, name, email, phoneNumber, phoneVerifiedAt, hasCredential, showIdentityAndContact = true }: {
  locale: Locale;
  name: string;
  email: string;
  phoneNumber: string | null | undefined;
  phoneVerifiedAt: Date | null | undefined;
  hasCredential: boolean;
  showIdentityAndContact?: boolean;
}) {
  const ar = locale === "ar";
  return <>
    {showIdentityAndContact ? <><section className="learner-profile-summary" aria-labelledby="identity-title"><span className="student-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span><div><h2 id="identity-title">{name}</h2><p dir="ltr">{email}</p><span><Icon name="shield" size={15} />{ar ? "جلسة موثقة" : "Session vérifiée"}</span></div></section>
    <section className="learner-settings-section" aria-labelledby="contact-title"><div className="learner-settings-heading"><h2 id="contact-title">{ar ? "بيانات الاتصال" : "Coordonnées"}</h2><p>{ar ? "هذه البيانات مرتبطة بوسائل التحقق من هويتك." : "Ces coordonnées sont liées aux mécanismes de vérification de votre identité."}</p></div><dl className="learner-contact-list"><div><dt>Email</dt><dd dir="ltr">{email}</dd></div><div><dt>{ar ? "الهاتف" : "Téléphone"}</dt><dd dir="ltr">{phoneNumber ?? (ar ? "غير مسجل" : "Non renseigné")}</dd></div><div><dt>{ar ? "حالة الهاتف" : "Vérification du téléphone"}</dt><dd>{phoneVerifiedAt ? (ar ? "موثق" : "Vérifié") : (ar ? "غير موثق" : "Non vérifié")}</dd></div></dl></section></> : null}
    <section className="learner-settings-section" aria-labelledby="security-title"><div className="learner-settings-heading"><h2 id="security-title">{ar ? "الأمان" : "Sécurité"}</h2><p>{ar ? "راجع طرق الدخول والجلسات النشطة دون كشف أي تفاصيل داخلية." : "Gérez les méthodes de connexion et les sessions actives sans exposer les données internes."}</p></div><div className="learner-security-grid"><article><h3>{ar ? "طرق تسجيل الدخول" : "Méthodes de connexion"}</h3><ConnectedAccounts locale={locale} /></article><article><h3>{ar ? "كلمة المرور" : "Mot de passe"}</h3>{hasCredential ? <ChangePasswordForm locale={locale} /> : <p className="small-muted">{ar ? "يستخدم هذا الحساب تسجيل الدخول الاجتماعي ولا يملك كلمة مرور محلية." : "Ce compte utilise une connexion sociale sans mot de passe local."}</p>}</article><article className="is-wide"><h3>{ar ? "الأجهزة والجلسات" : "Appareils et sessions"}</h3><SessionManager locale={locale} /></article></div></section>
    <section className="learner-settings-section learner-data-export"><div><h2>{ar ? "بياناتي" : "Mes données"}</h2><p>{ar ? "نزّل نسخة من بيانات الحساب والتعلم والشراء." : "Téléchargez une copie de vos données de compte, d’apprentissage et d’achat."}</p></div><Link className="student-secondary-action" href="/api/account/export" prefetch={false}><Icon name="download" size={17} />{ar ? "تصدير بياناتي" : "Exporter mes données"}</Link></section>
  </>;
}
