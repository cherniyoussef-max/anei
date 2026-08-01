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
  return <section className="auth-section"><div className="container auth-grid"><div className="auth-intro"><span className="eyebrow">{ar ? "مرحبًا بعودتك" : "Bienvenue"}</span><h1>{ar ? "تابع تعلّمك من حيث توقفت" : "Reprenez votre progression là où vous l’avez laissée"}</h1><p>{ar ? "ادخل إلى دوراتك ووثائقك وندواتك وشهاداتك في مساحة واحدة." : "Retrouvez vos formations, documents, webinaires, replays et certificats dans un seul espace."}</p><div className="auth-points"><span><Icon name="play" size={18}/>{ar ? "فيديوهات ودروس" : "Vidéos & cours"}</span><span><Icon name="download" size={18}/>{ar ? "موارد وشهادات" : "Ressources & certificats"}</span><span><Icon name="chart" size={18}/>{ar ? "تتبع التقدم" : "Suivi de progression"}</span></div></div><div className="auth-card"><h2>{ar ? "مرحبًا بعودتك" : "Bon retour parmi nous"}</h2><p>{ar ? "استخدم حسابك للوصول إلى مساحة المتعلم." : "Accédez à votre espace apprenant."}</p><AuthForm locale={locale} mode="login" googleConfigured={googleAuthConfigured} googleClientId={googleAuthConfigured ? env.GOOGLE_CLIENT_ID : undefined} verificationRequired={env.AUTH_REQUIRE_EMAIL_VERIFICATION}/><div className="auth-switch">{ar ? "ليس لديك حساب؟" : "Pas encore de compte ?"} <Link href={`/${locale}/register`}>{ar ? "أنشئ حسابًا" : "Créer un compte"}</Link></div></div></div></section>;
}
