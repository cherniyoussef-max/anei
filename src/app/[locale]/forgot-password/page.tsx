import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { PasswordRecoveryForm } from "@/components/interactive/PasswordRecoveryForm";
export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const ar=locale==="ar"; return <section className="auth-section"><div className="container auth-single"><div className="auth-card"><span className="eyebrow">{ar?"أمان الحساب":"Sécurité du compte"}</span><h1>{ar?"استرجاع كلمة المرور":"Mot de passe oublié"}</h1><p>{ar?"أدخل بريدك الإلكتروني وسنرسل لك رابطًا آمنًا.":"Saisissez votre email pour recevoir un lien sécurisé de réinitialisation."}</p><PasswordRecoveryForm locale={locale}/><div className="auth-switch"><Link href={`/${locale}/login`}>← {ar?"العودة لتسجيل الدخول":"Retour à la connexion"}</Link></div></div></div></section>; }
