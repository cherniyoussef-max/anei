import { ShieldCheck, UserCheck } from "lucide-react";
import type { Locale } from "@/types";
import { AccountSecurityPanel } from "@/components/account/AccountSecurityPanel";

export type ProfessionalProfileFact = {
  label: string;
  value: string | number | null | undefined;
  direction?: "ltr" | "rtl";
};

export function ProfessionalProfilePage({
  locale,
  roleLabel,
  name,
  email,
  phoneNumber,
  phoneVerifiedAt,
  country,
  governorate,
  city,
  professionalTitle,
  professionalFacts,
  hasCredential,
}: {
  locale: Locale;
  roleLabel: string;
  name: string;
  email: string;
  phoneNumber?: string | null;
  phoneVerifiedAt?: Date | null;
  country?: string | null;
  governorate?: string | null;
  city?: string | null;
  professionalTitle: string;
  professionalFacts: ProfessionalProfileFact[];
  hasCredential: boolean;
}) {
  const ar = locale === "ar";
  const facts = professionalFacts.filter((fact) => fact.value !== null && fact.value !== undefined && fact.value !== "");
  const location = [city, governorate, country].filter(Boolean).join(ar ? "، " : ", ");

  return <div className="professional-profile-page">
    <header className="professional-profile-header">
      <div>
        <p>{roleLabel}</p>
        <h1>{ar ? "ملفي الشخصي والأمان" : "Mon profil et ma sécurité"}</h1>
        <span>{ar ? "راجع هويتك المهنية وبيانات الاتصال وحماية حسابك." : "Retrouvez votre identité professionnelle, vos coordonnées et la protection du compte."}</span>
      </div>
      <span className="professional-profile-status"><ShieldCheck size={16} strokeWidth={1.75}/>{ar ? "ملف نشط" : "Profil actif"}</span>
    </header>

    <section className="professional-identity" aria-labelledby="professional-identity-title">
      <span className="professional-avatar" aria-hidden="true">{name.trim().charAt(0).toLocaleUpperCase(locale)}</span>
      <div>
        <h2 id="professional-identity-title">{name}</h2>
        <p dir="ltr">{email}</p>
      </div>
      <dl>
        <div><dt>{ar ? "الهاتف" : "Téléphone"}</dt><dd dir="ltr">{phoneNumber || (ar ? "غير مسجل" : "Non renseigné")}</dd></div>
        <div><dt>{ar ? "الموقع" : "Localisation"}</dt><dd>{location || (ar ? "غير مسجل" : "Non renseignée")}</dd></div>
        <div><dt>{ar ? "التحقق" : "Vérification"}</dt><dd>{phoneVerifiedAt ? (ar ? "الهاتف موثّق" : "Téléphone vérifié") : (ar ? "البريد موثّق" : "Email vérifié")}</dd></div>
      </dl>
    </section>

    <section className="professional-details" aria-labelledby="professional-details-title">
      <div className="professional-section-heading">
        <h2 id="professional-details-title">{professionalTitle}</h2>
        <p>{ar ? "المعلومات المقدّمة أثناء إنشاء الملف المهني." : "Informations enregistrées lors de la création du profil professionnel."}</p>
      </div>
      {facts.length ? <dl className="professional-fact-list">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd dir={fact.direction}>{fact.value}</dd></div>)}</dl> : <div className="professional-empty-state"><UserCheck size={22} strokeWidth={1.75}/><div><strong>{ar ? "لا توجد تفاصيل مهنية إضافية" : "Aucun détail professionnel supplémentaire"}</strong><p>{ar ? "بيانات الهوية والاتصال محفوظة، ولا توجد حقول إضافية مطلوبة لهذا الملف." : "L’identité et les coordonnées sont enregistrées ; aucun autre champ n’est requis pour ce profil."}</p></div></div>}
    </section>

    <AccountSecurityPanel locale={locale} name={name} email={email} phoneNumber={phoneNumber} phoneVerifiedAt={phoneVerifiedAt} hasCredential={hasCredential} showIdentityAndContact={false}/>
  </div>;
}
