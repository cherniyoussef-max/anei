"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
        const retryAfterSeconds = typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : RESEND_COOLDOWN_SECONDS;
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
    <div className="auth-form" aria-busy={status === "sending"}>
      <div className="form-success" role="status">
        <strong>{ar ? "تحقق من بريدك الإلكتروني" : "Vérifiez votre adresse e-mail"}</strong>
        <p>
          {ar ? "أرسلنا رابط تحقق إلى:" : "Nous avons envoyé un lien de vérification à :"}
          <br />
          <strong>{maskEmail(email)}</strong>
        </p>
        <p>{ar ? "افتح بريدك الإلكتروني واضغط على الرابط." : "Consultez votre boîte de réception et cliquez sur le lien."}</p>
      </div>

      <button
        className="btn btn-primary btn-block"
        type="button"
        onClick={resend}
        disabled={status === "sending" || cooldown > 0}
      >
        {status === "sending"
          ? (ar ? "جارٍ الإرسال..." : "Envoi...")
          : status === "sent" && cooldown > 0
            ? (ar ? "تم إرسال البريد الإلكتروني ✓" : "E-mail renvoyé ✓")
            : (ar ? "إعادة إرسال البريد الإلكتروني" : "Renvoyer l’e-mail")}
      </button>
      {cooldown > 0 ? (
        <small role="status">{ar ? `إعادة الإرسال متاحة خلال ${cooldown} ثانية` : `Renvoyer disponible dans ${cooldown} s`}</small>
      ) : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="auth-help">
        <p>{ar ? "لم تستلم شيئًا؟" : "Vous n’avez rien reçu ?"}</p>
        <ul>
          <li>{ar ? "تحقق من مجلد الرسائل غير المرغوب فيها." : "Vérifiez vos courriers indésirables."}</li>
          <li>{ar ? "تأكد من صحة العنوان." : "Vérifiez que l’adresse est correcte."}</li>
          <li>{ar ? "انتظر بضع لحظات." : "Attendez quelques instants."}</li>
        </ul>
      </div>

      <Link className="btn btn-secondary btn-block" href={`/${locale}/login`}>
        {ar ? "استخدام حساب آخر" : "Utiliser un autre compte"}
      </Link>
    </div>
  );
}
