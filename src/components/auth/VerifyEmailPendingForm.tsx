"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import type { Locale } from "@/types";
import { AuthWizardProgress } from "@/components/auth/AuthWizardProgress";

const RESEND_COOLDOWN_SECONDS = 45;

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const left = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${left}@${domain}`;
}

type Status = "idle" | "sending" | "sent" | "error";

export function VerifyEmailPendingForm({
  locale,
  email,
  hideHeader = false,
}: {
  locale: Locale;
  email: string;
  hideHeader?: boolean;
}) {
  const ar = locale === "ar";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const ArrowIcon = ar ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function resend() {
    if (cooldown > 0 || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const response = await fetch("/api/auth/verification/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const retryAfterSeconds =
          typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : RESEND_COOLDOWN_SECONDS;
        setCooldown(retryAfterSeconds);
        setStatus("error");
        setError(
          payload.error === "RESEND_COOLDOWN" || payload.error === "RATE_LIMITED"
            ? (ar ? "الرجاء الانتظار قبل إعادة الإرسال." : "Merci de patienter avant de renvoyer l’e-mail.")
            : (ar ? "تعذر إرسال البريد الإلكتروني حاليًا. حاول لاحقًا." : "Impossible d’envoyer l’e-mail pour le moment. Réessayez plus tard."),
        );
        return;
      }
      setStatus("sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setStatus("error");
      setError(ar ? "تعذر إرسال البريد الإلكتروني حاليًا. حاول لاحقًا." : "Impossible d’envoyer l’e-mail pour le moment. Réessayez plus tard.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  return (
    <div className="w-full">
      {!hideHeader && (
        <AuthWizardProgress
          currentStep={2}
          totalSteps={2}
          stepTitle={ar ? "تأكيد الحساب" : "Vérifiez votre boîte e-mail"}
          stepSubtitle={
            ar
              ? "أرسلنا رابط تفعيل آمن لتأكيد هويتك وتمكين الوصول إلى منصة التربية الدامجة."
              : "Un lien de confirmation sécurisé vous a été envoyé pour finaliser votre inscription."
          }
          locale={locale}
        />
      )}

      {/* Main Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs">
        {/* Email Highlight Box */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-5 text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#0056D2] mx-auto mb-3">
            <Mail className="w-6 h-6" />
          </div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            {ar ? "تم إرسال رابط التفعيل إلى" : "Lien de confirmation envoyé à"}
          </p>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-900 font-mono text-sm font-semibold shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>{maskEmail(email)}</span>
          </div>
          <p className="text-xs text-slate-500 mt-3 max-w-sm mx-auto leading-relaxed">
            {ar
              ? "افتح بريدك الإلكتروني واضغط على الرابط لتأكيد هويتك والوصول إلى فضاء التعلم."
              : "Consultez votre boîte de réception et cliquez sur le lien pour activer votre accès."}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs font-medium" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Success confirmation */}
        {status === "sent" && cooldown > 0 && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-800 text-xs font-medium" role="status">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{ar ? "تم إرسال رابط جديد بنجاح ✓" : "Nouveau lien envoyé avec succès ✓"}</span>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={resend}
          disabled={status === "sending" || cooldown > 0}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-sm font-semibold transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>{ar ? "جارٍ الإرسال..." : "Envoi en cours..."}</span>
            </>
          ) : status === "sent" && cooldown > 0 ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{ar ? "تم إرسال الرابط ✓" : "Lien renvoyé avec succès ✓"}</span>
            </>
          ) : cooldown > 0 ? (
            <>
              <RotateCcw className="w-4 h-4 text-slate-400" />
              <span>
                {ar ? `إعادة الإرسال متاحة (${cooldown} ث)` : `Renvoyer disponible (${cooldown} s)`}
              </span>
            </>
          ) : (
            <>
              <span>{ar ? "إعادة إرسال رابط التفعيل" : "Renvoyer l’e-mail de confirmation"}</span>
              <ArrowIcon className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Cooldown progress bar */}
        {cooldown > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-[#0056D2] transition-all duration-1000 ease-linear rounded-full"
                style={{ width: `${(cooldown / RESEND_COOLDOWN_SECONDS) * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400 text-center font-medium">
              {ar
                ? `يمكنك طلب رابط جديد بعد ${cooldown} ثانية`
                : `Nouveau lien disponible dans ${cooldown} secondes`}
            </p>
          </div>
        )}

        {/* Helpful Tips Section */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{ar ? "لم تستلم الرسالة بعد؟" : "Vous n’avez rien reçu ?"}</span>
          </p>
          <ul className="space-y-2 text-xs text-slate-500">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
              <span>{ar ? "تحقق من مجلد الرسائل غير المرغوب فيها (Spam / Courrier indésirable)." : "Vérifiez vos courriers indésirables ou le dossier Spam."}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
              <span>{ar ? "تأكد من كتابة البريد الإلكتروني بشكل صحيح." : "Vérifiez l’exactitude de l’adresse e-mail renseignée."}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0 mt-1.5" />
              <span>{ar ? "قد يستغرق التسليم دقيقة أو دقيقتين بحسب مزود البريد." : "La réception peut prendre 1 à 2 minutes selon votre fournisseur de messagerie."}</span>
            </li>
          </ul>
        </div>

        {/* Alternative Action */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <Link
            href={`/${locale}/login`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
          >
            {ar ? "استخدام حساب آخر أو تسجيل الدخول" : "Utiliser un autre compte / Se connecter"}
          </Link>
        </div>
      </div>
    </div>
  );
}
