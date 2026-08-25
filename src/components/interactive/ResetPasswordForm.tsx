"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/types";

export function ResetPasswordForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const ar = locale === "ar";
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const token = useMemo(() => (typeof window === "undefined" ? null : sessionStorage.getItem("anei_reset_authorization")), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setState("loading");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setState("error");
      return;
    }
    const result = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: password }),
    });
    if (!result.ok) {
      setState("error");
      return;
    }
    sessionStorage.removeItem("anei_reset_authorization");
    router.push(`/${locale}/login?reset=1`);
  }

  if (!token) return <div className="form-error">{ar ? "رمز إعادة التعيين غير متوفر. ابدأ من جديد." : "Autorisation de réinitialisation absente. Recommencez."}</div>;

  return <form className="auth-form" onSubmit={submit}><label><span>{ar ? "كلمة المرور الجديدة" : "Nouveau mot de passe"}</span><input name="password" type="password" minLength={15} maxLength={128} required autoComplete="new-password"/></label><label><span>{ar ? "تأكيد كلمة المرور" : "Confirmer le mot de passe"}</span><input name="confirm" type="password" minLength={15} maxLength={128} required autoComplete="new-password"/></label>{state === "error" ? <div className="form-error">{ar ? "تحقق من المدخلات وحاول مجددًا." : "Vérifiez les informations et réessayez."}</div> : null}<button className="btn btn-primary btn-block" disabled={state === "loading"}>{state === "loading" ? (ar ? "جارٍ الحفظ..." : "Enregistrement...") : (ar ? "حفظ كلمة المرور" : "Enregistrer le mot de passe")}</button></form>;
}
