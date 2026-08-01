"use client";

import { FormEvent, useState } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

export function ContactForm({ locale }: { locale: Locale }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);

    setState(response?.ok ? "sent" : "error");
  }

  if (state === "sent") return <div className="form-success"><Icon name="check" size={24}/><strong>{locale === "fr" ? "Message envoyé" : "تم إرسال الرسالة"}</strong><p>{locale === "fr" ? "Merci. Notre équipe vous répondra via les coordonnées fournies." : "شكرًا. سيتواصل معك فريقنا عبر البيانات المقدمة."}</p></div>;

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="field-row"><label><span>{locale === "fr" ? "Nom complet" : "الاسم الكامل"}</span><input name="name" required placeholder={locale === "fr" ? "Votre nom" : "اسمك"}/></label><label><span>Email</span><input name="email" type="email" required placeholder="vous@exemple.com"/></label></div>
      <label><span>{locale === "fr" ? "Sujet" : "الموضوع"}</span><input name="subject" required placeholder={locale === "fr" ? "Comment pouvons-nous vous aider ?" : "كيف يمكننا مساعدتك؟"}/></label>
      <label><span>{locale === "fr" ? "Message" : "الرسالة"}</span><textarea name="message" required rows={6} placeholder={locale === "fr" ? "Décrivez votre demande..." : "اكتب طلبك..."}/></label>
      {state === "error" ? <small style={{ color: "#b42318" }}>{locale === "fr" ? "Envoi impossible. Réessayez." : "تعذر الإرسال. حاول مجددًا."}</small> : null}
      <button className="btn btn-primary" disabled={state === "sending"} type="submit">{state === "sending" ? (locale === "fr" ? "Envoi..." : "جارٍ الإرسال...") : (locale === "fr" ? "Envoyer le message" : "إرسال الرسالة")}<Icon name="arrow" size={18}/></button>
    </form>
  );
}
