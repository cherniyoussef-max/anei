"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";
import { safeAppRedirect } from "@/lib/security/safe-redirect";
import { googleAuthErrorMessage } from "@/lib/auth-errors";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { Icon, type IconName } from "@/components/ui/Icon";

type ProfileType = "teacher" | "avs" | "parent" | "specialist" | "institution" | "learner";
const PROFILE_TYPES: ProfileType[] = ["learner", "parent", "teacher", "avs", "specialist", "institution"];
const PROFILE_ICON: Record<ProfileType, IconName> = { learner: "graduation", parent: "users", teacher: "book", avs: "shield", specialist: "spark", institution: "map" };
const PROFILE_LABEL: Record<ProfileType, { fr: string; ar: string; en: string }> = {
  learner: { fr: "Étudiant(e) / apprenant(e)", ar: "طالب / متعلم", en: "Student / learner" },
  parent: { fr: "Parent", ar: "ولي", en: "Parent" },
  teacher: { fr: "Enseignant(e)", ar: "مدرس(ة)", en: "Educator" },
  avs: { fr: "AVS", ar: "AVS", en: "AVS" },
  specialist: { fr: "Spécialiste", ar: "مختص", en: "Specialist" },
  institution: { fr: "Établissement / association", ar: "مؤسسة", en: "School / organization" },
};
const PROFILE_DESCRIPTION: Record<ProfileType, { fr: string; ar: string; en: string }> = {
  learner: { fr: "Suivez vos cours et vos évaluations.", ar: "تابع دروسك وتقييماتك.", en: "Follow your courses and assessments." },
  parent: { fr: "Suivez la progression de vos enfants.", ar: "تابع تقدم أبنائك.", en: "Follow your children's progress." },
  teacher: { fr: "Formez-vous et partagez vos pratiques.", ar: "كوّن نفسك وشارك ممارساتك.", en: "Train and share your practice." },
  avs: { fr: "Accompagnement scolaire spécialisé.", ar: "مرافقة مدرسية مختصة.", en: "Specialized school support." },
  specialist: { fr: "Ressources et outils spécialisés.", ar: "موارد وأدوات متخصصة.", en: "Specialized resources and tools." },
  institution: { fr: "Convention de partenariat pour vos équipes.", ar: "اتفاقية شراكة لفريقك.", en: "Partnership agreement for your teams." },
};

function isProfileType(value: string | null): value is ProfileType {
  return !!value && (PROFILE_TYPES as string[]).includes(value);
}

export function AuthForm({ locale, mode, googleConfigured, verificationRequired = false }: { locale: Locale; mode: "login" | "register"; googleConfigured: boolean; googleClientId?: string; verificationRequired?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => googleAuthErrorMessage(locale, search.get("error")));
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [profileType, setProfileType] = useState<ProfileType>(() => {
    const requested = search.get("role");
    return isProfileType(requested) ? requested : "teacher";
  });
  const ar = locale === "ar";
  const en = locale === "en";
  const destination = safeAppRedirect(search.get("next"), locale);
  const assuranceDestination = `/${locale}/verification-channel?next=${encodeURIComponent(destination)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password, callbackURL: assuranceDestination });
        if (result.error) throw new Error(result.error.message || "AUTH_ERROR");
      } else {
        const name = String(form.get("name") ?? "").trim();
        const referredByCode = search.get("ref")?.trim().slice(0, 16) || undefined;
        const result = await authClient.signUp.email({ name, email, password, locale: locale === "en" ? "fr" : locale, profileType, referredByCode, callbackURL: assuranceDestination });
        if (result.error) throw new Error(result.error.message || "AUTH_ERROR");
      }
      if (mode === "register" && verificationRequired) {
        setRegistered(true);
        setLoading(false);
        return;
      }
      router.push(assuranceDestination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ar ? "تعذر إتمام العملية" : en ? "The operation could not be completed" : "Impossible de terminer l’opération");
      setLoading(false);
    }
  }

  async function google() {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError(null);
    try {
      const errorCallbackURL = `/${locale}/login?${new URLSearchParams({
        error: "google_auth_failed",
        next: destination,
      })}`;
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: assuranceDestination,
        errorCallbackURL,
      });
      if (result?.error) throw new Error(result.error.message || "GOOGLE_AUTH_ERROR");
    } catch {
      setError(googleAuthErrorMessage(locale, "google_auth_failed"));
      setGoogleLoading(false);
    }
  }

  if (registered) return <div className="form-success" role="status"><strong>{ar ? "تحقق من بريدك الإلكتروني" : en ? "Check your email" : "Vérifiez votre adresse e-mail"}</strong><p>{ar ? "تم إنشاء الحساب. افتح رابط التحقق المرسل إلى بريدك قبل تسجيل الدخول." : en ? "Your account is ready. Open the verification link sent by email before signing in." : "Votre compte est créé. Ouvrez le lien de vérification envoyé par e-mail avant de vous connecter."}</p></div>;

  return (
    <form className="auth-form" onSubmit={submit} aria-busy={loading || googleLoading}>
      <>
        {null}
        <button
          className="btn btn-google btn-block"
          type="button"
          onClick={google}
          disabled={!googleConfigured || loading || googleLoading}
          data-testid="google-sign-in"
          aria-label={ar ? "المتابعة باستخدام Google" : en ? "Continue with Google" : "Continuer avec Google"}
          aria-describedby={!googleConfigured ? "google-auth-availability" : undefined}
        >
          {googleLoading ? <span className="button-spinner" aria-hidden="true"/> : <GoogleMark/>}
          {googleLoading ? (ar ? "جارٍ فتح Google..." : en ? "Opening Google…" : "Ouverture de Google…") : (ar ? "المتابعة باستخدام Google" : en ? "Continue with Google" : "Continuer avec Google")}
        </button>
        {!googleConfigured ? <p className="google-unavailable" id="google-auth-availability" role="status">
          {ar ? "سيصبح تسجيل الدخول عبر Google متاحًا بعد إعداد بيانات الاعتماد." : en ? "Google sign-in will be available after credentials are configured." : "La connexion Google sera disponible après configuration des identifiants."}
        </p> : null}
        <div className="form-divider"><span>{ar ? "أو" : en ? "or" : "ou"}</span></div>
      </>
      {mode === "register" ? <label><span>{ar ? "الاسم الكامل" : en ? "Full name" : "Nom complet"}</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder={ar ? "الاسم واللقب" : en ? "First and last name" : "Nom et prénom"}/></label> : null}
      <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label>
      <label><span>{ar ? "كلمة المرور" : en ? "Password" : "Mot de passe"}</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={10}/>{mode === "register" ? <small>{ar ? "10 أحرف على الأقل." : en ? "At least 10 characters." : "10 caractères minimum."}</small> : null}</label>
      {mode === "register" ? <div className="auth-persona-field">
        <span>{ar ? "الصفة" : en ? "Your role" : "Votre profil"}</span>
        <input type="hidden" name="profileType" value={profileType} />
        <div className="auth-persona-grid" role="radiogroup" aria-label={ar ? "الصفة" : en ? "Your role" : "Votre profil"}>
          {PROFILE_TYPES.map((type) => (
            <button
              type="button"
              key={type}
              role="radio"
              aria-checked={profileType === type}
              className={profileType === type ? "auth-persona-card is-selected" : "auth-persona-card"}
              onClick={() => setProfileType(type)}
            >
              <span className="auth-persona-icon"><Icon name={PROFILE_ICON[type]} size={20} /></span>
              <strong>{ar ? PROFILE_LABEL[type].ar : en ? PROFILE_LABEL[type].en : PROFILE_LABEL[type].fr}</strong>
              <small>{ar ? PROFILE_DESCRIPTION[type].ar : en ? PROFILE_DESCRIPTION[type].en : PROFILE_DESCRIPTION[type].fr}</small>
            </button>
          ))}
        </div>
      </div> : null}
      {mode === "login" ? <div className="auth-inline auth-inline-end"><Link href={`/${locale}/forgot-password`}>{ar ? "نسيت كلمة المرور؟" : en ? "Forgot your password?" : "Mot de passe oublié ?"}</Link></div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary btn-block" disabled={loading || googleLoading} type="submit">{loading ? (ar ? "جارٍ المعالجة..." : en ? "Processing..." : "Traitement...") : mode === "login" ? (ar ? "الدخول إلى مساحتي" : en ? "Open my learning space" : "Accéder à mon espace") : (ar ? "إنشاء حسابي" : en ? "Create my account" : "Créer mon compte")}</button>
      <small className="security-note">{ar ? "اتصال آمن. لا يتم تخزين كلمة المرور بصيغة قابلة للقراءة." : en ? "Secure connection. Passwords are never stored in readable form." : "Connexion sécurisée. Les mots de passe ne sont jamais stockés en clair."}</small>
    </form>
  );
}
