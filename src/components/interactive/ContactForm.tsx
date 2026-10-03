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
    const payload = { ...Object.fromEntries(form.entries()), locale };

    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => null);

    setState(response?.ok ? "sent" : "error");
  }

  if (state === "sent") {
    return (
      <div className="form-success bg-[#fcfbf8] border-2 border-[#10b981]/30 rounded-2xl p-8 text-center space-y-3">
        <div className="w-14 h-14 bg-[#10b981]/10 text-[#059669] rounded-full mx-auto flex items-center justify-center font-bold">
          <Icon name="check" size={28} />
        </div>
        <strong className="text-xl font-bold text-[#082d55] block">
          {ar ? "تم إرسال الرسالة بنجاح" : en ? "Message sent successfully" : "Message transmis avec succès"}
        </strong>
        <p className="text-slate-600 text-sm max-w-md mx-auto">
          {ar
            ? "شكرًا لتواصلكم. تم إرسال إشعار تلقائي إلى فريق الدعم وتم إرسال تأكيد استلام إلى بريدكم الإلكتروني. سنوافيكم بالرد في غضون 24-48 ساعة عمل."
            : en
            ? "Thank you for reaching out. An automatic notification was sent to our support desk and a confirmation receipt was sent to your inbox. We will reply within 24-48 business hours."
            : "Merci pour votre message. Une notification automatique a été transmise à notre pôle support et un accusé de réception vous a été envoyé par email. Notre équipe vous répondra sous 24 à 48 heures ouvrées."}
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="field-row"><label><span>{ar ? "الاسم الكامل" : en ? "Full name" : "Nom complet"}</span><input name="name" required placeholder={ar ? "اسمك" : en ? "Your name" : "Votre nom"}/></label><label><span>{ar ? "البريد الإلكتروني" : en ? "Email address" : "Adresse e-mail"}</span><input name="email" type="email" autoComplete="email" required placeholder={ar ? "example@domaine.tn" : "name@example.com"}/></label></div>
      <label><span>{ar ? "الموضوع" : en ? "Subject" : "Sujet"}</span><input name="subject" required placeholder={ar ? "كيف يمكننا مساعدتك؟" : en ? "How can we help?" : "Comment pouvons-nous vous aider ?"}/></label>
      <label><span>{ar ? "الرسالة" : en ? "Message" : "Message"}</span><textarea name="message" required rows={6} placeholder={ar ? "اكتب طلبك..." : en ? "Describe your request..." : "Décrivez votre demande..."}/></label>
      {state === "error" ? <small className="form-error" role="alert">{ar ? "تعذر الإرسال. حاول مجددًا." : en ? "Unable to send. Please try again." : "Envoi impossible. Réessayez."}</small> : null}
      <button className="btn btn-primary" disabled={state === "sending"} type="submit">{state === "sending" ? (ar ? "جارٍ الإرسال..." : en ? "Sending..." : "Envoi...") : (ar ? "إرسال الرسالة" : en ? "Send message" : "Envoyer le message")}<Icon name="arrow" size={18} className="directional-icon"/></button>
    </form>
  );
}
