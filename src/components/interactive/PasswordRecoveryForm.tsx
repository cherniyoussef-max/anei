"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/types";

export function PasswordRecoveryForm({ locale }: { locale: Locale }) {
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const ar = locale === "ar";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("loading");
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const result = await authClient.requestPasswordReset({ email, redirectTo: `/${locale}/reset-password` });
    setState(result.error ? "error" : "sent");
  }
  if (state === "sent") return <div className="form-success"><strong>{ar ? "تحقق من بريدك الإلكتروني" : "Consultez votre boîte mail"}</strong><p>{ar ? "إذا كان الحساب موجودًا، ستصلك رسالة لإعادة تعيين كلمة المرور." : "Si le compte existe, un lien de réinitialisation vient d’être envoyé."}</p></div>;
  return <form className="auth-form" onSubmit={submit}><label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="vous@exemple.com"/></label>{state === "error" ? <div className="form-error">{ar ? "تعذر إرسال الطلب." : "Impossible d’envoyer la demande."}</div> : null}<button className="btn btn-primary btn-block" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الإرسال..." : "Envoi...") : (ar ? "إرسال رابط الاسترجاع" : "Envoyer le lien de récupération")}</button></form>;
}
