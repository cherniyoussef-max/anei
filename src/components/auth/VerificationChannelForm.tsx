"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  MessageSquare,
  ShieldCheck,
  RotateCw,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { Locale } from "@/types";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";
import { OtpPinInput } from "@/components/auth/OtpPinInput";

type Channel = { channel: "EMAIL" | "WHATSAPP"; destinationMasked: string };

const OTP_COOLDOWN_SECONDS = 60;
const OTP_VALIDITY_SECONDS = 300; // 5 minutes

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
  const [remainingSeconds, setRemainingSeconds] = useState(OTP_VALIDITY_SECONDS);
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

  useEffect(() => {
    if (!challengeId) return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [challengeId]);

  const selectedChannel = useMemo(
    () => channels.find((entry) => entry.channel === selected) ?? null,
    [channels, selected],
  );

  function formatCountdown(totalSec: number) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

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
      setRemainingSeconds(OTP_VALIDITY_SECONDS);
      setCode("");
      setSending(false);
    } catch {
      setError(ar ? "حدث خطأ أثناء إرسال الرمز. حاول مجددًا." : "Erreur lors de l’envoi du code. Veuillez réessayer.");
      setSending(false);
    }
  }

  async function verifyOtp(overrideCode?: string) {
    const codeToVerify = overrideCode || code;
    if (!challengeId || codeToVerify.length !== 6) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/assurance/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: codeToVerify,
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
      <div className="w-full text-center py-16 animate-fade-in">
        <Loader2 className="w-8 h-8 animate-spin text-[#0056D2] mx-auto mb-4" />
        <p className="text-slate-500 text-sm font-medium">
          {ar ? "جارٍ استرداد خيارات الأمان..." : "Chargement des options de sécurité..."}
        </p>
      </div>
    );
  }

  if (!channels.length) {
    return (
      <div className="w-full animate-fade-in">
        <div role="alert" className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">
            {ar ? "لا توجد قناة تحقق متاحة لحسابك." : "Aucun canal de vérification disponible pour votre compte."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in" aria-busy={sending}>
      <AuthWizardProgress
        currentStep={2}
        totalSteps={2}
        stepTitle={ar ? "تأكيد جلسة العمل الآمنة (OTP)" : "Vérification de sécurité"}
        stepSubtitle={
          challengeId
            ? ar
              ? `أدخل رمز الأمان المكون من 6 أرقام المرسل إلى ${selectedChannel?.destinationMasked || ""}.`
              : `Saisissez le code de sécurité à 6 chiffres transmis à ${selectedChannel?.destinationMasked || ""}.`
            : ar
            ? "اختر وسيلة استلام الرمز المكون من 6 أرقام لتأكيد هويتك وتأمين حسابك."
            : "Choisissez un canal pour recevoir votre code à usage unique et sécuriser votre accès."
        }
        locale={locale}
      />

      {error ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50/80 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-2xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      {!challengeId ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <span className="block text-xs font-bold uppercase tracking-wider text-[#082d55] mb-2">
              {ar ? "طريقة استلام رمز الأمان :" : "Mode d’envoi du code de sécurité :"}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {channels.map((entry) => {
                const isEmail = entry.channel === "EMAIL";
                const isSelected = selected === entry.channel;
                return (
                  <button
                    type="button"
                    key={entry.channel}
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(entry.channel)}
                    className={`auth-channel-card p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 text-start cursor-pointer ${
                      isSelected
                        ? "is-selected border-[#082d55] bg-white shadow-xs text-[#082d55] ring-2 ring-[#082d55]/10"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 text-slate-700"
                    }`}
                  >
                    <div className={`channel-icon-wrap w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "bg-[#082d55] text-white"
                        : isEmail
                        ? "bg-blue-50 text-[#0056D2]"
                        : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {isEmail ? <Mail className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                    </div>
                    <div className="channel-info flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">
                        {isEmail ? (ar ? "البريد الإلكتروني" : "Email sécurisé") : "WhatsApp"}
                      </div>
                      <div className="text-xs text-slate-400 font-mono truncate mt-1">
                        {entry.destinationMasked}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-[#0056D2] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={sendOtp}
            disabled={!selected || sending}
            className="w-full h-12 rounded-xl bg-[#082d55] hover:bg-[#0056D2] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] disabled:opacity-40"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{ar ? "جارٍ إرسال الرمز..." : "Envoi du code..."}</span>
              </>
            ) : (
              <>
                <span>{ar ? "إرسال رمز التحقق" : "Envoyer le code de vérification"}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl p-6 bg-slate-50/70 border border-slate-200/80 shadow-2xs">
            {/* Professional Institutional Security Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
              <label htmlFor="auth-otp-input" className="block text-xs font-bold uppercase tracking-wider text-[#082d55]">
                {ar ? "رمز التحقق (6 أرقام)" : "Code de vérification"}
              </label>

              {/* Elevated Institutional Security Pill with Live Countdown */}
              <span className="auth-otp-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white text-slate-700 border border-slate-200/90 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0056D2] shrink-0" />
                <span className="font-semibold text-[#082d55]">
                  {ar ? "صالح لمدة 5 دقائق" : "Valable 5 minutes"}
                </span>
                <span className="text-slate-300 font-light" aria-hidden="true">•</span>
                <span className="font-mono text-[11px] text-slate-500 font-semibold tabular-nums">
                  {remainingSeconds > 0 ? formatCountdown(remainingSeconds) : (ar ? "انتهى" : "Expiré")}
                </span>
              </span>
            </div>

            {/* Segmented PIN Input (Stripe / Linear / Clerk Style) */}
            <div className="my-2">
              <OtpPinInput
                value={code}
                onChange={setCode}
                onComplete={(completedCode) => verifyOtp(completedCode)}
                disabled={sending}
                hasError={Boolean(error)}
                autoFocus
                id="auth-otp-input"
                ariaLabel={ar ? "رمز التحقق السري" : "Code de vérification à 6 chiffres"}
              />
            </div>

            {/* Contextual Masked Destination Info */}
            <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-2 font-medium">
                {selectedChannel?.channel === "EMAIL" ? (
                  <Mail className="w-3.5 h-3.5 text-[#0056D2]" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>{ar ? "المرسل إلى :" : "Transmis à :"}</span>
                <strong className="font-mono text-slate-700 font-semibold">{selectedChannel?.destinationMasked}</strong>
              </span>

              {expiresAt && (
                <span className="text-[11px] text-slate-400 font-mono">
                  {ar ? "ينتهي عند:" : "Expire à :"} {new Date(expiresAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => verifyOtp()}
            disabled={sending || code.length !== 6}
            className="w-full h-12 rounded-xl bg-[#082d55] hover:bg-[#0056D2] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] disabled:opacity-40"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{ar ? "جارٍ التحقق..." : "Vérification en cours..."}</span>
              </>
            ) : (
              <>
                <span>{ar ? "تأكيد الرمز والمتابعة" : "Confirmer et accéder"}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </>
            )}
          </button>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={sendOtp}
              disabled={sending || cooldown > 0}
              className="font-semibold text-[#0056D2] hover:underline disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${cooldown > 0 ? "" : "hover:rotate-180 transition-transform"}`} />
              <span>
                {cooldown > 0
                  ? (ar ? `إعادة الإرسال بعد (${cooldown} ثانية)` : `Renvoyer le code (${cooldown}s)`)
                  : (ar ? "إعادة إرسال رمز جديد" : "Renvoyer un nouveau code")}
              </span>
            </button>

            <button
              type="button"
              onClick={handleBackToChannels}
              disabled={sending}
              className="auth-link-btn text-slate-500 hover:text-[#082d55] inline-flex items-center gap-1.5 font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              <span>{ar ? "تغيير وسيلة الاستلام" : "Changer de canal"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
