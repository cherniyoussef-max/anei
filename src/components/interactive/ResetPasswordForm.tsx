"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import type { Locale } from "@/types";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const search = useSearchParams(); const router = useRouter(); const ar = locale === "ar";
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const token = search.get("token");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!token) return; setState("loading");
    const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) return setState("error");
    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) return setState("error");
    router.push(`/${locale}/login?reset=1`);
  }
  if (!token) return <div className="form-error">{ar ? "الرابط غير صالح أو منتهي الصلاحية." : "Ce lien est invalide ou expiré."}</div>;
  return <form className="auth-form" onSubmit={submit}><label><span>{ar ? "كلمة المرور الجديدة" : "Nouveau mot de passe"}</span><input name="password" type="password" minLength={10} required autoComplete="new-password"/></label><label><span>{ar ? "تأكيد كلمة المرور" : "Confirmer le mot de passe"}</span><input name="confirm" type="password" minLength={10} required autoComplete="new-password"/></label>{state === "error" ? <div className="form-error">{ar ? "تحقق من كلمتي المرور وحاول مجددًا." : "Vérifiez les deux mots de passe et réessayez."}</div> : null}<button className="btn btn-primary btn-block" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ كلمة المرور" : "Enregistrer le mot de passe")}</button></form>;
}
