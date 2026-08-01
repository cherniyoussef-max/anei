"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";
import { safeAppRedirect } from "@/lib/security/safe-redirect";
import { googleAuthErrorMessage } from "@/lib/auth-errors";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { GoogleOneTap } from "@/components/auth/GoogleOneTap";


export function AuthForm({ locale, mode, googleConfigured, googleClientId, verificationRequired = false }: { locale: Locale; mode: "login" | "register"; googleConfigured: boolean; googleClientId?: string; verificationRequired?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => googleAuthErrorMessage(locale, search.get("error")));
  const [googleLoading, setGoogleLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const ar = locale === "ar";
  const destination = safeAppRedirect(search.get("next"), locale);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email, password, callbackURL: destination });
        if (result.error) throw new Error(result.error.message || "AUTH_ERROR");
      } else {
        const name = String(form.get("name") ?? "").trim();
        const profileType = String(form.get("profileType") ?? "learner") as "learner" | "teacher" | "avs" | "parent" | "specialist" | "institution";
        const result = await authClient.signUp.email({ name, email, password, locale, profileType, callbackURL: destination });
        if (result.error) throw new Error(result.error.message || "AUTH_ERROR");
      }
      if (mode === "register" && verificationRequired) {
        setRegistered(true);
        setLoading(false);
        return;
      }
      router.push(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : ar ? "تعذر إتمام العملية" : "Impossible de terminer l’opération");
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
        callbackURL: destination,
        errorCallbackURL,
      });
      if (result?.error) throw new Error(result.error.message || "GOOGLE_AUTH_ERROR");
    } catch {
      setError(googleAuthErrorMessage(locale, "google_auth_failed"));
      setGoogleLoading(false);
    }
  }

  if (registered) return <div className="form-success" role="status"><strong>{ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez votre adresse e-mail"}</strong><p>{ar ? "تم إنشاء الحساب. افتح رابط التحقق المرسل إلى بريدك قبل تسجيل الدخول." : "Votre compte est créé. Ouvrez le lien de vérification envoyé par e-mail avant de vous connecter."}</p></div>;

  return (
    <form className="auth-form" onSubmit={submit} aria-busy={loading || googleLoading}>
      <>
        {googleClientId ? <GoogleOneTap clientId={googleClientId} locale={locale} callbackURL={destination}/> : null}
        <button
          className="btn btn-google btn-block"
          type="button"
          onClick={google}
          disabled={!googleConfigured || loading || googleLoading}
          data-testid="google-sign-in"
          aria-label={ar ? "المتابعة باستخدام Google" : "Continuer avec Google"}
          aria-describedby={!googleConfigured ? "google-auth-availability" : undefined}
        >
          {googleLoading ? <span className="button-spinner" aria-hidden="true"/> : <GoogleMark/>}
          {googleLoading ? (ar ? "جارٍ فتح Google..." : "Ouverture de Google…") : (ar ? "المتابعة باستخدام Google" : "Continuer avec Google")}
        </button>
        {!googleConfigured ? <p className="google-unavailable" id="google-auth-availability" role="status">
          {ar ? "سيصبح تسجيل الدخول عبر Google متاحًا بعد إعداد بيانات الاعتماد." : "La connexion Google sera disponible après configuration des identifiants."}
        </p> : null}
        <div className="form-divider"><span>{ar ? "أو" : "ou"}</span></div>
      </>
      {mode === "register" ? <label><span>{ar ? "الاسم الكامل" : "Nom complet"}</span><input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder={ar ? "الاسم واللقب" : "Nom et prénom"}/></label> : null}
      <label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com"/></label>
      <label><span>{ar ? "كلمة المرور" : "Mot de passe"}</span><input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={10}/>{mode === "register" ? <small>{ar ? "10 أحرف على الأقل." : "10 caractères minimum."}</small> : null}</label>
      {mode === "register" ? <label><span>{ar ? "الصفة" : "Votre profil"}</span><select name="profileType" defaultValue="teacher"><option value="teacher">{ar ? "مدرس(ة)" : "Enseignant(e)"}</option><option value="avs">AVS</option><option value="parent">{ar ? "ولي" : "Parent"}</option><option value="specialist">{ar ? "مختص" : "Spécialiste"}</option><option value="institution">{ar ? "مؤسسة" : "Établissement / association"}</option><option value="learner">{ar ? "طالب / متعلم" : "Étudiant(e) / apprenant(e)"}</option></select></label> : null}
      {mode === "login" ? <div className="auth-inline auth-inline-end"><Link href={`/${locale}/forgot-password`}>{ar ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}</Link></div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button className="btn btn-primary btn-block" disabled={loading || googleLoading} type="submit">{loading ? (ar ? "جارٍ المعالجة..." : "Traitement...") : mode === "login" ? (ar ? "الدخول إلى مساحتي" : "Accéder à mon espace") : (ar ? "إنشاء حسابي" : "Créer mon compte")}</button>
      <small className="security-note">{ar ? "اتصال آمن. لا يتم تخزين كلمة المرور بصيغة قابلة للقراءة." : "Connexion sécurisée. Les mots de passe ne sont jamais stockés en clair."}</small>
    </form>
  );
}
