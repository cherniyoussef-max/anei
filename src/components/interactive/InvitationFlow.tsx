"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/types";

type InvitationInfo = {
  status: string;
  intendedPersona: string;
  organizationName: string;
  maskedPhone: string;
  locale: string;
};

/**
 * Public invitation landing flow: shows the (masked) destination and guides the
 * holder through OTP request → verify → login-or-register → claim. The token
 * is a high-entropy bearer secret from the WhatsApp link; it stays in the URL
 * for the claim step and is never rendered as text. Errors are generic.
 */
export function InvitationFlow({ token, locale }: { token: string; locale: Locale }) {
  const ar = locale === "ar";
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [phase, setPhase] = useState<"request" | "enter" | "verified">("request");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invitations/info?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !data) {
          setLoadState("error");
          return;
        }
        setInfo(data);
        setLoadState("ready");
        if (data.status === "VERIFIED") setPhase("verified");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendCode() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setPhase("enter");
        return;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      if (res.status === 429 && Number.isFinite(retryAfter)) setCooldown(Math.max(0, retryAfter));
      const data = await res.json().catch(() => null);
      if (data?.error === "COOLDOWN" && Number.isFinite(retryAfter)) setCooldown(Math.max(0, retryAfter));
      setError(
        data?.error === "EXPIRED" || data?.error === "INVALID_TOKEN"
          ? ar ? "انتهت صلاحية هذه الدعوة." : "Cette invitation a expiré."
          : ar ? "تعذر إرسال رمز التحقق. حاول لاحقًا." : "Impossible d’envoyer le code. Réessayez plus tard.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, code }),
      });
      if (res.ok) {
        setPhase("verified");
        return;
      }
      const data = await res.json().catch(() => null);
      if (data?.error === "INVALID_CODE") {
        setError(ar ? "رمز غير صحيح. حاول مجددًا." : "Code incorrect. Réessayez.");
      } else if (data?.error === "LOCKED") {
        setError(ar ? "تم تعطيل التحقق بعد عدة محاولات خاطئة." : "Vérification verrouillée après plusieurs tentatives.");
      } else if (data?.error === "EXPIRED") {
        setError(ar ? "انتهت صلاحية الرمز. اطلب رمزًا جديدًا." : "Le code a expiré. Demandez-en un nouveau.");
      } else {
        setError(ar ? "تعذر التحقق من الرمز." : "Impossible de vérifier le code.");
      }
    } finally {
      setBusy(false);
    }
  }

  const claimNext = `/${locale}/invitation/claim?token=${encodeURIComponent(token)}`;
  const loginHref = `/${locale}/login?next=${encodeURIComponent(claimNext)}`;
  const registerHref = `/${locale}/register?next=${encodeURIComponent(claimNext)}`;

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-intro">
          <span className="eyebrow">{ar ? "دعوة" : "Invitation"}</span>
          <h1>{ar ? "أكمل إنشاء حسابك" : "Finalisez votre inscription"}</h1>
          <p>
            {ar
              ? "تحقق من رقم هاتفك ثم أنشئ حسابك للوصول إلى مساحة المتعلم."
              : "Vérifiez votre numéro de téléphone puis créez votre compte pour accéder à votre espace apprenant."}
          </p>
        </div>
        <div className="auth-card">
          {loadState === "loading" ? (
            <p className="security-note">{ar ? "جارٍ التحميل..." : "Chargement…"}</p>
          ) : null}
          {loadState === "error" ? (
            <>
              <h2>{ar ? "رابط غير صالح" : "Lien invalide"}</h2>
              <p>{ar ? "هذه الدعوة غير صالحة أو منتهية الصلاحية." : "Cette invitation est invalide ou a expiré."}</p>
              <Link href={`/${locale}/login`} className="btn btn-primary">{ar ? "تسجيل الدخول" : "Se connecter"}</Link>
            </>
          ) : null}

          {loadState === "ready" && info ? (
            <>
              <h2>{ar ? "مرحبًا بك" : "Bienvenue"}</h2>
              <p>
                {ar ? `أنت مدعو للانضمام إلى « ${info.organizationName} ».` : `Vous êtes invité(e) à rejoindre « ${info.organizationName} ».`}
              </p>
              <p className="security-note">
                {ar ? `الرقم المستخدم: ${info.maskedPhone}` : `Numéro utilisé : ${info.maskedPhone}`}
              </p>

              {phase === "verified" ? (
                <>
                  <div className="form-success" role="status">
                    <strong>{ar ? "تم التحقق من رقمك" : "Numéro vérifié"}</strong>
                    <p>{ar ? "اختر الآن كيف تتابع: سجّل الدخول بحسابك أو أنشئ حسابًا جديدًا." : "Choisissez comment continuer : connectez-vous avec votre compte ou créez-en un nouveau."}</p>
                  </div>
                  <div className="auth-actions">
                    <Link href={loginHref} className="btn btn-primary btn-block">{ar ? "لديّ حساب بالفعل" : "J’ai déjà un compte"}</Link>
                    <Link href={registerHref} className="btn btn-google btn-block">{ar ? "إنشاء حساب جديد" : "Créer un compte"}</Link>
                  </div>
                </>
              ) : (
                <>
                  {error ? <div className="form-error" role="alert">{error}</div> : null}
                  {phase === "request" ? (
                    <button className="btn btn-primary btn-block" onClick={sendCode} disabled={busy || cooldown > 0}>
                      {busy ? (ar ? "جارٍ الإرسال..." : "Envoi…") : cooldown > 0 ? (ar ? `أعد المحاولة خلال ${cooldown} ث` : `Réessayer dans ${cooldown}s`) : (ar ? "إرسال رمز التحقق" : "Envoyer le code de vérification")}
                    </button>
                  ) : null}
                  {phase === "enter" ? (
                    <>
                      <label>
                        <span>{ar ? "رمز التحقق" : "Code de vérification"}</span>
                        <input
                          name="code"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength={6}
                          required
                          value={code}
                          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          placeholder="000000"
                          aria-label={ar ? "رمز التحقق المكوّن من 6 أرقام" : "Code de vérification à 6 chiffres"}
                        />
                      </label>
                      <button className="btn btn-primary btn-block" onClick={verify} disabled={busy || code.length !== 6}>
                        {busy ? (ar ? "جارٍ التحقق..." : "Vérification…") : (ar ? "تأكيد الرمز" : "Confirmer le code")}
                      </button>
                      <button className="btn btn-block" onClick={sendCode} disabled={busy || cooldown > 0}>
                        {cooldown > 0 ? (ar ? `إعادة إرسال خلال ${cooldown} ث` : `Renvoyer dans ${cooldown}s`) : (ar ? "إعادة إرسال الرمز" : "Renvoyer le code")}
                      </button>
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}