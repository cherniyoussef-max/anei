"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { Locale } from "@/types";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";

export function ResetPasswordWizard({ locale }: { locale: Locale }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ar = locale === "ar";

  const rawToken = searchParams.get("token") || searchParams.get("tokenHash") || "";
  const emailParam = searchParams.get("email") || "";

  const [checking, setChecking] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate token on client mount
  useEffect(() => {
    let isCancelled = false;

    async function checkToken() {
      if (!rawToken || rawToken.length < 24) {
        if (!isCancelled) {
          setChecking(false);
          setTokenValid(false);
          setTokenError("INVALID");
        }
        return;
      }

      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(rawToken)}`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => ({ valid: false }));

        if (!isCancelled) {
          setChecking(false);
          if (data.valid) {
            setTokenValid(true);
          } else {
            setTokenValid(false);
            setTokenError(data.error || "EXPIRED");
          }
        }
      } catch {
        if (!isCancelled) {
          setChecking(false);
          // If network check fails, allow user to attempt submission rather than blocking
          setTokenValid(true);
        }
      }
    }

    checkToken();
    return () => {
      isCancelled = true;
    };
  }, [rawToken]);

  // Visual Strength Calculation
  const strength = useMemo(() => {
    let score = 0;
    if (password.length >= 15) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password) || password.length >= 18) score += 1;

    let label = ar ? "ضعيفة جداً" : "Trop court";
    let colorClass = "bg-red-500";

    if (password.length < 15) {
      label = ar ? "أقل من 15 حرفاً" : "Moins de 15 caractères";
      colorClass = "bg-red-500";
    } else if (score <= 2) {
      label = ar ? "متوسطة" : "Moyen";
      colorClass = "bg-amber-500";
    } else if (score === 3) {
      label = ar ? "قوية" : "Fort";
      colorClass = "bg-[#0056D2]";
    } else if (score === 4) {
      label = ar ? "ممتازة" : "Excellent";
      colorClass = "bg-emerald-500";
    }

    return { score, label, colorClass };
  }, [password, ar]);

  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = password.length >= 15 && passwordsMatch && !loading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: rawToken, newPassword: password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.error === "RATE_LIMITED") {
          throw new Error(
            ar
              ? "محاولات كثيرة جداً. يُرجى الانتظار قليلاً قبل المحاولة مجدداً."
              : "Trop de tentatives. Veuillez patienter avant de réessayer.",
          );
        } else if (data.error === "PASSWORD_TOO_SHORT") {
          throw new Error(
            ar
              ? "يجب ألا تقل كلمة المرور عن 15 حرفاً."
              : "Le mot de passe doit comporter au moins 15 caractères.",
          );
        } else {
          throw new Error(
            ar
              ? "تعذر تحديث كلمة المرور. قد يكون الرابط منتهياً أو مستخدماً بالفعل."
              : "Impossible de réinitialiser le mot de passe. Le lien est peut-être expiré ou déjà utilisé.",
          );
        }
      }

      // Success feedback & redirect
      try {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
      } catch {}

      router.push(`/${locale}/connexion?reset=success`);
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : ar
          ? "حدث خطأ غير متوقع."
          : "Une erreur inattendue est survenue.",
      );
      setLoading(false);
    }
  }

  // 1. Loading Verification State
  if (checking) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-10 shadow-xs text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#0056D2] mx-auto mb-4" />
        <p className="text-slate-600 text-sm font-medium">
          {ar ? "جارٍ التحقق من صلاحية الرابط..." : "Vérification du lien de réinitialisation..."}
        </p>
      </div>
    );
  }

  // 2. Invalid or Expired Token State
  if (tokenValid === false) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-8 sm:p-10 shadow-xs text-center animate-fade-in">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold text-[#0A192F] mb-3 tracking-tight">
          {tokenError === "ALREADY_USED"
            ? ar
              ? "الرابط تم استخدامه بالفعل"
              : "Lien déjà utilisé"
            : ar
            ? "رابط غير صالح أو منتهي الصلاحية"
            : "Lien invalide ou expiré"}
        </h1>

        <p className="text-slate-600 text-sm leading-relaxed mb-8 max-w-md mx-auto">
          {tokenError === "ALREADY_USED"
            ? ar
              ? "تم استخدام رابط إعادة تعيين كلمة المرور هذا مسبقاً. إذا كنت بحاجة إلى تحديث كلمة المرور، يرجى تقديم طلب جديد."
              : "Ce lien de réinitialisation a déjà été consommé pour mettre à jour votre mot de passe. Vous pouvez faire une nouvelle demande si nécessaire."
            : ar
            ? "هذا الرابط لم يعد صالحاً أو انتهت مدة صلاحيته (صالحة لمدة 30 دقيقة). يُرجى تقديم طلب جديد للحصول على رابط صالح."
            : "Ce lien de réinitialisation n'est plus valide ou a expiré (durée de validité : 30 minutes). Veuillez effectuer une nouvelle demande pour recevoir un lien valide."}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={`/${locale}/mot-de-passe-oublie`}
            className="w-full sm:w-auto h-12 px-6 rounded-xl bg-[#0A192F] hover:bg-[#082d55] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs hover:shadow-sm"
          >
            <span>{ar ? "طلب رابط جديد لإعادة التعيين" : "Demander un nouveau lien de réinitialisation"}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>

          <Link
            href={`/${locale}/connexion`}
            className="w-full sm:w-auto h-12 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-semibold text-slate-700 text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <span>{ar ? "العودة لتسجيل الدخول" : "Retour à la connexion"}</span>
          </Link>
        </div>
      </div>
    );
  }

  // 3. Valid Token: Password Reset Form
  return (
    <div className="w-full animate-fade-in">
      <AuthWizardProgress
        currentStep={2}
        totalSteps={2}
        stepTitle={ar ? "كلمة مرور جديدة" : "Nouveau mot de passe"}
        stepSubtitle={
          ar
            ? "اختر كلمة مرور قوية لا تقل عن 15 حرفاً لتأمين حسابك على الأكاديمية."
            : "Choisissez un mot de passe robuste d'au moins 15 caractères pour sécuriser votre compte."
        }
        locale={locale}
      />
      {emailParam && (
        <p className="mb-6 -mt-4 text-xs font-semibold text-slate-500 font-mono">
          {emailParam}
        </p>
      )}

      {submitError ? (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3 shadow-xs"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{submitError}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Field 1: New Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            {ar ? "كلمة المرور الجديدة" : "Nouveau mot de passe"} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={ar ? "15 حرفاً على الأقل..." : "15 caractères minimum..."}
              className="w-full h-12 ps-10 pe-11 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none focus:border-[#0056D2] focus:ring-2 focus:ring-[#0056D2]/15 transition-all shadow-2xs"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* Visual Password Strength Gauge in 4 bars */}
          {password.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <div className="grid grid-cols-4 gap-1.5 h-1.5">
                {[1, 2, 3, 4].map((barIndex) => (
                  <div
                    key={barIndex}
                    className={`rounded-full transition-all duration-300 ${
                      barIndex <= strength.score ? strength.colorClass : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {ar ? "مستوى القوة :" : "Robustesse :"} <strong className="font-semibold text-slate-700">{strength.label}</strong>
                </span>
                <span>{password.length}/15 {ar ? "حرفاً" : "caractères"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Field 2: Confirm Password */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            {ar ? "تأكيد كلمة المرور الجديدة" : "Confirmer le nouveau mot de passe"} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 start-0 flex items-center ps-3.5 pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={ar ? "أعد كتابة كلمة المرور..." : "Retapez votre mot de passe..."}
              className={`w-full h-12 ps-10 pe-11 rounded-xl border bg-white text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:outline-none transition-all shadow-2xs ${
                confirmPassword.length > 0
                  ? passwordsMatch
                    ? "border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                    : "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/15"
                  : "border-slate-300 focus:border-[#0056D2] focus:ring-2 focus:ring-[#0056D2]/15"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute inset-y-0 end-0 flex items-center pe-3.5 text-slate-400 hover:text-slate-600 focus:outline-none"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {confirmPassword.length > 0 && (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              {passwordsMatch ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">
                    {ar ? "كلمتا المرور متطابقتان" : "Les mots de passe correspondent"}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-red-600 font-medium">
                    {ar ? "كلمتا المرور غير متطابقتين" : "Les mots de passe ne correspondent pas"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl bg-[#0A192F] hover:bg-[#082d55] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50 hover:shadow-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <span>{ar ? "حفظ كلمة المرور الجديدة" : "Enregistrer le nouveau mot de passe"}</span>
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
            <span>{ar ? "العودة لتسجيل الدخول" : "Retour à la connexion"}</span>
          </Link>
        </div>
      </form>
    </div>
  );
}
