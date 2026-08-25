import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { ResetPasswordForm } from "@/components/interactive/ResetPasswordForm";
export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) { const { locale } = await params; if (!isLocale(locale)) notFound(); const ar=locale==="ar"; return <section className="auth-section"><div className="container auth-single"><div className="auth-card"><span className="eyebrow">{ar?"أمان الحساب":"Sécurité du compte"}</span><h1>{ar?"كلمة مرور جديدة":"Définir un nouveau mot de passe"}</h1><p>{ar?"اختر كلمة مرور قوية لا تستخدمها في مكان آخر.":"Choisissez un mot de passe robuste et unique."}</p><ResetPasswordForm locale={locale}/></div></div></section>; }
