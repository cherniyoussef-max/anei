import nodemailer from "nodemailer";
import { env } from "@/server/env";
import type { Locale } from "@/types";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

type Mail = { to: string; subject: string; text: string; html: string };
type AuthMailInput = { name: string; email: string; url: string; locale: Locale };

export async function sendMail(message: Mail) {
  try {
    await transporter.sendMail({ from: env.SMTP_FROM, ...message });
  } catch (error) {
    if (env.NODE_ENV === "production") throw error;
    // Authentication links/tokens must never be copied into application logs.
    console.warn("[ANEI mail fallback] SMTP unavailable", { subject: message.subject, to: message.to });
  }
}

export async function sendVerificationEmail(input: AuthMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const url = escapeHtml(input.url);
  await sendMail({
    to: input.email,
    subject: ar ? "تأكيد البريد الإلكتروني — ANEI" : "Vérifiez votre adresse e-mail — ANEI",
    text: ar
      ? `مرحباً ${input.name}، أكّد بريدك الإلكتروني عبر الرابط المرسل إليك.`
      : `Bonjour ${input.name}, confirmez votre adresse e-mail avec le lien reçu.`,
    html: emailFrame({
      dir: ar ? "rtl" : "ltr",
      title: ar ? "مرحباً بك في ANEI" : "Bienvenue à l’ANEI",
      greeting: ar ? `مرحباً ${name}،` : `Bonjour ${name},`,
      body: ar ? "أكّد عنوان بريدك الإلكتروني لتأمين حسابك." : "Confirmez votre adresse e-mail pour sécuriser votre compte.",
      action: ar ? "تأكيد بريدي الإلكتروني" : "Vérifier mon e-mail",
      url,
      footer: ar ? "إذا لم تنشئ هذا الحساب، يمكنك تجاهل هذه الرسالة." : "Si vous n’avez pas créé ce compte, ignorez ce message.",
    }),
  });
}

export async function sendResetEmail(input: AuthMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const url = escapeHtml(input.url);
  await sendMail({
    to: input.email,
    subject: ar ? "إعادة تعيين كلمة المرور — ANEI" : "Réinitialisation de votre mot de passe — ANEI",
    text: ar
      ? `مرحباً ${input.name}، تم طلب إعادة تعيين كلمة المرور لحسابك.`
      : `Bonjour ${input.name}, une réinitialisation de mot de passe a été demandée pour votre compte.`,
    html: emailFrame({
      dir: ar ? "rtl" : "ltr",
      title: ar ? "إعادة تعيين كلمة المرور" : "Réinitialisation du mot de passe",
      greeting: ar ? `مرحباً ${name}،` : `Bonjour ${name},`,
      body: ar ? "تم استلام طلب لإعادة تعيين كلمة مرور حسابك." : "Une demande de réinitialisation a été reçue pour votre compte.",
      action: ar ? "اختيار كلمة مرور جديدة" : "Choisir un nouveau mot de passe",
      url,
      footer: ar ? "إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة." : "Si vous n’êtes pas à l’origine de cette demande, ignorez ce message.",
    }),
  });
}

function emailFrame(input: { dir: "rtl" | "ltr"; title: string; greeting: string; body: string; action: string; url: string; footer: string }) {
  return `<div dir="${input.dir}" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10213a;line-height:1.6">
    <h2>${input.title}</h2>
    <p>${input.greeting}</p>
    <p>${input.body}</p>
    <p><a style="display:inline-block;background:#1769e0;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none" href="${input.url}">${input.action}</a></p>
    <p style="font-size:12px;color:#6b7280">${input.footer}</p>
  </div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char] ?? char);
}
