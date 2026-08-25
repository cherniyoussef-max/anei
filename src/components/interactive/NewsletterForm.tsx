"use client";
import { FormEvent, useState } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

export function NewsletterForm({ locale, idSuffix = "footer", variant = "compact" }: { locale: Locale; idSuffix?: string; variant?: "compact" | "expanded" }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const ar = locale === "ar";
  const en = locale === "en";
  const label = ar ? "البريد الإلكتروني" : en ? "Email address" : "Adresse e-mail";
  const action = ar ? "اشتراك" : en ? "Subscribe" : "S'abonner";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <p className="newsletter-success" role="status">{ar ? "تم تأكيد الاشتراك." : en ? "Subscription confirmed." : "Inscription confirmée."}</p>;

  return (
    <form className={`newsletter-form newsletter-form-${variant}`} onSubmit={submit} aria-busy={state === "loading"}>
      <label htmlFor={`newsletter-email-${locale}-${idSuffix}`}>{label}</label>
      <div className="newsletter-box">
        <input id={`newsletter-email-${locale}-${idSuffix}`} name="email" placeholder="name@example.com" type="email" autoComplete="email" required/>
        <button type="submit" disabled={state === "loading"} aria-label={action}>
          {variant === "expanded" ? <span>{action}</span> : null}
          <Icon className="directional-icon" name="arrow" size={18}/>
        </button>
      </div>
      <span className="newsletter-status" role="status" aria-live="polite">{state === "loading" ? (ar ? "جارٍ الاشتراك…" : en ? "Subscribing…" : "Inscription…") : ""}</span>
      {state === "error" ? <span className="newsletter-error" role="alert">{ar ? "تعذر الاشتراك. تحقق من العنوان وحاول مجددًا." : en ? "Subscription failed. Check the address and try again." : "L’inscription a échoué. Vérifiez l’adresse et réessayez."}</span> : null}
    </form>
  );
}
