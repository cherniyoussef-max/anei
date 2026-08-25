import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { env } from "@/server/env";

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const ar = locale === "ar";
  const en = locale === "en";
  return <section className="section"><article className="container article-shell">
    <span className="eyebrow">{ar ? "البيانات" : en ? "Personal data" : "Données personnelles"}</span>
    <h1>{ar ? "سياسة الخصوصية" : en ? "Privacy policy" : "Politique de confidentialité"}</h1>
    <p className="article-lead">{ar ? "توضح هذه الصفحة مبادئ المنصة بشأن جمع البيانات واستخدامها وحمايتها." : en ? "This page explains how the platform collects, uses and protects personal data." : "Cette page présente les principes de la plateforme concernant la collecte, l’utilisation et la protection des données."}</p>
    <h2>{ar ? "البيانات المستخدمة" : en ? "Data we use" : "Données utilisées"}</h2>
    <p>{ar ? "تُستخدم بيانات الحساب والتسجيل والمشتريات والتقدم لتقديم الخدمة وتأمين الوصول. لا ينبغي جمع بيانات غير ضرورية." : en ? "Account, registration, purchase and learning-progress data is used to provide the service and secure access. Unnecessary data should not be collected." : "Les données de compte, d’inscription, d’achat et de progression sont utilisées pour fournir le service et sécuriser les accès. Les données inutiles ne doivent pas être collectées."}</p>
    <h2>{ar ? "الأمان والاحتفاظ" : en ? "Security and retention" : "Sécurité et conservation"}</h2>
    <p>{ar ? "تطبق المنصة ضوابط وصول وتسجيلًا أمنيًا ونسخًا احتياطية. يجب اعتماد مدد الاحتفاظ النهائية بعد المراجعة القانونية قبل الإطلاق." : en ? "The platform uses access controls, security logging and backups. Final retention periods must be approved through legal review before launch." : "La plateforme applique des contrôles d’accès, une journalisation de sécurité et des sauvegardes. Les durées définitives de conservation doivent être validées juridiquement avant lancement."}</p>
    <h2>{ar ? "التواصل" : en ? "Contact" : "Contact"}</h2><p>{env.CONTACT_EMAIL}</p>
    <p className="small-muted">{ar ? "يجب مراجعة هذه السياسة من قبل المستشار القانوني للأكاديمية قبل الإنتاج." : en ? "ANEI’s legal counsel must review this policy before production launch." : "Cette politique doit être revue par le conseil juridique de l’Académie avant mise en production."}</p>
  </article></section>;
}
