"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { Icon } from "@/components/ui/Icon";

type Landing = { organizationName: string; maskedPhone: string; status: string };

const RESEND_COOLDOWN_SECONDS = 60;

export function InvitationClaimFlow({ token, locale }: { token: string; locale: string }) {
  const ar = locale === "ar";
  const { data: session, isPending: sessionPending } = useSession();
  const [landing, setLanding] = useState<Landing | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/invitation/status?token=${encodeURIComponent(token)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => !cancelled && setLanding(data))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((val) => Math.max(0, val - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function requestOtp() {
    if (cooldown > 0) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (res.ok) {
      setOtpRequested(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setMessage(null);
    } else {
      setMessage(ar ? "تعذر إرسال الرمز حاليًا. حاول لاحقًا." : "Impossible d’envoyer le code. Réessayez plus tard.");
    }
  }

  async function verifyOtp() {
    if (code.length !== 6) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, code }),
    });
    setBusy(false);
    if (res.ok) {
      setLanding((prev) => (prev ? { ...prev, status: "VERIFIED" } : prev));
      setMessage(null);
    } else {
      setMessage(ar ? "رمز غير صحيح أو منتهي الصلاحية." : "Code invalide ou expiré.");
    }
  }

  async function claim() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/invitation/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (res.ok) {
      setClaimed(true);
    } else {
      setMessage(ar ? "تعذر ربط الحساب. يرجى المحاولة لاحقًا." : "Impossible de relier le compte.");
    }
  }

  if (loadError) {
    return (
      <div className="auth-card">
        <div className="auth-missing-token">
          <div className="auth-missing-token-badge">
            <Icon name="shield" size={26} />
          </div>
          <h3>{ar ? "رابط الدعوة غير صالح" : "Lien d’invitation non valide"}</h3>
          <p>
            {ar
              ? "هذا الرابط غير صالح أو انتهت صلاحيته. يرجى مراجعة إدارة مؤسستك للحصول على دعوة جديدة."
              : "Ce lien d’invitation est invalide ou a expiré. Contactez l’administrateur de votre établissement pour en obtenir un nouveau."}
          </p>
          <Link className="btn btn-primary btn-block auth-submit-btn" href={`/${locale}/login`}>
            {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
          </Link>
        </div>
      </div>
    );
  }

  if (!landing) {
    return (
      <div className="auth-card" style={{ textAlign: "center", padding: "40px 20px" }}>
        <div className="button-spinner" style={{ margin: "0 auto 12px" }} />
        <p className="text-slate-500" style={{ fontSize: "0.88rem" }}>
          {ar ? "جارٍ التحقق من بيانات الدعوة..." : "Chargement de votre invitation..."}
        </p>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="auth-card">
        <div className="auth-success-state">
          <div className="auth-success-badge">
            <Icon name="check" size={28} />
          </div>
          <h3>{ar ? "تم ربط حسابك بنجاح !" : "Compte activé avec succès !"}</h3>
          <p>
            {ar
              ? `تم ربط عضويتك بمؤسسة ${landing.organizationName}. يمكنك الآن الوصول إلى مقرراتك ومساحتك.`
              : `Votre compte a bien été associé à ${landing.organizationName}. Vous pouvez désormais accéder à vos espaces de formation.`}
          </p>
          <Link className="btn btn-primary btn-block auth-submit-btn" href={`/${locale}/dashboard`}>
            {ar ? "الدخول إلى لوحة التحكم ←" : "Accéder à mon tableau de bord →"}
          </Link>
        </div>
      </div>
    );
  }

  if (["REVOKED", "EXPIRED", "CONSUMED"].includes(landing.status)) {
    return (
      <div className="auth-card">
        <div className="auth-missing-token">
          <div className="auth-missing-token-badge">
            <Icon name="clock" size={26} />
          </div>
          <h3>{ar ? "هذه الدعوة لم تعد صالحة" : "Cette invitation n’est plus active"}</h3>
          <p>
            {ar
              ? "تم استخدام هذه الدعوة مسبقًا أو تم إلغاؤها من قبل إدارة المؤسسة."
              : "Cette invitation a déjà été utilisée ou a été révoquée par votre organisation."}
          </p>
          <Link className="btn btn-primary btn-block auth-submit-btn" href={`/${locale}/login`}>
            {ar ? "العودة إلى تسجيل الدخول" : "Retour à la connexion"}
          </Link>
        </div>
      </div>
    );
  }

  const nextParam = encodeURIComponent(`/${locale}/invitation/${token}`);

  return (
    <div className="auth-card" aria-busy={busy}>
      <div className="auth-card-header">
        <div className="auth-card-badge">{ar ? "دعوة رسمية" : "INVITATION OFFICIELLE"}</div>
        <h2>{ar ? "تفعيل حسابك" : "Rejoignez votre établissement"}</h2>
        <p>
          {ar
            ? `دعوة موجهة إليك من ${landing.organizationName} لتفعيل عضويتك.`
            : `Invitation transmise par ${landing.organizationName} pour activer votre accès.`}
        </p>
      </div>

      <div className="auth-notice-card" style={{ marginBottom: "16px" }}>
        <div className="auth-notice-icon">
          <Icon name="phone" size={18} />
        </div>
        <div className="auth-notice-content">
          <strong>{landing.organizationName}</strong>
          <span>{landing.maskedPhone}</span>
        </div>
      </div>

      {landing.status !== "VERIFIED" ? (
        <>
          {!otpRequested ? (
            <button
              type="button"
              className="btn btn-primary btn-block auth-submit-btn"
              disabled={busy}
              onClick={requestOtp}
            >
              {busy ? (
                ar ? "جارٍ الإرسال..." : "Envoi en cours..."
              ) : (
                <>
                  <span>{ar ? "إرسال رمز التحقق عبر واتساب" : "Recevoir mon code par WhatsApp"}</span>
                  <span aria-hidden="true">{ar ? " ←" : " →"}</span>
                </>
              )}
            </button>
          ) : (
            <div className="auth-otp-box">
              <div className="auth-otp-header">
                <label htmlFor="invitation-otp-input" className="auth-otp-label">
                  <span>{ar ? "رمز التحقق (6 أرقام)" : "Code à 6 chiffres"}</span>
                </label>
                <span className="auth-otp-badge">
                  <Icon name="clock" size={12} />
                  <span>{ar ? "واتساب" : "Envoyé par WhatsApp"}</span>
                </span>
              </div>

              <input
                id="invitation-otp-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && code.length === 6 && !busy) {
                    e.preventDefault();
                    verifyOtp();
                  }
                }}
                placeholder="••••••"
                className="auth-otp-input"
                autoFocus
              />

              <button
                type="button"
                className="btn btn-primary btn-block auth-submit-btn"
                disabled={busy || code.length !== 6}
                onClick={verifyOtp}
              >
                {busy ? (
                  ar ? "جارٍ التحقق..." : "Vérification..."
                ) : (
                  <>
                    <span>{ar ? "تأكيد الرمز والمتابعة" : "Confirmer mon identité"}</span>
                    <span aria-hidden="true">{ar ? " ←" : " →"}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-block auth-back-step-btn"
                disabled={busy || cooldown > 0}
                onClick={requestOtp}
                style={{ marginTop: "6px" }}
              >
                {cooldown > 0
                  ? (ar ? `إعادة الإرسال متاحة (${cooldown} ث)` : `Renvoyer disponible (${cooldown} s)`)
                  : (ar ? "إعادة إرسال الرمز عبر واتساب" : "Renvoyer le code par WhatsApp")}
              </button>
            </div>
          )}
        </>
      ) : sessionPending ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div className="button-spinner" style={{ margin: "0 auto 8px" }} />
          <p className="text-slate-500" style={{ fontSize: "0.85rem" }}>
            {ar ? "جارٍ التحقق من الجلسة..." : "Vérification de la session..."}
          </p>
        </div>
      ) : session ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div className="auth-verify-email-pill" style={{ margin: "0 auto 10px", width: "100%", justifyContent: "center" }}>
            <Icon name="check" size={14} />
            <span>{ar ? "تم التحقق من رقم الهاتف بنجاح" : "Numéro vérifié avec succès"}</span>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block auth-submit-btn"
            disabled={busy}
            onClick={claim}
          >
            {busy ? (
              ar ? "جارٍ ربط الحساب..." : "Liaison en cours..."
            ) : (
              <>
                <span>{ar ? "ربط الحساب بالمؤسسة" : "Activer et rejoindre l’organisation"}</span>
                <span aria-hidden="true">{ar ? " ←" : " →"}</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="auth-switch" style={{ display: "flex", flexDirection: "column", gap: "10px", border: "none", paddingTop: "0" }}>
          <p style={{ fontSize: "0.86rem", color: "#475569", marginBottom: "4px" }}>
            {ar
              ? "تم التحقق من رقمك! يرجى تسجيل الدخول أو إنشاء حساب لربط عضويتك:"
              : "Votre numéro est validé ! Connectez-vous ou créez votre compte pour finaliser :"}
          </p>
          <Link href={`/${locale}/login?next=${nextParam}`} className="btn btn-primary btn-block auth-submit-btn">
            {ar ? "تسجيل الدخول إلى حسابي ←" : "Se connecter à mon compte →"}
          </Link>
          <Link href={`/${locale}/register?next=${nextParam}`} className="btn btn-secondary btn-block auth-secondary-btn">
            {ar ? "إنشاء حساب جديد" : "Créer un nouveau compte"}
          </Link>
        </div>
      )}

      {message ? (
        <div className="form-error" role="alert" style={{ marginTop: "12px" }}>
          {message}
        </div>
      ) : null}
    </div>
  );
}
