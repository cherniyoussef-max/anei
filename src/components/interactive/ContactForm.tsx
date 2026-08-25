"use client";

import { FormEvent, useState } from "react";
import type { Locale } from "@/types";
import { Icon } from "@/components/ui/Icon";

export function ContactForm({ locale }: { locale: Locale }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const ar = locale === "ar";
  const en = locale === "en";

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

  if (state === "sent") return <div className="form-success"><Icon name="check" size={24}/><strong>{ar ? "تم إرسال الرسالة" : en ? "Message sent" : "Message envoyé"}</strong><p>{ar ? "شكرًا. سيتواصل معك فريقنا عبر البيانات المقدمة." : en ? "Thank you. Our team will reply using the contact details provided." : "Merci. Notre équipe vous répondra via les coordonnées fournies."}</p></div>;

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="field-row"><label><span>{ar ? "الاسم الكامل" : en ? "Full name" : "Nom complet"}</span><input name="name" required placeholder={ar ? "اسمك" : en ? "Your name" : "Votre nom"}/></label><label><span>Email</span><input name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></label></div>
      <label><span>{ar ? "الموضوع" : en ? "Subject" : "Sujet"}</span><input name="subject" required placeholder={ar ? "كيف يمكننا مساعدتك؟" : en ? "How can we help?" : "Comment pouvons-nous vous aider ?"}/></label>
      <label><span>{ar ? "الرسالة" : en ? "Message" : "Message"}</span><textarea name="message" required rows={6} placeholder={ar ? "اكتب طلبك..." : en ? "Describe your request..." : "Décrivez votre demande..."}/></label>
      {state === "error" ? <small className="form-error" role="alert">{ar ? "تعذر الإرسال. حاول مجددًا." : en ? "Unable to send. Please try again." : "Envoi impossible. Réessayez."}</small> : null}
      <button className="btn btn-primary" disabled={state === "sending"} type="submit">{state === "sending" ? (ar ? "جارٍ الإرسال..." : en ? "Sending..." : "Envoi...") : (ar ? "إرسال الرسالة" : en ? "Send message" : "Envoyer le message")}<Icon name="arrow" size={18}/></button>
    </form>
  );
}
