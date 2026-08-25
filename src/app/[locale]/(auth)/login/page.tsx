import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { AuthForm } from "@/components/interactive/AuthForm";
import { Icon } from "@/components/ui/Icon";
import { env, googleAuthConfigured } from "@/server/env";
import { getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params; if (!isLocale(locale)) notFound();
  if (await getSession()) redirect(`/${locale}/dashboard`);
  const ar = locale === "ar";
  const en = locale === "en";
  return <section className="auth-section"><div className="container auth-grid"><div className="auth-intro"><span className="eyebrow">{ar ? "مرحبًا بعودتك" : en ? "Welcome back" : "Bienvenue"}</span><h1>{ar ? "تابع تعلّمك من حيث توقفت" : en ? "Continue learning where you left off" : "Reprenez votre progression là où vous l’avez laissée"}</h1><p>{ar ? "ادخل إلى دوراتك ووثائقك وندواتك وشهاداتك في مساحة واحدة." : en ? "Access your courses, resources, webinars and certificates in one focused space." : "Retrouvez vos formations, documents, webinaires, replays et certificats dans un seul espace."}</p><div className="auth-points"><span><Icon name="play" size={18}/>{ar ? "فيديوهات ودروس" : en ? "Videos and lessons" : "Vidéos & cours"}</span><span><Icon name="download" size={18}/>{ar ? "موارد وشهادات" : en ? "Resources and certificates" : "Ressources & certificats"}</span><span><Icon name="chart" size={18}/>{ar ? "تتبع التقدم" : en ? "Progress tracking" : "Suivi de progression"}</span></div></div><div className="auth-card"><h2>{ar ? "مرحبًا بعودتك" : en ? "Sign in to ANEI" : "Bon retour parmi nous"}</h2><p>{ar ? "استخدم حسابك للوصول إلى مساحة المتعلم." : en ? "Use your account to access your learning space." : "Accédez à votre espace apprenant."}</p><AuthForm locale={locale} mode="login" googleConfigured={googleAuthConfigured} googleClientId={googleAuthConfigured ? env.GOOGLE_CLIENT_ID : undefined} verificationRequired={env.AUTH_REQUIRE_EMAIL_VERIFICATION}/><div className="auth-switch">{ar ? "ليس لديك حساب؟" : en ? "New to ANEI?" : "Pas encore de compte ?"} <Link href={`/${locale}/register`}>{ar ? "أنشئ حسابًا" : en ? "Create an account" : "Créer un compte"}</Link></div></div></div></section>;
}
