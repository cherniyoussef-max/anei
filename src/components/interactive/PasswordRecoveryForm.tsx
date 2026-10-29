"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { OtpPinInput } from "@/components/auth/OtpPinInput";
import type { Locale } from "@/types";

function maskDestination(val: string, isWhatsapp: boolean): string {
  if (isWhatsapp) {
    const digits = val.replace(/\D/g, "");
    if (digits.length < 4) return val;
    return `${val.slice(0, 4)} ** *** ${digits.slice(-3)}`;
  }
  const parts = val.split("@");
  if (parts.length !== 2) return val;
  const [name, domain] = parts;
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name.slice(0, 2)}***${name.slice(-1)}`;
  return `${maskedName}@${domain}`;
}

export function PasswordRecoveryForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ar = locale === "ar";
  const en = locale === "en";

  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), channel }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setError(
            ar
              ? "محاولات كثيرة جدًا. يُرجى الانتظار قليلاً قبل المحاولة مجددًا."
              : en
                ? "Too many requests. Please wait a few moments before trying again."
                : "Trop de tentatives. Veuillez patienter avant de réessayer.",
          );
        } else {
          setError(
            ar
              ? "تعذر إرسال رمز التحقق. يرجى التحقق من اتصالك والمحاولة مجددًا."
              : en
                ? "Could not send verification code. Please check your connection and retry."
                : "Impossible d'envoyer le code de vérification. Veuillez réessayer.",
          );
        }
        setLoading(false);
        return;
      }

      setStep("verify");
      setCooldown(60);
      setLoading(false);
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

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), channel }),
      });

      if (response.ok) {
        setCooldown(60);
      } else {
        setError(
          ar
            ? "تعذر إعادة إرسال الرمز حاليًا. يرجى الانتظار."
            : en
              ? "Could not resend code. Please wait."
              : "Impossible de renvoyer le code actuellement.",
        );
      }
    } catch {
      setError(
        ar
          ? "تعذر الاتصال بالخادم."
          : en
            ? "Connection failed."
            : "Échec de connexion au serveur.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6 || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.resetAuthorizationToken) {
        if (response.status === 429) {
          setError(
            ar
              ? "محاولات كثيرة جدًا. يُرجى الانتظار دقيقة قبل المحاولة مجددًا."
              : en
                ? "Too many attempts. Please wait a minute before retrying."
                : "Trop de tentatives de validation. Veuillez patienter une minute.",
          );
        } else {
          setError(
            ar
              ? "رمز التحقق غير صحيح أو منتهي الصلاحية. يرجى التأكد من الرمز."
              : en
                ? "Invalid or expired verification code. Please check the code."
                : "Code de vérification invalide ou expiré. Veuillez vérifier votre saisie.",
          );
        }
        setLoading(false);
        return;
      }

      sessionStorage.setItem("anei_reset_authorization", String(payload.resetAuthorizationToken));
      router.push(`/${locale}/reset-password`);
    } catch {
      setError(
        ar
          ? "حدث خطأ أثناء التحقق. يرجى المحاولة لاحقًا."
          : en
            ? "An error occurred during verification. Please try again."
            : "Une erreur est survenue lors de la vérification.",
      );
      setLoading(false);
    }
  }

  function handleBackToRequest() {
    setStep("request");
    setCode("");
    setError(null);
  }

  return (
    <div className="auth-form" aria-busy={loading}>
      {step === "request" ? (
        <form onSubmit={handleRequest} noValidate={false}>
          <label>
            <span>{ar ? "البريد الإلكتروني المسجل" : en ? "Registered email" : "Adresse e-mail enregistrée"}</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
              placeholder={ar ? "name@example.com" : "exemple@domaine.fr"}
              autoFocus
            />
          </label>

          <div
            className="auth-channel-selector"
            role="radiogroup"
            aria-label={ar ? "قناة استلام رمز التحقق" : "Canal de réception du code"}
          >
            <span className="auth-channel-title">
              {ar ? "طريقة استلام رمز الأمان:" : "Mode d’envoi du code de sécurité :"}
            </span>
            <div className="auth-channel-grid">
              <button
                type="button"
                role="radio"
                aria-checked={channel === "EMAIL"}
                className={`auth-channel-card ${channel === "EMAIL" ? "is-selected" : ""}`}
                onClick={() => setChannel("EMAIL")}
              >
                <div className="channel-icon-wrap">
                  <Icon name="mail" size={18} />
                </div>
                <div className="channel-info">
                  <strong>{ar ? "البريد الإلكتروني" : "Email sécurisé"}</strong>
                  <small>{ar ? "رمز يُرسل إلى صندوق الوارد" : "Code envoyé sur votre boîte e-mail"}</small>
                </div>
                {channel === "EMAIL" && (
                  <span className="channel-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={channel === "WHATSAPP"}
                className={`auth-channel-card ${channel === "WHATSAPP" ? "is-selected" : ""}`}
                onClick={() => setChannel("WHATSAPP")}
              >
                <div className="channel-icon-wrap">
                  <Icon name="phone" size={18} />
                </div>
                <div className="channel-info">
                  <strong>WhatsApp</strong>
                  <small>{ar ? "رمز فوري عبر واتساب" : "Message instantané sécurisé"}</small>
                </div>
                {channel === "WHATSAPP" && (
                  <span className="channel-check" aria-hidden="true">
                    <Icon name="check" size={13} />
                  </span>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block auth-submit-btn"
            type="submit"
            disabled={loading || !email.trim()}
          >
            {loading ? (
              ar ? "جارٍ إرسال الرمز..." : en ? "Sending code..." : "Envoi du code..."
            ) : (
              <>
                <span>{ar ? "إرسال رمز التحقق" : en ? "Send verification code" : "Recevoir mon code de sécurité"}</span>
                <span aria-hidden="true">{ar ? " ←" : " →"}</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} noValidate={false}>
          <div className="auth-notice-card">
            <div className="auth-notice-icon">
              <Icon name={channel === "EMAIL" ? "mail" : "phone"} size={18} />
            </div>
            <div className="auth-notice-content">
              <strong>
                {ar
                  ? "تم إرسال رمز الأمان بنجاح إلى:"
                  : en
                    ? "Security code sent to:"
                    : "Code de sécurité envoyé à :"}
              </strong>
              <span>{maskDestination(email, channel === "WHATSAPP")}</span>
            </div>
          </div>

          <div className="auth-otp-box">
            <div className="auth-otp-header flex items-center justify-between mb-3">
              <label htmlFor="recovery-otp-input" className="auth-otp-label">
                <span>{ar ? "رمز التحقق (6 أرقام)" : en ? "Verification code (6 digits)" : "Code de vérification (6 chiffres)"}</span>
              </label>
              <span className="auth-otp-badge">
                <Icon name="shield" size={13} />
                <span>{ar ? "صالح لمدة 5 دقائق" : en ? "Valid for 5 minutes" : "Valable 5 minutes"}</span>
              </span>
            </div>

            <div className="my-2">
              <OtpPinInput
                value={code}
                onChange={setCode}
                disabled={loading}
                hasError={Boolean(error)}
                autoFocus
                id="recovery-otp-input"
                ariaLabel={ar ? "رمز التحقق" : "Code de vérification"}
              />
            </div>
            <div className="auth-otp-meta">
              <span className="otp-destination">
                <Icon name="shield" size={13} />
                <span>{ar ? "صالح لمدة 5 دقائق" : en ? "Valid for 5 minutes" : "Valable 5 minutes"}</span>
              </span>
              {cooldown > 0 ? (
                <span className="otp-expiry">
                  <Icon name="clock" size={13} />
                  <span>{ar ? `إعادة الإرسال بعد ${cooldown} ث` : en ? `Resend in ${cooldown}s` : `Renvoyer dans ${cooldown}s`}</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="auth-link-btn"
                  disabled={loading}
                >
                  {ar ? "إعادة إرسال الرمز" : en ? "Resend code" : "Renvoyer le code"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button
            className="btn btn-primary btn-block auth-submit-btn"
            type="submit"
            disabled={code.length !== 6 || loading}
          >
            {loading ? (
              ar ? "جارٍ التحقق من الرمز..." : en ? "Verifying..." : "Vérification en cours..."
            ) : (
              <>
                <span>{ar ? "تأكيد الرمز والمتابعة" : en ? "Verify & continue" : "Vérifier le code et continuer"}</span>
                <span aria-hidden="true">{ar ? " ←" : " →"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleBackToRequest}
            className="auth-secondary-btn"
            disabled={loading}
          >
            <span aria-hidden="true">{ar ? "→" : "←"}</span>
            <span>{ar ? "تعديل البريد الإلكتروني أو القناة" : en ? "Change email or channel" : "Modifier l'e-mail ou le canal"}</span>
          </button>
        </form>
      )}
    </div>
  );
}
