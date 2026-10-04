"use client";

import Link from "next/link";
import Image from "next/image";
import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";
import { safeAppRedirect } from "@/lib/security/safe-redirect";
import { googleAuthErrorMessage } from "@/lib/auth-errors";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { Icon } from "@/components/ui/Icon";

export type ProfileType = "learner" | "parent" | "teacher" | "avs" | "specialist" | "institution";
export const PROFILE_TYPES: ProfileType[] = ["learner", "parent", "teacher", "avs", "specialist", "institution"];

const PERSONA_FIGURINE: Record<ProfileType, string> = {
  learner: "/media/persona-student.webp",
  parent: "/media/persona-parent.webp",
  teacher: "/media/persona-teacher.webp",
  avs: "/media/persona-avs.webp",
  specialist: "/media/persona-specialist.webp",
  institution: "/media/persona-institution.webp",
};

const PROFILE_LABEL: Record<ProfileType, { fr: string; ar: string; en: string }> = {
  learner: { fr: "Étudiant(e) / apprenant(e)", ar: "طالب / متعلم", en: "Student / learner" },
  parent: { fr: "Parent", ar: "ولي أمر", en: "Parent" },
  teacher: { fr: "Enseignant(e)", ar: "مدرس(ة)", en: "Educator" },
  avs: { fr: "AVS", ar: "مرافق حياة مدرسية", en: "AVS" },
  specialist: { fr: "Spécialiste", ar: "مختص", en: "Specialist" },
  institution: { fr: "Établissement / association", ar: "مؤسسة", en: "School / organization" },
};

const PROFILE_DESCRIPTION: Record<ProfileType, { fr: string; ar: string; en: string }> = {
  learner: { fr: "Suivez vos cours et vos évaluations.", ar: "تابع دروسك وتقييماتك.", en: "Follow your courses and assessments." },
  parent: { fr: "Suivez le parcours de votre enfant.", ar: "تابع مسار طفلك الدراسي.", en: "Support your learner’s journey." },
  teacher: { fr: "Créez et animez vos formations.", ar: "أنشئ وفعّل دوراتك التكوينية.", en: "Author and facilitate learning." },
  avs: { fr: "Accompagnement scolaire et inclusion.", ar: "مرافقة مدرسية وإدماج تربوي.", en: "Classroom and school inclusion." },
  specialist: { fr: "Ressources cliniques et expertise.", ar: "موارد عيادية وخبرة مهنية.", en: "Clinical and specialist practice." },
  institution: { fr: "Convention de partenariat pour vos équipes.", ar: "اتفاقية شراكة لفريقك.", en: "Partnership agreement for your teams." },
};

function isProfileType(value: string | null): value is ProfileType {
  return !!value && (PROFILE_TYPES as string[]).includes(value);
}

export function AuthForm({
  locale,
  mode,
  googleConfigured,
  verificationRequired = false,
}: {
  locale: Locale;
  mode: "login" | "register";
  googleConfigured: boolean;
  googleClientId?: string;
  verificationRequired?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => googleAuthErrorMessage(locale, search.get("error")));
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);

  const [profileType, setProfileType] = useState<ProfileType>(() => {
    const requested = search.get("role");
    return isProfileType(requested) ? requested : "learner";
  });

  const ar = locale === "ar";
  const en = locale === "en";
  const destination = safeAppRedirect(search.get("next"), locale);
  const assuranceDestination = `/${locale}/verification-channel?next=${encodeURIComponent(destination)}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // If on register Step 1, clicking submit just moves to Step 2
    if (mode === "register" && registerStep === 1) {
      setRegisterStep(2);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({ email: email.trim(), password, callbackURL: assuranceDestination });
        if (result.error) {
          if (result.error.code === "EMAIL_NOT_VERIFIED") {
            router.push(`/${locale}/verify-email?email=${encodeURIComponent(email.trim())}`);
            return;
          }
          throw new Error(result.error.message || "AUTH_ERROR");
        }
      } else {
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        const referredByCode = search.get("ref")?.trim().slice(0, 16) || undefined;
        const verifyCallbackURL = `/${locale}/verify-email?email=${encodeURIComponent(trimmedEmail)}`;
        const result = await authClient.signUp.email({
          name: trimmedName,
          email: trimmedEmail,
          password,
          locale: locale === "en" ? "fr" : locale,
          profileType,
          referredByCode,
          callbackURL: verificationRequired ? verifyCallbackURL : assuranceDestination,
        });
        if (result.error) throw new Error(result.error.message || "AUTH_ERROR");
        if (verificationRequired) {
          router.push(verifyCallbackURL);
          return;
        }
      }
      router.push(assuranceDestination);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : ar
            ? "تعذر إتمام العملية"
            : en
              ? "The operation could not be completed"
              : "Impossible de terminer l’opération",
      );
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

  // ==========================================
  // RENDER: REGISTER STEP 1 (Choose Profile)
  // ==========================================
  if (mode === "register" && registerStep === 1) {
    return (
      <div className="auth-step-container">
        {/* Step Indicator */}
        <div className="auth-step-indicator">
          <div className="auth-step-track">
            <span className="auth-step-fill" style={{ width: "50%" }} />
          </div>
          <div className="auth-step-label">
            <span>{ar ? "الخطوة 1 من 2: اختر صفتك" : en ? "Step 1 of 2: Choose your role" : "Étape 1 sur 2 : Choisissez votre profil"}</span>
          </div>
        </div>

        <div className="auth-step-head">
          <h3>{ar ? "ما هي صفتك في الأكاديمية؟" : en ? "What is your role?" : "Quel est votre rôle ?"}</h3>
          <p>{ar ? "اختر صفتك لتخصيص لوحة التحكم والدورات المناسبة لك." : en ? "Select your profile to customize your learning space." : "Sélectionnez votre profil pour personnaliser vos parcours et votre tableau de bord."}</p>
        </div>

        <div className="auth-persona-grid" role="radiogroup" aria-label={ar ? "الصفة" : "Votre profil"}>
          {PROFILE_TYPES.map((type) => {
            const isSelected = profileType === type;
            return (
              <button
                type="button"
                key={type}
                role="radio"
                aria-checked={isSelected}
                className={`auth-persona-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => setProfileType(type)}
              >
                <div className="auth-persona-card-top">
                  <div className="auth-persona-visual">
                    <Image
                      src={PERSONA_FIGURINE[type]}
                      alt=""
                      width={38}
                      height={38}
                      className="auth-persona-avatar-img"
                    />
                  </div>
                  {isSelected && (
                    <span className="auth-persona-check" aria-hidden="true">
                      <Icon name="check" size={12} />
                    </span>
                  )}
                </div>
                <strong>{ar ? PROFILE_LABEL[type].ar : en ? PROFILE_LABEL[type].en : PROFILE_LABEL[type].fr}</strong>
                <small>{ar ? PROFILE_DESCRIPTION[type].ar : en ? PROFILE_DESCRIPTION[type].en : PROFILE_DESCRIPTION[type].fr}</small>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block auth-submit-btn"
          onClick={() => setRegisterStep(2)}
        >
          {ar ? "المتابعة لإدخال البيانات ←" : en ? "Continue to credentials →" : "Continuer vers mes identifiants →"}
        </button>
      </div>
    );
  }

  // ==========================================
  // RENDER: LOGIN OR REGISTER STEP 2 (Credentials)
  // ==========================================
  return (
    <form className="auth-form" onSubmit={submit} aria-busy={loading || googleLoading}>
      {mode === "register" && (
        <div className="auth-step-container" style={{ marginBottom: 12 }}>
          {/* Step Indicator */}
          <div className="auth-step-indicator">
            <div className="auth-step-track">
              <span className="auth-step-fill" style={{ width: "100%" }} />
            </div>
            <div className="auth-step-label">
              <span>{ar ? "الخطوة 2 من 2: بيانات الحساب" : en ? "Step 2 of 2: Account credentials" : "Étape 2 sur 2 : Vos identifiants"}</span>
            </div>
          </div>

          {/* Selected Role Pill with change shortcut */}
          <div className="auth-selected-role-bar">
            <span className="auth-selected-pill">
              <span className="auth-selected-avatar">
                <Image
                  src={PERSONA_FIGURINE[profileType]}
                  alt=""
                  width={24}
                  height={24}
                  className="rounded-full object-cover"
                />
              </span>
              <span>{ar ? "صفتك:" : "Profil :"}{" "}<strong>{PROFILE_LABEL[profileType][ar ? "ar" : "fr"]}</strong></span>
            </span>
            <button
              type="button"
              className="auth-change-role-btn"
              onClick={() => setRegisterStep(1)}
            >
              {ar ? "تغيير" : "Modifier"}
            </button>
          </div>
        </div>
      )}

      {/* Social Google Button */}
      <button
        className="btn btn-google btn-block"
        type="button"
        onClick={google}
        disabled={!googleConfigured || loading || googleLoading}
        data-testid="google-sign-in"
        aria-label={ar ? "المتابعة باستخدام Google" : en ? "Continue with Google" : "Continuer avec Google"}
        aria-describedby={!googleConfigured ? "google-auth-availability" : undefined}
      >
        {googleLoading ? <span className="button-spinner" aria-hidden="true" /> : <GoogleMark />}
        <span className="btn-google-text">
          {googleLoading
            ? ar
              ? "جارٍ فتح Google..."
              : en
                ? "Opening Google…"
                : "Ouverture de Google…"
            : ar
              ? "المتابعة باستخدام Google"
              : en
                ? "Continue with Google"
                : "Continuer avec Google"}
        </span>
      </button>

      {!googleConfigured ? (
        <p className="google-unavailable" id="google-auth-availability" role="status">
          {ar
            ? "سيصبح تسجيل الدخول عبر Google متاحًا بعد إعداد بيانات الاعتماد."
            : en
              ? "Google sign-in will be available after credentials are configured."
              : "La connexion Google sera disponible après configuration des identifiants."}
        </p>
      ) : null}

      <div className="form-divider">
        <span>{ar ? "أو عبر البريد الإلكتروني" : en ? "or with email" : "ou avec votre e-mail"}</span>
      </div>

      {mode === "register" ? (
        <label>
          <span>{ar ? "الاسم الكامل" : en ? "Full name" : "Nom complet"}</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            placeholder={ar ? "الاسم واللقب" : en ? "First and last name" : "Nom et prénom"}
          />
        </label>
      ) : null}

      <label>
        <span>{ar ? "البريد الإلكتروني" : "Email"}</span>
        <input
          name="email"
          type="email"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="nom@exemple.com"
        />
      </label>

      <div className="auth-field-group">
        <div className="auth-label-row">
          <label htmlFor="auth-password-input">
            <span>{ar ? "كلمة المرور" : en ? "Password" : "Mot de passe"}</span>
          </label>
          {mode === "login" ? (
            <Link href={`/${locale}/forgot-password`} className="auth-forgot-link">
              {ar ? "نسيت كلمة المرور؟" : en ? "Forgot password?" : "Mot de passe oublié ?"}
            </Link>
          ) : null}
        </div>

        <div className="auth-password-wrapper">
          <input
            id="auth-password-input"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={15}
            placeholder="•••••••••••••••"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={
              showPassword
                ? ar
                  ? "إخفاء الرمز"
                  : en
                    ? "Hide secret"
                    : "Masquer la saisie"
                : ar
                  ? "إظهار الرمز"
                  : en
                    ? "Show secret"
                    : "Afficher la saisie"
            }
            tabIndex={-1}
          >
            <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
          </button>
        </div>

        {mode === "register" ? (
          <div className="auth-password-meter">
            <div className="meter-track">
              <span
                className={`meter-bar ${password.length >= 15 ? "is-complete" : password.length >= 8 ? "is-medium" : "is-short"}`}
                style={{ width: `${Math.min(100, Math.round((password.length / 15) * 100))}%` }}
              />
            </div>
            <div className="meter-caption">
              {password.length >= 15 ? (
                <span className="meter-success">
                  <Icon name="check" size={12} /> {ar ? "طول ممتاز (15+ حرفًا)" : "Longueur sécurisée (15+ car.)"}
                </span>
              ) : (
                <span className="meter-hint">
                  {ar ? `15 حرفًا على الأقل (${password.length}/15)` : `15 caractères minimum (${password.length}/15)`}
                </span>
              )}
            </div>
            <div className="auth-password-rules">
              <span className={`rule-item ${password.length >= 15 ? "is-met" : ""}`}>
                <span className="rule-bullet" aria-hidden="true">
                  <Icon name="check" size={10} />
                </span>
                <span>{ar ? "15 حرفًا أو أكثر" : en ? "15+ characters" : "15 caractères ou plus"}</span>
              </span>
              <span className={`rule-item ${/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password) ? "is-met" : ""}`}>
                <span className="rule-bullet" aria-hidden="true">
                  <Icon name="check" size={10} />
                </span>
                <span>{ar ? "أرقام أو رموز" : en ? "Numbers or symbols" : "Chiffres ou symboles"}</span>
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <button className="btn btn-primary btn-block auth-submit-btn" disabled={loading || googleLoading} type="submit">
        {loading ? (
          ar ? "جارٍ المعالجة..." : en ? "Processing..." : "Traitement..."
        ) : mode === "login" ? (
          <>
            <span>{ar ? "الدخول إلى مساحتي" : en ? "Open my learning space" : "Accéder à mon espace"}</span>
            <span aria-hidden="true">{ar ? " ←" : " →"}</span>
          </>
        ) : (
          <>
            <span>{ar ? "إنشاء حسابي والمتابعة" : en ? "Create my account & continue" : "Créer mon compte & continuer"}</span>
            <span aria-hidden="true">{ar ? " ←" : " →"}</span>
          </>
        )}
      </button>

      {mode === "register" && (
        <button
          type="button"
          className="btn btn-ghost btn-block auth-back-step-btn"
          onClick={() => setRegisterStep(1)}
        >
          {ar ? "← العودة لاختيار الصفة" : en ? "← Back to role selection" : "← Modifier mon rôle"}
        </button>
      )}
    </form>
  );
}
