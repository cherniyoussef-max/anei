"use client";

import { FormEvent, useState } from "react";
import type { Locale } from "@/types";

export function PasswordRecoveryForm({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<"EMAIL" | "WHATSAPP">("EMAIL");
  const [state, setState] = useState<"idle" | "requested" | "verifying" | "verified" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("requested");
    setMessage(null);
    const response = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, channel }),
    });
    if (!response.ok) {
      setState("error");
      setMessage(ar ? "تعذر إرسال الطلب." : "Impossible d'envoyer la demande.");
      return;
    }
    setMessage(ar ? "إذا كان الحساب مؤهلاً، تم إرسال رمز تحقق." : "Si un compte éligible existe, un code de vérification a été envoyé.");
  }

  async function verifyCode() {
    setState("verifying");
    const response = await fetch("/api/auth/password/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.resetAuthorizationToken) {
      setState("error");
      setMessage(ar ? "رمز غير صالح أو منتهي." : "Code invalide ou expiré.");
      return;
    }
    sessionStorage.setItem("anei_reset_authorization", String(payload.resetAuthorizationToken));
    setState("verified");
    window.location.assign(`/${locale}/reset-password`);
  }

  return (
    <div className="auth-form">
      <form onSubmit={request}>
        <label><span>Email</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>
        <label><span>{ar ? "قناة التحقق" : "Canal de vérification"}</span><select value={channel} onChange={(event) => setChannel(event.target.value as "EMAIL" | "WHATSAPP")}><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option></select></label>
        <button className="btn btn-primary btn-block" type="submit">{ar ? "إرسال رمز التحقق" : "Envoyer le code"}</button>
      </form>

      {state === "requested" || state === "verifying" || state === "error" ? (
        <>
          <label><span>{ar ? "رمز التحقق" : "Code"}</span><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} autoComplete="one-time-code" /></label>
          <button className="btn btn-primary btn-block" type="button" disabled={code.length !== 6 || state === "verifying"} onClick={verifyCode}>{ar ? "تأكيد الرمز" : "Vérifier le code"}</button>
        </>
      ) : null}

      {message ? <div className={state === "error" ? "form-error" : "form-success"} role="status">{message}</div> : null}
    </div>
  );
}
