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
      <div className="form-success bg-[#F4F7FA] border border-[#10b981]/30 rounded-2xl p-8 text-center space-y-3">
        <div className="w-14 h-14 bg-[#10b981]/10 text-[#059669] rounded-full mx-auto flex items-center justify-center font-bold">
          <Icon name="check" size={28} />
        </div>
        <strong className="text-xl font-bold text-slate-900 font-sans block">
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
    <form className="contact-form space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block text-xs font-bold text-[#1B3A5C] uppercase tracking-wider mb-1.5">
            {ar ? "الاسم الكامل" : en ? "Full name" : "Nom complet"}
          </span>
          <input
            name="name"
            required
            placeholder={ar ? "اسمك الكامل" : en ? "Your name" : "Votre nom complet"}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E3E8EF] bg-white text-sm text-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] transition-all placeholder:text-slate-400"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-bold text-[#1B3A5C] uppercase tracking-wider mb-1.5">
            {ar ? "البريد الإلكتروني" : en ? "Email address" : "Adresse e-mail"}
          </span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={ar ? "example@domaine.tn" : "name@example.com"}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E3E8EF] bg-white text-sm text-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] transition-all placeholder:text-slate-400"
          />
        </label>
      </div>
      <label className="block">
        <span className="block text-xs font-bold text-[#1B3A5C] uppercase tracking-wider mb-1.5">
          {ar ? "الموضوع" : en ? "Subject" : "Sujet"}
        </span>
        <input
          name="subject"
          required
          placeholder={ar ? "كيف يمكننا مساعدتك؟" : en ? "How can we help?" : "Comment pouvons-nous vous aider ?"}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E3E8EF] bg-white text-sm text-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] transition-all placeholder:text-slate-400"
        />
      </label>
      <label className="block">
        <span className="block text-xs font-bold text-[#1B3A5C] uppercase tracking-wider mb-1.5">
          {ar ? "الرسالة" : en ? "Message" : "Message"}
        </span>
        <textarea
          name="message"
          required
          rows={5}
          placeholder={ar ? "اكتب تفاصيل طلبك هنا..." : en ? "Describe your request..." : "Décrivez votre demande avec précision..."}
          className="w-full px-4 py-2.5 rounded-xl border border-[#E3E8EF] bg-white text-sm text-[#1B3A5C] focus:outline-none focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] transition-all placeholder:text-slate-400 resize-y"
        />
      </label>
      {state === "error" ? (
        <small className="block text-rose-700 text-xs font-semibold" role="alert">
          {ar ? "تعذر الإرسال. حاول مجددًا." : en ? "Unable to send. Please try again." : "Envoi impossible. Réessayez."}
        </small>
      ) : null}
      <button
        className="inline-flex items-center justify-center gap-2 py-3 px-8 bg-[#1B3A5C] hover:bg-[#24476E] text-white font-bold text-sm rounded-full transition-all shadow-xs active:scale-[0.98] disabled:opacity-70"
        disabled={state === "sending"}
        type="submit"
      >
        <span>
          {state === "sending"
            ? (ar ? "جارٍ الإرسال..." : en ? "Sending..." : "Envoi...")
            : (ar ? "إرسال الرسالة" : en ? "Send message" : "Envoyer le message")}
        </span>
        <Icon name="arrow" size={16} className="directional-icon" />
      </button>
    </form>
  );
}
