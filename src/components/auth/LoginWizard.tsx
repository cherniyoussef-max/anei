"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { Locale } from "@/types";
import { authClient } from "@/lib/auth-client";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";
import { GoogleMark } from "@/components/auth/GoogleMark";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";

type ChannelOption = { channel: "EMAIL" | "WHATSAPP"; destinationMasked: string };

export function LoginWizard({
  locale,
  googleConfigured,
}: {
  locale: Locale;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const ar = locale === "ar";

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Assurance OTP
  const [channels, setChannels] = useState<ChannelOption[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const nextParam = search.get("next");
  const destination = nextParam || `/${locale}/dashboard`;

  // Cooldown timer effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => setCooldown((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Load channels when entering Step 2
  async function loadAssuranceChannels() {
    try {
      const res = await fetch("/api/auth/assurance/channels", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.channels) ? (data.channels as ChannelOption[]) : [];
      setChannels(list);
      if (list.length > 0) {
        setSelectedChannel(list[0].channel);
      }
    } catch {
      // Non-blocking fallback
    }
  }

  // Handle Google OAuth
  async function handleGoogle() {
    if (googleLoading || loading) return;
    setGoogleLoading(true);
    setError(null);

    try {
      const errorCallbackURL = `/${locale}/connexion?${new URLSearchParams({
        error: "google_auth_failed",
        next: destination,
      })}`;

      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL: destination,
        errorCallbackURL,
      });

      if (res?.error) {
        throw new Error(res.error.message || "GOOGLE_AUTH_ERROR");
      }
    } catch {
      setError(
        ar
          ? "تعذر تسجيل الدخول باستخدام حساب Google. يُرجى استخدام البريد الإلكتروني."
          : "Échec de connexion avec Google. Veuillez utiliser votre adresse e-mail.",
      );
      setGoogleLoading(false);
    }
  }

  // Handle Step 1 Credentials Submit
  async function handleCredentialsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          router.push(`/${locale}/verify-email?email=${encodeURIComponent(email.trim())}`);
          return;
        }
        throw new Error(
          ar
            ? "البريد الإلكتروني أو كلمة المرور غير صحيحة."
            : "Adresse e-mail ou mot de passe incorrect.",
        );
      }

      // Track login analytics and check if session assurance is required
      const trackingRes = await fetch("/api/auth/login-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, next: destination }),
      });

      const trackingData = await trackingRes.json().catch(() => ({}));

      if (trackingData.requiresAssurance) {
        setStep(2);
        setLoading(false);
        await loadAssuranceChannels();
        return;
      }

      // Successful direct login
      const target = trackingData.redirectUrl || destination;
      router.push(target);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : ar
          ? "تعذر تسجيل الدخول."
          : "Impossible de vous connecter.",
      );
      setLoading(false);
    }
  }

  // Handle OTP Dispatch
  async function handleSendOtp() {
    setSendingOtp(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/assurance/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: selectedChannel }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error === "RATE_LIMITED"
            ? ar
              ? "تم تجاوز الحد الأقصى للمحاولات. يرجى الانتظار."
              : "Trop de tentatives. Veuillez patienter avant de réessayer."
            : ar
            ? "تعذر إرسال رمز التحقق."
            : "Échec de l'envoi du code de sécurité.",
        );
      }

      setChallengeId(data.challengeId);
      setOtpSent(true);
      setCooldown(60);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : ar
          ? "تعذر إرسال الرمز."
          : "Impossible d'envoyer le code.",
      );
    } finally {
      setSendingOtp(false);
    }
  }

  // Handle Step 2 OTP Verification
  async function handleVerifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!challengeId || otpCode.trim().length !== 6) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/assurance/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId,
          code: otpCode.trim(),
          locale,
          next: destination,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          ar
            ? "رمز التحقق غير صحيح أو منتهي الصلاحية."
            : "Code de vérification invalide ou expiré.",
        );
      }

      const target = data.redirectTo || destination;
      router.push(target);
      router.refresh();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : ar
          ? "فشل تأكيد الرمز."
          : "La validation du code a échoué.",
      );
      setLoading(false);
    }
  }

  const stepMeta = useMemo(() => {
    if (step === 1) {
      return {
        title: ar ? "مرحبًا بعودتك إلى أكاديمية ANEI" : "Bon retour sur l'Académie ANEI",
        subtitle: ar
          ? "سجّل دخولك للوصول إلى مساحتك التعليمية، لوحة تحكم الممارس أو إدارة المنصة."
          : "Accédez à votre espace d'apprentissage, à votre console praticien ou à l'administration.",
      };
    }
    return {
      title: ar ? "تأكيد جلسة العمل الآمنة (OTP)" : "Vérification d'Assurance OTP",
      subtitle: ar
        ? "اختر وسيلة استلام الرمز المكون من 6 أرقام لتأمين دخولك الإداري والمتقدم."
        : "Choisissez un canal pour recevoir votre code à usage unique (valable 5 minutes) et sécuriser votre accès.",
    };
  }, [step, ar]);

  return (
    <div className="w-full">
      <AuthWizardProgress
        currentStep={step}
        totalSteps={2}
        stepTitle={stepMeta.title}
        stepSubtitle={stepMeta.subtitle}
        locale={locale}
      />

      {search.get("reset") === "success" && !error && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex items-start gap-3 shadow-xs"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">
            {ar
              ? "تمت إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول."
              : "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."}
          </div>
        </div>
      )}

      {error ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      {/* ========================================================= */}
      {/* STEP 1: IDENTIFICATION (GOOGLE + EMAIL/PASSWORD)          */}
      {/* ========================================================= */}
      {step === 1 && (
        <div>
          {googleConfigured && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
                className="w-full h-12 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-800 text-sm flex items-center justify-center gap-3 transition-colors shadow-2xs disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                ) : (
                  <GoogleMark />
                )}
                <span>
                  {googleLoading
                    ? ar
                      ? "جارٍ الاتصال بـ Google..."
                      : "Connexion à Google..."
                    : ar
                    ? "المتابعة باستخدام Google"
                    : "Continuer avec Google"}
                </span>
              </button>

              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 uppercase tracking-wider">
                  {ar ? "أو باستخدام البريد الإلكتروني" : "ou avec votre adresse e-mail"}
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleCredentialsSubmit} className="auth-form space-y-5" noValidate>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                {ar ? "البريد الإلكتروني" : "Adresse e-mail"} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full h-12 ps-10 pe-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {ar ? "كلمة المرور" : "Mot de passe"} <span className="text-red-500">*</span>
                </label>
                <Link
                  href={`/${locale}/mot-de-passe-oublie`}
                  className="text-xs font-semibold text-[#0056D2] hover:underline"
                >
                  {ar ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••••••••"
                  className="w-full h-12 ps-10 pe-11 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{ar ? "جارٍ تسجيل الدخول..." : "Connexion en cours..."}</span>
                  </>
                ) : (
                  <>
                    <span>{ar ? "تسجيل الدخول" : "Se connecter"}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* STEP 2: ASSURANCE OTP VERIFICATION (IN LAYOUT)           */}
      {/* ========================================================= */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {ar ? "قناة استلام رمز الأمان" : "Canal de réception"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setSelectedChannel("EMAIL")}
                className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedChannel === "EMAIL"
                    ? "border-[#0A192F] bg-white shadow-2xs font-semibold text-[#0A192F]"
                    : "border-slate-200 bg-white/60 text-slate-600"
                }`}
              >
                <Mail className="w-4 h-4 text-[#0056D2]" />
                <div className="text-xs">
                  <div className="font-bold">E-mail</div>
                  <div className="text-[11px] text-slate-400">
                    {channels.find((c) => c.channel === "EMAIL")?.destinationMasked || email}
                  </div>
                </div>
              </div>

              <div
                onClick={() => setSelectedChannel("WHATSAPP")}
                className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  selectedChannel === "WHATSAPP"
                    ? "border-[#0A192F] bg-white shadow-2xs font-semibold text-[#0A192F]"
                    : "border-slate-200 bg-white/60 text-slate-600"
                }`}
              >
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <div className="text-xs">
                  <div className="font-bold">WhatsApp</div>
                  <div className="text-[11px] text-slate-400">
                    {channels.find((c) => c.channel === "WHATSAPP")?.destinationMasked || "+216 •••"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp || cooldown > 0}
                className="text-xs font-bold text-[#0056D2] hover:underline disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{ar ? "جارٍ الإرسال..." : "Envoi du code..."}</span>
                  </>
                ) : cooldown > 0 ? (
                  <span>
                    {ar
                      ? `إعادة الإرسال بعد ${cooldown} ثانية`
                      : `Renvoyer dans ${cooldown}s`}
                  </span>
                ) : (
                  <span>{otpSent ? (ar ? "إعادة إرسال الرمز" : "Renvoyer le code") : (ar ? "إرسال رمز التحقق الآن" : "Envoyer le code maintenant")}</span>
                )}
              </button>

              {otpSent && (
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{ar ? "تم إرسال الرمز" : "Code envoyé"}</span>
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5 text-center">
                {ar ? "أدخل الرمز المكون من 6 أرقام" : "Saisissez le code à 6 chiffres"} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="w-full h-14 rounded-xl border border-slate-300 bg-white text-center text-2xl font-mono tracking-[0.3em] focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-semibold text-slate-500 hover:text-[#0A192F] transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
                <span>{ar ? "الرجوع" : "Retour"}</span>
              </button>

              <button
                type="submit"
                disabled={loading || otpCode.trim().length !== 6 || !challengeId}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm px-7 py-3.5 shadow-xs transition-all disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{ar ? "جارٍ التحقق..." : "Vérification..."}</span>
                  </>
                ) : (
                  <>
                    <span>{ar ? "تأكيد والدخول" : "Valider et accéder"}</span>
                    <ShieldCheck className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
