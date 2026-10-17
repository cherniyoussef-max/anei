"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";
import type { Locale } from "@/types";

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
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-10 shadow-xs text-center animate-fade-in">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-2xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-[#0A192F] mb-3 tracking-tight">
          {ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez vos e-mails"}
        </h1>

        <p className="text-slate-600 text-sm leading-relaxed mb-6 max-w-md mx-auto">
          {ar
            ? `إذا كان البريد الإلكتروني (${email}) مرتبطاً بحساب على المنصة، فقد أرسلنا إليه رابط إعادة التعيين السري. الرابط صالح لمدة 30 دقيقة.`
            : `Si un compte est associé à l'adresse e-mail (${email}), nous venons de vous envoyer un lien de réinitialisation sécurisé. Ce lien expire dans 30 minutes.`}
        </p>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 mb-8 max-w-md mx-auto text-start">
          <strong className="block font-semibold text-slate-700 mb-1">
            {ar ? "💡 نصيحة أمنية :" : "💡 Conseil de sécurité :"}
          </strong>
          {ar
            ? "إذا لم تجد الرسالة في صندوق الوارد، يرجى التحقق من مجلد الرسائل غير المرغوب فيها (Spam)."
            : "Pensez à vérifier vos dossiers de courriers indésirables ou spams si le message n'apparaît pas dans quelques instants."}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || loading}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-[#0A192F] hover:bg-[#082d55] text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs"
          >
            <span>{ar ? "العودة لتسجيل الدخول" : "Retour à la connexion"}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-10 shadow-xs animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-slate-100 flex items-center justify-center text-[#0A192F]">
          <Mail className="w-6 h-6 text-[#0A192F]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0A192F] tracking-tight mb-2">
          {ar ? "نسيت كلمة المرور؟" : "Mot de passe oublié ?"}
        </h1>
        <p className="text-slate-600 text-sm leading-relaxed max-w-md mx-auto">
          {ar
            ? "أدخل عنوان بريدك الإلكتروني المسجل في الأكاديمية وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور."
            : "Entrez votre adresse e-mail associée à votre compte ANEI. Nous vous enverrons un lien de réinitialisation sécurisé."}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            {ar ? "البريد الإلكتروني المسجل" : "Adresse e-mail enregistrée"} <span className="text-red-500">*</span>
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
              placeholder={ar ? "name@example.com" : "exemple@domaine.com"}
              className="w-full h-12 ps-10 pe-4 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:border-[#0056D2] focus:ring-2 focus:ring-[#0056D2]/15 transition-all shadow-2xs"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#082d55] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 hover:shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{ar ? "إرسال رابط إعادة التعيين" : "Envoyer le lien de réinitialisation"}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </>
          )}
        </button>

        <div className="pt-4 border-t border-slate-100 text-center">
          <Link
            href={`/${locale}/connexion`}
            className="text-xs font-semibold text-slate-500 hover:text-[#0A192F] inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            <span>{ar ? "تذكرت كلمة المرور؟ العودة لتسجيل الدخول" : "Vous vous souvenez de votre mot de passe ? Connexion"}</span>
          </Link>
        </div>
      </form>
    </div>
  );
}
