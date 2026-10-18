"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail,
  MessageSquare,
  Clock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { Locale } from "@/types";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";

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
        stepTitle={ar ? "تأكيد جلسة العمل الآمنة (OTP)" : "Code de vérification"}
        stepSubtitle={
          challengeId
            ? ar
              ? `أدخل رمز الأمان المكون من 6 أرقام المرسل إلى ${selectedChannel?.destinationMasked || ""}.`
              : `Entrez le code de sécurité à 6 chiffres envoyé à ${selectedChannel?.destinationMasked || ""}.`
            : ar
            ? "اختر طريقة استلام رمز أمان لمرة واحدة (صالح لمدة 5 دقائق) لتأكيد جلستك وحماية حسابك."
            : "Choisissez un canal pour recevoir votre code à usage unique (valable 5 minutes) et sécuriser votre accès."
        }
        locale={locale}
      />

      {error ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      {!challengeId ? (
        <div className="space-y-6">
          <div className="space-y-3">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
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
                    className={`p-4 rounded-xl border-2 transition-all flex items-center gap-3 text-start ${
                      isSelected
                        ? "border-[#0A192F] bg-white shadow-2xs text-[#0A192F]"
                        : "border-slate-200 bg-white hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isEmail ? "bg-blue-50 text-[#0056D2]" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      {isEmail ? <Mail className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight">
                        {isEmail ? (ar ? "البريد الإلكتروني" : "Email sécurisé") : "WhatsApp"}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                        {entry.destinationMasked}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-[#0056D2] shrink-0" />
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
            className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-40"
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
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="auth-otp-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                {ar ? "رمز التحقق السري (6 أرقام)" : "Code de vérification (6 chiffres)"} <span className="text-red-500">*</span>
              </label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                <Clock className="w-3 h-3 text-amber-600" />
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
              className="w-full h-14 text-center tracking-[0.5em] text-2xl font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-all shadow-2xs"
              autoFocus
            />

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {selectedChannel?.channel === "EMAIL" ? <Mail className="w-3.5 h-3.5" /> : <MessageSquare className="w-3.5 h-3.5" />}
                <span className="font-mono">{selectedChannel?.destinationMasked}</span>
              </span>
              {expiresAt && (
                <span className="text-[11px] text-slate-400">
                  {ar ? "ينتهي عند:" : "Expire à :"} {new Date(expiresAt).toLocaleTimeString(locale === "ar" ? "ar-TN" : "fr-TN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={verifyOtp}
            disabled={sending || code.length !== 6}
            className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-40"
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

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={sendOtp}
              disabled={sending || cooldown > 0}
              className="font-semibold text-[#0056D2] hover:underline disabled:opacity-50"
            >
              {cooldown > 0
                ? (ar ? `إعادة الإرسال بعد (${cooldown} ثانية)` : `Renvoyer le code (${cooldown}s)`)
                : (ar ? "إعادة إرسال رمز جديد" : "Renvoyer un nouveau code")}
            </button>

            <button
              type="button"
              onClick={handleBackToChannels}
              disabled={sending}
              className="text-slate-500 hover:text-[#0A192F] inline-flex items-center gap-1 font-semibold transition-colors"
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
