"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Locale } from "@/types";

type Channel = { channel: "EMAIL" | "WHATSAPP"; destinationMasked: string };

export function VerificationChannelForm({ locale }: { locale: Locale }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState<"EMAIL" | "WHATSAPP" | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState<string | null>(null);
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
      const list = Array.isArray(payload.channels) ? payload.channels as Channel[] : [];
      setChannels(list);
      setSelected(list.length === 1 ? list[0].channel : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedChannel = useMemo(() => channels.find((entry) => entry.channel === selected) ?? null, [channels, selected]);

  async function sendOtp() {
    if (!selected) return;
    setSending(true);
    setError(null);
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
    setResendAt(payload.resendAvailableAt ?? null);
    setSending(false);
  }

  async function verifyOtp() {
    if (!challengeId || code.length !== 6) return;
    setSending(true);
    setError(null);
    const response = await fetch("/api/auth/assurance/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId, code }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(payload.error || "OTP_VERIFY_FAILED");
      setSending(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  if (loading) return <p>{ar ? "جارٍ التحميل..." : "Chargement..."}</p>;
  if (!channels.length) {
    return <div className="form-error" role="alert">{ar ? "لا توجد قناة تحقق متاحة." : "Aucun canal de vérification disponible."}</div>;
  }

  return (
    <div className="auth-form" aria-busy={sending}>
      <label>
        <span>{ar ? "اختر طريقة التحقق" : "Choisissez un canal de vérification"}</span>
        <select value={selected ?? ""} onChange={(event) => setSelected(event.target.value as "EMAIL" | "WHATSAPP")}> 
          <option value="" disabled>{ar ? "اختر" : "Sélectionner"}</option>
          {channels.map((entry) => (
            <option key={entry.channel} value={entry.channel}>
              {entry.channel === "EMAIL" ? "Email" : "WhatsApp"} — {entry.destinationMasked}
            </option>
          ))}
        </select>
      </label>

      <button className="btn btn-primary btn-block" type="button" onClick={sendOtp} disabled={!selected || sending}>
        {sending ? (ar ? "جارٍ الإرسال..." : "Envoi...") : (ar ? "إرسال رمز التحقق" : "Envoyer le code")}
      </button>

      {challengeId ? (
        <>
          <label>
            <span>{ar ? "رمز التحقق" : "Code de vérification"}</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
            />
          </label>
          <small>{selectedChannel ? `${selectedChannel.channel === "EMAIL" ? "Email" : "WhatsApp"}: ${selectedChannel.destinationMasked}` : null}</small>
          {expiresAt ? <small>{ar ? "انتهاء الصلاحية:" : "Expiration:"} {new Date(expiresAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN")}</small> : null}
          {resendAt ? <small>{ar ? "إعادة الإرسال بعد:" : "Renvoyer après:"} {new Date(resendAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN")}</small> : null}
          <button className="btn btn-primary btn-block" type="button" onClick={verifyOtp} disabled={sending || code.length !== 6}>
            {ar ? "تأكيد الرمز" : "Vérifier le code"}
          </button>
        </>
      ) : null}

      {error ? <div className="form-error" role="alert">{error}</div> : null}
    </div>
  );
}
