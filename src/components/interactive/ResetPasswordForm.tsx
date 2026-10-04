"use client";

import { FormEvent, useSyncExternalStore, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Icon } from "@/components/ui/Icon";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/types";

const emptySubscribe = () => () => {};

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ar = locale === "ar";
  const en = locale === "en";

  const queryToken = searchParams.get("token") || searchParams.get("tokenHash");
  const sessionToken = useSyncExternalStore(
    emptySubscribe,
    () => (typeof window === "undefined" ? null : sessionStorage.getItem("anei_reset_authorization")),
    () => null,
  );

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const activeToken = queryToken || sessionToken;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeToken) return;

    if (password.length < 15) {
      setError(
        ar
          ? "يجب أن تتكون كلمة المرور من 15 حرفًا على الأقل."
          : en
            ? "Password must be at least 15 characters long."
            : "Le mot de passe doit comporter au moins 15 caractères.",
      );
      return;
    }

    if (password !== confirm) {
      setError(
        ar
          ? "كلمتا المرور غير متطابقتين. يرجى التحقق."
          : en
            ? "Passwords do not match. Please verify."
            : "Les mots de passe ne correspondent pas. Veuillez vérifier.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: activeToken, newPassword: password }),
      });

      if (!result.ok) {
        if (queryToken) {
          try {
            const authRes = await authClient.resetPassword({
              newPassword: password,
              token: queryToken,
            });
            if (!authRes.error) {
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("anei_reset_authorization");
              }
              setIsSuccess(true);
              try {
                confetti({ particleCount: 65, spread: 65, origin: { y: 0.6 } });
              } catch {}
              return;
            }
          } catch {}
        }

        const payload = await result.json().catch(() => ({}));
        if (payload.error === "RATE_LIMITED") {
          setError(
            ar
              ? "محاولات كثيرة جدًا. يُرجى الانتظار قليلاً قبل المحاولة مجددًا."
              : en
                ? "Too many requests. Please wait a few moments before retrying."
                : "Trop de tentatives. Veuillez patienter avant de réessayer.",
          );
        } else {
          setError(
            ar
              ? "تعذر تحديث كلمة المرور. قد يكون إذن إعادة التعيين منتهيًا أو مستخدمًا بالفعل."
              : en
                ? "Unable to reset password. The token may be expired or already used."
                : "Impossible de réinitialiser le mot de passe. Le lien ou le code est peut-être expiré.",
          );
        }
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("anei_reset_authorization");
      }
      setIsSuccess(true);
      try {
        confetti({ particleCount: 65, spread: 65, origin: { y: 0.6 } });
      } catch {}
    } catch {
      setError(
        ar
          ? "حدث خطأ غير متوقع. يرجى المحاولة مجددًا."
          : en
            ? "An unexpected error occurred. Please try again."
            : "Une erreur inattendue est survenue. Veuillez réessayer.",
      );
      setLoading(false);
    }
  }



  // 1. Success State
  if (isSuccess) {
    return (
      <div className="auth-success-state" role="status">
        <div className="auth-card-badge" style={{ marginBottom: "16px" }}>
          {ar ? "تم تأمين الحساب" : "COMPTE SÉCURISÉ"}
        </div>
        <div className="auth-success-badge" aria-hidden="true">
          <Icon name="check" size={28} />
        </div>
        <h3>{ar ? "تم تحديث كلمة المرور بنجاح!" : en ? "Password updated successfully!" : "Mot de passe mis à jour !"}</h3>
        <p>
          {ar
            ? "أصبح بإمكانك الآن الدخول إلى مساحتك التعليمية ومتابعة مساراتك بأمان تام."
            : en
              ? "Your account is now secure. You can sign in immediately with your new credentials."
              : "Votre compte est désormais sécurisé. Vous pouvez vous connecter immédiatement avec vos nouveaux identifiants."}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/login?reset=1`)}
          className="btn btn-primary btn-block auth-submit-btn"
        >
          <span>{ar ? "تسجيل الدخول الآن" : en ? "Sign in now" : "Se connecter maintenant"}</span>
          <span aria-hidden="true">{ar ? " ←" : " →"}</span>
        </button>
      </div>
    );
  }

  // 2. Missing Token / Expired Authorization State
  if (!activeToken) {
    return (
      <div className="auth-missing-token" role="alert">
        <div className="auth-card-badge" style={{ marginBottom: "16px" }}>
          {ar ? "أمان الحساب" : "SÉCURITÉ DU COMPTE"}
        </div>
        <div className="auth-missing-token-badge" aria-hidden="true">
          <Icon name="shield" size={28} />
        </div>
        <h3>
          {ar
            ? "إذن إعادة التعيين غير متوفر أو منتهٍ"
            : en
              ? "Missing or expired reset authorization"
              : "Autorisation de réinitialisation manquante"}
        </h3>
        <p>
          {ar
            ? "لأسباب أمنية، يجب طلب رمز تحقق أو رابط جديد لتأكيد هويتك قبل تعيين كلمة مرور جديدة."
            : en
              ? "For security reasons, you must request a verification code or reset link before setting a new password."
              : "Pour des raisons de sécurité, vous devez d'abord demander un code ou un lien de réinitialisation."}
        </p>
        <Link href={`/${locale}/forgot-password`} className="btn btn-primary btn-block auth-submit-btn">
          <span>{ar ? "طلب رمز أمان جديد" : en ? "Request a new security code" : "Demander un code de sécurité"}</span>
          <span aria-hidden="true">{ar ? " ←" : " →"}</span>
        </Link>
        <Link href={`/${locale}/login`} className="auth-secondary-btn">
          <span>{ar ? "العودة لتسجيل الدخول" : en ? "Back to sign in" : "Retour à la connexion"}</span>
        </Link>
      </div>
    );
  }

  // 3. Normal Form State
  const lengthValid = password.length >= 15;
  const charsValid = /[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const canSubmit = lengthValid && passwordsMatch && !loading;

  return (
    <>
      <div className="auth-card-header">
        <div className="auth-card-badge">{ar ? "كلمة مرور جديدة" : "NOUVEAU MOT DE PASSE"}</div>
        <h2>{ar ? "تعيين كلمة مرور قوية" : en ? "Set a strong password" : "Définissez un mot de passe robuste"}</h2>
        <p>
          {ar
            ? "اختر كلمة مرور فريدة لا تقل عن 15 حرفًا لضمان حماية بياناتك وشهاداتك ومساراتك."
            : en
              ? "Choose a unique, robust password with at least 15 characters to safeguard your learning space."
              : "Choisissez un mot de passe robuste d’au moins 15 caractères pour protéger votre espace et vos attestations."}
        </p>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate={false} aria-busy={loading}>
      {/* Password Field */}
      <div>
        <label htmlFor="reset-password-input">
          <span>{ar ? "كلمة المرور الجديدة" : en ? "New password" : "Nouveau mot de passe"}</span>
        </label>
        <div className="auth-password-wrapper">
          <input
            id="reset-password-input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={15}
            maxLength={128}
            required
            autoComplete="new-password"
            placeholder="•••••••••••••••"
            autoFocus
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={
              showPassword
                ? ar
                  ? "إخفاء كلمة المرور"
                  : "Masquer"
                : ar
                  ? "إظهار كلمة المرور"
                  : "Afficher"
            }
            tabIndex={-1}
          >
            <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
          </button>
        </div>

        {/* Real-time 15-char Password Strength Meter */}
        <div className="auth-password-meter">
          <div className="meter-track">
            <span
              className={`meter-bar ${lengthValid ? "is-complete" : password.length >= 8 ? "is-medium" : "is-short"}`}
              style={{ width: `${Math.min(100, Math.round((password.length / 15) * 100))}%` }}
            />
          </div>
          <div className="meter-caption">
            {lengthValid ? (
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
            <span className={`rule-item ${lengthValid ? "is-met" : ""}`}>
              <span className="rule-bullet" aria-hidden="true">
                <Icon name="check" size={10} />
              </span>
              <span>{ar ? "15 حرفًا أو أكثر" : en ? "15+ characters" : "15 caractères ou plus"}</span>
            </span>
            <span className={`rule-item ${charsValid ? "is-met" : ""}`}>
              <span className="rule-bullet" aria-hidden="true">
                <Icon name="check" size={10} />
              </span>
              <span>{ar ? "أرقام أو رموز" : en ? "Numbers or symbols" : "Chiffres ou symboles"}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Confirm Password Field */}
      <div>
        <label htmlFor="reset-confirm-input">
          <span>{ar ? "تأكيد كلمة المرور الجديدة" : en ? "Confirm new password" : "Confirmer le nouveau mot de passe"}</span>
        </label>
        <div className="auth-password-wrapper">
          <input
            id="reset-confirm-input"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            minLength={15}
            maxLength={128}
            required
            autoComplete="new-password"
            placeholder="•••••••••••••••"
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={
              showConfirm
                ? ar
                  ? "إخفاء كلمة المرور"
                  : "Masquer"
                : ar
                  ? "إظهار كلمة المرور"
                  : "Afficher"
            }
            tabIndex={-1}
          >
            <Icon name={showConfirm ? "eye-off" : "eye"} size={18} />
          </button>
        </div>

        {/* Real-time Match Indicator */}
        {confirm.length > 0 && (
          <div className="auth-match-indicator">
            {passwordsMatch ? (
              <span className="match-success">
                <Icon name="check" size={12} />
                <span>{ar ? "كلمتا المرور متطابقتان" : "Les mots de passe correspondent"}</span>
              </span>
            ) : (
              <span className="match-error">
                <Icon name="close" size={12} />
                <span>{ar ? "كلمتا المرور غير متطابقتين" : "Les mots de passe ne correspondent pas"}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-block auth-submit-btn"
        disabled={!canSubmit}
        type="submit"
      >
        {loading ? (
          ar ? "جارٍ حفظ كلمة المرور..." : en ? "Saving..." : "Enregistrement en cours..."
        ) : (
          <>
            <span>{ar ? "حفظ كلمة المرور الجديدة" : en ? "Save new password" : "Enregistrer mon mot de passe"}</span>
            <span aria-hidden="true">{ar ? " ←" : " →"}</span>
          </>
        )}
      </button>
    </form>
    </>
  );
}
