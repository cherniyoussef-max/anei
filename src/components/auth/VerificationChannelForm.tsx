"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

type Channel = { channel: "EMAIL" | "WHATSAPP"; destinationMasked: string };

const OTP_COOLDOWN_SECONDS = 60;

export function VerificationChannelForm({ locale }: { locale: Locale }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<"EMAIL" | "WHATSAPP" | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const router = useRouter();
  const search = useSearchParams();
  const ar = locale === "ar";
  const next = search.get("next") || `/${locale}/dashboard`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const response = await fetch("/api/auth/assurance/channels", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (cancelled) return;
      const list = Array.isArray(payload.channels) ? (payload.channels as Channel[]) : [];
      setChannels(list);
      setSelected(list.length === 1 ? list[0].channel : list[0]?.channel ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((val) => Math.max(0, val - 1)), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const selectedChannel = useMemo(
    () => channels.find((entry) => entry.channel === selected) ?? null,
    [channels, selected],
  );

  async function sendOtp() {
    if (!selected) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/assurance/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selected }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.error || "OTP_SEND_FAILED");
        setSending(false);
        return;
      }
      setChallengeId(payload.challengeId);
      setExpiresAt(payload.expiresAt ?? null);
      setCooldown(OTP_COOLDOWN_SECONDS);
      setCode("");
      setSending(false);
    } catch {
      setError(ar ? "حدث خطأ أثناء إرسال الرمز. حاول مجددًا." : "Erreur lors de l’envoi du code. Veuillez réessayer.");
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (!challengeId || code.length !== 6) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/assurance/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code,
          locale,
          next: search.get("next") || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          payload.error === "INVALID_CODE"
            ? (ar ? "رمز التحقق غير صحيح أو منتهي الصلاحية." : "Code de vérification incorrect ou expiré.")
            : payload.error || "OTP_VERIFY_FAILED",
        );
        setSending(false);
        return;
      }
      const destination = (typeof payload.redirectTo === "string" && payload.redirectTo) || next;
      router.replace(destination);
      router.refresh();
    } catch {
      setError(ar ? "حدث خطأ أثناء التحقق. حاول مجددًا." : "Erreur lors de la validation. Veuillez réessayer.");
      setSending(false);
    }
  }

  function handleBackToChannels() {
    setChallengeId(null);
    setCode("");
    setError(null);
  }

  if (loading) {
    return (
      <div className="auth-loading-state" style={{ padding: "40px 0", textAlign: "center" }}>
        <div className="button-spinner" style={{ margin: "0 auto 12px" }} />
        <p className="text-slate-500" style={{ fontSize: "0.88rem" }}>
          {ar ? "جارٍ استرداد وسائل الأمان المتاحة..." : "Chargement des options de sécurité..."}
        </p>
      </div>
    );
  }

  if (!channels.length) {
    return (
      <div className="form-error" role="alert">
        {ar ? "لا توجد قناة تحقق متاحة لحسابك." : "Aucun canal de vérification disponible pour votre compte."}
      </div>
    );
  }

  return (
    <div className="auth-form" aria-busy={sending}>
      {!challengeId ? (
        <>
          <div className="auth-channel-selector" role="radiogroup" aria-label={ar ? "طريقة التحقق" : "Canal de vérification"}>
            <span className="auth-channel-title">
              {ar ? "طريقة استلام رمز الأمان:" : "Mode d’envoi du code de sécurité :"}
            </span>
            <div className="auth-channel-grid">
              {channels.map((entry) => {
                const isEmail = entry.channel === "EMAIL";
                const isSelected = selected === entry.channel;
                return (
                  <button
                    type="button"
                    key={entry.channel}
                    role="radio"
                    aria-checked={isSelected}
                    className={`auth-channel-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelected(entry.channel)}
                  >
                    <div className="channel-icon-wrap">
                      <Icon name={isEmail ? "mail" : "phone"} size={18} />
                    </div>
                    <div className="channel-info">
                      <strong>{isEmail ? (ar ? "البريد الإلكتروني" : "Email sécurisé") : "WhatsApp"}</strong>
                      <small>{entry.destinationMasked}</small>
                    </div>
                    {isSelected && (
                      <span className="channel-check" aria-hidden="true">
                        <Icon name="check" size={13} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            className="btn btn-primary btn-block auth-submit-btn"
            type="button"
            onClick={sendOtp}
            disabled={!selected || sending}
          >
            {sending ? (
              ar ? "جارٍ إرسال الرمز..." : "Envoi du code..."
            ) : (
              <>
                <span>{ar ? "إرسال رمز التحقق" : "Envoyer le code de vérification"}</span>
                <span aria-hidden="true">{ar ? " ←" : " →"}</span>
              </>
            )}
          </button>
        </>
      ) : (
        <div className="auth-otp-box">
          <div className="auth-otp-header">
            <label htmlFor="auth-otp-input" className="auth-otp-label">
              <span>{ar ? "رمز التحقق السري (6 أرقام)" : "Code de vérification (6 chiffres)"}</span>
            </label>
            <span className="auth-otp-badge">
              <Icon name="clock" size={12} />
              <span>{ar ? "صالح لمدة 5 دقائق" : "Valable 5 minutes"}</span>
            </span>
          </div>

          <input
            id="auth-otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && code.length === 6 && !sending) {
                e.preventDefault();
                verifyOtp();
              }
            }}
            placeholder="••••••"
            className="auth-otp-input"
            autoFocus
          />

          <div className="auth-otp-meta">
            <span className="otp-destination">
              <Icon name={selectedChannel?.channel === "EMAIL" ? "mail" : "phone"} size={13} />
              <span>{selectedChannel?.destinationMasked}</span>
            </span>
            {expiresAt && (
              <span className="otp-expiry">
                <Icon name="clock" size={13} />
                <span>
                  {ar ? "ينتهي عند:" : "Expire à :"} {new Date(expiresAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </span>
            )}
          </div>

          <button
            className="btn btn-primary btn-block auth-submit-btn"
            type="button"
            onClick={verifyOtp}
            disabled={sending || code.length !== 6}
          >
            {sending ? (
              ar ? "جارٍ التحقق..." : "Vérification..."
            ) : (
              <>
                <span>{ar ? "تأكيد الرمز والمتابعة" : "Confirmer et accéder"}</span>
                <span aria-hidden="true">{ar ? " ←" : " →"}</span>
              </>
            )}
          </button>

          <div className="auth-otp-actions" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
            <button
              type="button"
              className="btn btn-ghost btn-block auth-back-step-btn"
              onClick={sendOtp}
              disabled={sending || cooldown > 0}
            >
              {cooldown > 0
                ? (ar ? `إعادة الإرسال متاحة خلال (${cooldown} ث)` : `Renvoyer disponible dans (${cooldown} s)`)
                : (ar ? "إعادة إرسال رمز جديد" : "Renvoyer un nouveau code")}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={handleBackToChannels}
              disabled={sending}
              style={{ marginTop: "4px", textAlign: "center" }}
            >
              {ar ? "← تغيير وسيلة الاستلام" : "← Changer de canal de réception"}
            </button>
          </div>
        </div>
      )}

      {error ? (
        <div className="form-error" role="alert" style={{ marginTop: "12px" }}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
