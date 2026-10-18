"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, AlertCircle, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import type { Locale } from "@/types";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";

export function ForgotPasswordWizard({ locale }: { locale: Locale }) {
  const ar = locale === "ar";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });

      if (res.status === 429) {
        setError(
          ar
            ? "تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً."
            : "Trop de tentatives. Veuillez patienter 15 minutes avant de réessayer.",
        );
        setLoading(false);
        return;
      }

      // Always display success state regardless of internal account presence (Anti-Enumeration)
      setSubmitted(true);
      setCooldown(60);
    } catch {
      setError(
        ar
          ? "حدث خطأ في الاتصال بالخادم. يرجى التحقق من اتصالك والمحاولة مجدداً."
          : "Erreur de connexion. Veuillez vérifier votre connexion et réessayer.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), locale }),
      });

      if (res.status === 429) {
        setError(
          ar
            ? "تم تجاوز الحد الأقصى للطلبات. يرجى الانتظار قليلاً."
            : "Trop de tentatives. Veuillez patienter avant de réessayer.",
        );
      } else {
        setCooldown(60);
      }
    } catch {
      setError(
        ar
          ? "تعذر إعادة إرسال الرابط. يرجى المحاولة لاحقاً."
          : "Impossible de renvoyer le lien. Veuillez réessayer.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="w-full animate-fade-in">
        <AuthWizardProgress
          currentStep={2}
          totalSteps={2}
          stepTitle={ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez vos e-mails"}
          stepSubtitle={
            ar
              ? `إذا كان البريد الإلكتروني (${email}) مرتبطاً بحساب، فقد أرسلنا إليه رابط إعادة التعيين السري (صالح 30 دقيقة).`
              : `Si un compte est associé à l'adresse e-mail (${email}), nous venons de vous envoyer un lien de réinitialisation sécurisé (valable 30 minutes).`
          }
          locale={locale}
        />

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 mb-8 space-y-1">
          <strong className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>{ar ? "نصيحة أمنية :" : "Conseil de sécurité :"}</span>
          </strong>
          <p>
            {ar
              ? "إذا لم تجد الرسالة في صندوق الوارد، يرجى التحقق من مجلد الرسائل غير المرغوب فيها (Spam)."
              : "Pensez à vérifier vos dossiers de courriers indésirables ou spams si le message n'apparaît pas dans quelques instants."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="w-full sm:w-auto h-12 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>
              {cooldown > 0
                ? ar
                  ? `إعادة الإرسال بعد ${cooldown} ثانية`
                  : `Renvoyer (${cooldown}s)`
                : ar
                ? "إعادة إرسال الرابط"
                : "Renvoyer l'e-mail"}
            </span>
          </button>

          <Link
            href={`/${locale}/connexion`}
            className="w-full sm:flex-1 h-12 px-6 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <span>{ar ? "العودة لتسجيل الدخول" : "Retour à la connexion"}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <AuthWizardProgress
        currentStep={1}
        totalSteps={2}
        stepTitle={ar ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}
        stepSubtitle={
          ar
            ? "أدخل عنوان بريدك الإلكتروني المسجل في الأكاديمية وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور."
            : "Entrez votre adresse e-mail associée à votre compte ANEI. Nous vous enverrons un lien de réinitialisation sécurisé."
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

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
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
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nom@exemple.com"
              className="w-full h-12 auth-input-with-icon !ps-11 pe-4 rounded-xl border border-slate-300 bg-white text-sm focus:border-[#0A192F] focus:ring-1 focus:ring-[#0A192F] outline-hidden transition-colors dir-ltr text-left"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#0056D2] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{ar ? "جارٍ إرسال الرابط..." : "Envoi en cours..."}</span>
              </>
            ) : (
              <>
                <span>{ar ? "إرسال رابط إعادة التعيين" : "Envoyer le lien de réinitialisation"}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </>
            )}
          </button>
        </div>

        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            href={`/${locale}/connexion`}
            className="text-xs font-semibold text-slate-500 hover:text-[#0A192F] inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>
              {ar
                ? "تذكرت كلمة المرور؟ العودة لتسجيل الدخول"
                : "Vous vous souvenez de votre mot de passe ? Connexion"}
            </span>
          </Link>
        </div>
      </form>
    </div>
  );
}
