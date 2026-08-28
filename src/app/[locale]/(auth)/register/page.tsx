import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthForm } from "@/components/interactive/AuthForm";
import { env, googleAuthConfigured } from "@/server/env";
import { resolveOnboardingState, onboardingPathFor } from "@/server/auth/onboarding";

export const dynamic = "force-dynamic";
export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  const state = await resolveOnboardingState();
  if (state.state !== "UNAUTHENTICATED") redirect(onboardingPathFor(locale, state));
  const ar = locale === "ar";
  const en = locale === "en";
  return <section className="auth-section"><div className="container auth-grid"><div className="auth-intro register-intro"><span className="eyebrow">{ar ? "انضم إلى الأكاديمية" : en ? "Join the Academy" : "Rejoindre l’Académie"}</span><h1>{ar ? "مساحة واحدة لتكوينك ومواردك وشهاداتك" : en ? "Your courses, resources and certificates in one place" : "Un espace unique pour vos formations, ressources et certificats"}</h1><p>{ar ? "أنشئ حسابك واستفد من المسارات والندوات والمكتبة الرقمية." : en ? "Create an account to access learning pathways, webinars and the resource library." : "Créez votre compte pour accéder aux parcours, webinaires et à la librairie numérique."}</p><div className="register-stat"><strong>EN · AR</strong><span>{ar ? "واجهة ثنائية اللغة ومتجاوبة" : en ? "A bilingual, responsive experience" : "Expérience bilingue et responsive"}</span></div></div><div className="auth-card"><h2>{ar ? "إنشاء حساب" : en ? "Create your account" : "Créer un compte"}</h2><p>{ar ? "أنشئ ملفك الشخصي وابدأ التعلم." : en ? "Set up your profile and begin learning." : "Créez votre profil et commencez votre parcours."}</p><AuthForm locale={locale} mode="register" googleConfigured={googleAuthConfigured} googleClientId={googleAuthConfigured ? env.GOOGLE_CLIENT_ID : undefined} verificationRequired={env.AUTH_REQUIRE_EMAIL_VERIFICATION}/><div className="auth-switch">{ar ? "لديك حساب؟" : en ? "Already registered?" : "Déjà inscrit ?"} <Link href={`/${locale}/login`}>{ar ? "سجّل الدخول" : en ? "Sign in" : "Se connecter"}</Link></div></div></div></section>;
}
