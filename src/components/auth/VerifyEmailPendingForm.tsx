"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { Locale } from "@/types";

const RESEND_COOLDOWN_SECONDS = 45;

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const left = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${left}@${domain}`;
}

type Status = "idle" | "sending" | "sent" | "error";

export function VerifyEmailPendingForm({ locale, email }: { locale: Locale; email: string }) {
  const ar = locale === "ar";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

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
    <div className="auth-form auth-verify-flow" aria-busy={status === "sending"}>
      <div className="form-success auth-verify-highlight-card" role="status">
        <div className="auth-verify-icon-aura">
          <Icon name="mail" size={26} />
        </div>
        <div className="auth-verify-body">
          <strong className="auth-verify-heading">
            {ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez votre adresse e-mail"}
          </strong>
          <p className="auth-verify-subtext">
            {ar ? "أرسلنا رابط تحقق إلى:" : "Nous avons envoyé un lien de vérification à :"}
          </p>
          <div className="auth-verify-email-pill">
            <Icon name="shield" size={14} />
            <strong className="masked-email">{maskEmail(email)}</strong>
          </div>
          <p className="auth-verify-action-hint">
            {ar
              ? "افتح بريدك الإلكتروني واضغط على الرابط لتأكيد هويتك والوصول إلى حسابك."
              : "Consultez votre boîte de réception et cliquez sur le lien pour finaliser votre activation."}
          </p>
        </div>
      </div>

      <button
        className="btn btn-primary btn-block auth-submit-btn"
        type="button"
        onClick={resend}
        disabled={status === "sending" || cooldown > 0}
      >
        {status === "sending" ? (
          ar ? "جارٍ الإرسال..." : "Envoi en cours..."
        ) : status === "sent" && cooldown > 0 ? (
          ar ? "تم إرسال الرابط بنجاح ✓" : "Lien renvoyé avec succès ✓"
        ) : cooldown > 0 ? (
          ar ? `إعادة الإرسال متاحة (${cooldown} ث)` : `Renvoyer disponible (${cooldown} s)`
        ) : (
          <>
            <span>{ar ? "إعادة إرسال البريد الإلكتروني" : "Renvoyer l’e-mail de confirmation"}</span>
            <span aria-hidden="true">{ar ? " ←" : " →"}</span>
          </>
        )}
      </button>

      {cooldown > 0 ? (
        <div className="auth-cooldown-bar" role="status">
          <div
            className="auth-cooldown-progress"
            style={{ width: `${(cooldown / RESEND_COOLDOWN_SECONDS) * 100}%` }}
          />
          <small>
            {ar
              ? `يمكنك طلب رابط جديد بعد ${cooldown} ثانية`
              : `Nouvelle demande disponible dans ${cooldown} secondes`}
          </small>
        </div>
      ) : null}

      {error ? (
        <div className="form-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="auth-help auth-verify-tips">
        <p className="auth-verify-tips-title">{ar ? "لم تستلم الرسالة بعد؟" : "Vous n’avez rien reçu ?"}</p>
        <ul className="auth-verify-tips-list">
          <li>
            <Icon name="clock" size={13} />
            <span>{ar ? "تحقق من مجلد الرسائل غير المرغوب فيها (Spam)." : "Vérifiez vos courriers indésirables (Spam)."}</span>
          </li>
          <li>
            <Icon name="check" size={13} />
            <span>{ar ? "تأكد من صحة العنوان الإلكتروني المسجل أعلاه." : "Vérifiez l’exactitude de l’adresse ci-dessus."}</span>
          </li>
          <li>
            <Icon name="shield" size={13} />
            <span>{ar ? "قد يستغرق التسليم بضع دقائق بحسب مزود البريد." : "La réception peut prendre 1 à 2 minutes selon votre messagerie."}</span>
          </li>
        </ul>
      </div>

      <Link className="btn btn-secondary btn-block auth-secondary-btn" href={`/${locale}/login`}>
        {ar ? "استخدام حساب آخر" : "Utiliser un autre compte"}
      </Link>
    </div>
  );
}
