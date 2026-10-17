import crypto from "node:crypto";
import nodemailer from "nodemailer";
import { env } from "@/server/env";
import { logger } from "@/server/security/logger";
import { getProviderMeta } from "@/lib/webinars";
import type { Locale } from "@/types";

const transporter = nodemailer.createTransport(
  {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: {
      sessionIdContext: crypto.randomBytes(16).toString("hex"),
    },
  },
  {
    disableFileAccess: true,
    disableUrlAccess: true,
  },
);

type Mail = { to: string; subject: string; text: string; html: string };
type AuthMailInput = { name: string; email: string; url: string; locale: Locale };
export type MailType =
  | "EMAIL_VERIFICATION"
  | "PASSWORD_RESET"
  | "OTP"
  | "WEBINAR_ACCESS_PASS"
  | "CARE_ALERT"
  | "CONTACT_INQUIRY"
  | "CONTACT_CONFIRMATION"
  | "BOOKING_ESCROW"
  | "PRACTITIONER_BOOKING_ALERT"
  | "BOOKING_CONFIRMED"
  | "BOOKING_DECLINED";

/**
 * Sanitized failure category, safe to log and safe to report externally.
 * Shared with scripts/verify-smtp.ts so the two never drift.
 */
export type MailErrorCategory =
  | "AUTH_FAILED"
  | "CONNECTION_REFUSED"
  | "TLS_ERROR"
  | "DNS_ERROR"
  | "SENDER_REJECTED"
  | "UNAUTHORIZED_IP"
  | "TIMEOUT"
  | "UNKNOWN";

export function categorizeMailError(error: unknown): MailErrorCategory {
  const details = error as { code?: string; responseCode?: number; response?: string; message?: string } | null;
  const response = details?.response ?? details?.message ?? "";
  if (details?.responseCode === 525 || /unauthorized ip/i.test(response)) return "UNAUTHORIZED_IP";
  if (details?.code === "EAUTH") return "AUTH_FAILED";
  if (details?.code === "ECONNREFUSED") return "CONNECTION_REFUSED";
  if (details?.code === "ETIMEDOUT") return "TIMEOUT";
  if (details?.code === "ESOCKET" || /tls|ssl/i.test(response)) return "TLS_ERROR";
  if (details?.code === "EDNS" || details?.code === "ENOTFOUND") return "DNS_ERROR";
  if (details?.responseCode && details.responseCode >= 500 && details.responseCode < 600) return "SENDER_REJECTED";
  return "UNKNOWN";
}

function maskRecipient(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "***";
  return `${local[0] ?? "*"}***@${domain}`;
}

export async function sendMail(message: Mail, type: MailType) {
  const recipient = maskRecipient(message.to);
  logger.info("mail.send.started", { type, recipient, provider: env.SMTP_HOST });
  try {
    const result = await transporter.sendMail({ from: env.SMTP_FROM, ...message });
    logger.info("mail.send.succeeded", {
      type,
      recipient,
      provider: env.SMTP_HOST,
      messageId: result.messageId,
      accepted: result.accepted?.length ?? 0,
      rejected: result.rejected?.length ?? 0,
    });
  } catch (error) {
    const category = categorizeMailError(error);
    logger.error("mail.send.failed", { type, recipient, provider: env.SMTP_HOST, category });
    if (env.NODE_ENV === "production") throw error;
    // Authentication links/tokens must never be copied into application logs.
    console.warn("[ANEI mail fallback] SMTP unavailable", { subject: message.subject, to: recipient });
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
  }, "EMAIL_VERIFICATION");
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
  }, "PASSWORD_RESET");
}

export type OtpMailInput = { name: string; email: string; code: string; locale: Locale };

export async function sendOtpEmail(input: OtpMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const code = escapeHtml(input.code);
  const isRtl = ar;
  const alt = isRtl ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive";
  const logoUrl = `${env.APP_URL}/brand/anei-logo-2x-transparent.png`;

  const html = `<div dir="${isRtl ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10213a;line-height:1.6;background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-radius:12px">
    <div style="margin-bottom:20px;text-align:${isRtl ? "right" : "left"}">
      <img src="${logoUrl}" alt="${alt}" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
    </div>
    <h2 style="color:#082d55;margin-top:0">${ar ? "رمز التحقق من الحساب" : "Votre code de vérification"}</h2>
    <p>${ar ? `مرحباً ${name}،` : `Bonjour ${name},`}</p>
    <p>${ar ? "استخدم هذا الرمز السري المؤقت لتأكيد هويتك واستكمال طلبك:" : "Utilisez le code temporaire ci-dessous pour confirmer votre identité et sécuriser votre accès :"}</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;letter-spacing:8px;font-size:32px;font-weight:bold;color:#082d55;background:#f1f5f9;padding:12px 24px;border-radius:10px;border:1px dashed #cbd5e1;font-family:monospace">${code}</span>
    </div>
    <p style="font-size:14px;color:#475569">${ar ? "⚠️ هذا الرمز صالح لمدة 5 دقائق فقط ومخصص للاستخدام لمرة واحدة." : "⚠️ Ce code est valable pendant 5 minutes et à usage unique. Ne le partagez pas."}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:12px;color:#6b7280;margin:0">${ar ? "إذا لم تكن صاحب هذا الطلب، يمكنك تجاهل هذه الرسالة بأمان." : "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer ce message."}</p>
  </div>`;

  await sendMail({
    to: input.email,
    subject: ar ? "رمز التحقق الخاص بك — ANEI" : "Votre code de vérification — ANEI",
    text: ar
      ? `مرحباً ${input.name}، رمز التحقق الخاص بك هو: ${input.code} (صالح لمدة 5 دقائق).`
      : `Bonjour ${input.name}, votre code de vérification ANEI est : ${input.code} (valable 5 minutes).`,
    html,
  }, "OTP");
}

function emailFrame(input: { dir: "rtl" | "ltr"; title: string; greeting: string; body: string; action: string; url: string; footer: string }) {
  const isRtl = input.dir === "rtl";
  const alt = isRtl ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive";
  const logoUrl = `${env.APP_URL}/brand/anei-logo-2x-transparent.png`;
  return `<div dir="${input.dir}" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#10213a;line-height:1.6;background:#ffffff;padding:28px 24px;border:1px solid #e2e8f0;border-top:4px solid #082d55;border-radius:12px">
    <div style="margin-bottom:20px;text-align:${isRtl ? "right" : "left"}">
      <img src="${logoUrl}" alt="${alt}" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
    </div>
    <div style="margin-bottom:12px">
      <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#c9913f;background:#fdfbf7;border:1px solid #f3e8d2;padding:4px 10px;border-radius:999px">${isRtl ? "المصادقة الرسمية · الأكاديمية" : "AUTHENTIFICATION OFFICIELLE · ANEI"}</span>
    </div>
    <h2 style="color:#082d55;margin:0 0 16px 0;font-size:22px;font-weight:700">${input.title}</h2>
    <p style="font-size:15px;margin:0 0 12px 0;color:#1e293b">${input.greeting}</p>
    <p style="font-size:15px;margin:0 0 24px 0;color:#334155;line-height:1.6">${input.body}</p>
    <div style="text-align:${isRtl ? "right" : "left"};margin:24px 0">
      <a style="display:inline-block;background:#082d55;color:#ffffff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;box-shadow:0 4px 12px rgba(8,45,85,0.18)" href="${input.url}">${input.action} ${isRtl ? "←" : "→"}</a>
    </div>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin:24px 0;font-size:12px;color:#64748b;word-break:break-all">
      <strong style="display:block;color:#334155;margin-bottom:4px">${isRtl ? "أو انسخ الرابط الآمن وألصقه في متصفحك:" : "Ou copiez et collez ce lien sécurisé dans votre navigateur :"}</strong>
      <span style="color:#082d55;font-family:monospace">${input.url}</span>
    </div>
    <p style="font-size:13px;color:#64748b;margin:0 0 20px 0">${isRtl ? "🔒 هذا الرابط سري ومؤقت لأسباب أمنية. لا تشاركه مع أي شخص." : "🔒 Ce lien est sécurisé, confidentiel et à usage temporaire."}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
    <p style="font-size:12px;color:#94a3b8;margin:0;line-height:1.5">${input.footer}<br /><strong>${isRtl ? "الأكاديمية الوطنية للتربية الدامجة (ANEI)" : "Académie Nationale de l’Éducation Inclusive (ANEI)"}</strong></p>
  </div>`;
}

export interface WebinarPassMailInput {
  name: string;
  email: string;
  webinarTitle: string;
  startsAt: Date;
  meetingProvider: string;
  accessCode: string;
  joinUrl: string;
  locale?: Locale;
}

export async function sendWebinarAccessPassMail(input: WebinarPassMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const title = escapeHtml(input.webinarTitle);
  const code = escapeHtml(input.accessCode);
  const url = escapeHtml(input.joinUrl);
  const providerMeta = getProviderMeta(input.meetingProvider);
  const providerLabel = ar ? providerMeta.nameAr : providerMeta.name;
  const isInPerson = providerMeta.id === "in_person";
  const btnBg = providerMeta.id === "teams" ? "#5059C9" : providerMeta.id === "zoom" ? "#0B5CFF" : "#00796B";
  const formattedDate = new Intl.DateTimeFormat(ar ? "ar-TN" : "fr-FR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(input.startsAt));

  await sendMail(
    {
      to: input.email,
      subject: ar
        ? `تأكيد تسجيلك ورمز الدخول إلى الندوة: ${input.webinarTitle} — ANEI`
        : `Votre pass d'accès & code de connexion : ${input.webinarTitle} — ANEI`,
      text: ar
        ? `مرحباً ${input.name}، تم قبول تسجيلك في الندوة: ${input.webinarTitle}.\nموعد الجلسة: ${formattedDate}\nرمز الدخول الخاص بك (استخدام فردي): ${input.accessCode}\n${isInPerson ? "الجلسة حضورية في عين المكان المحدد." : `رابط الانضمام: ${input.joinUrl}`}`
        : `Bonjour ${input.name}, votre inscription au webinaire "${input.webinarTitle}" est confirmée.\nDate de la session : ${formattedDate}\nVotre code d'accès unique : ${input.accessCode}\n${isInPerson ? "Session en présentiel au lieu indiqué." : `Lien pour rejoindre la réunion : ${input.joinUrl}`}`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:20px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="${ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 20px;border-radius:8px;color:#082d55;text-align:center;margin-bottom:20px">
          <h1 style="margin:0;font-size:18px;color:#082d55">${ar ? "بطاقة الدخول إلى الندوة" : "Pass Webinaire · Académie ANEI"}</h1>
        </div>
        <h2 style="color:#082d55;font-size:18px;margin-top:0">${ar ? "تم تأكيد تسجيلك بنجاح !" : "Votre inscription est validée !"}</h2>
        <p style="font-size:15px">${ar ? `مرحباً <strong>${name}</strong>،` : `Bonjour <strong>${name}</strong>,`}</p>
        <p style="font-size:15px">${ar ? `يسرنا تأكيد مشاركتك في الندوة التفاعلية:` : `Nous avons le plaisir de vous confirmer votre place pour la session :`}</p>
        <div style="background:#f8fafc;border-left:4px solid #082d55;padding:12px 16px;margin:16px 0;border-radius:4px">
          <strong style="display:block;font-size:16px;color:#082d55">${title}</strong>
          <span style="color:#64748b;font-size:14px">${formattedDate} · ${isInPerson ? (ar ? "حضورياً" : "En présentiel") : `${ar ? "مباشرة عبر" : "En direct sur"} ${providerLabel}`}</span>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;text-align:center">
          <span style="display:block;font-size:13px;color:#166534;font-weight:bold;text-transform:uppercase;letter-spacing:1px">${ar ? "رمز الدخول الخاص بك (استخدام فردي)" : "Votre code d'accès unique (usage unique)"}</span>
          <div style="display:inline-block;background:#ffffff;border:2px dashed #22c55e;padding:10px 24px;border-radius:8px;font-size:22px;font-family:monospace;font-weight:bold;color:#15803d;margin:10px 0;letter-spacing:2px">
            ${code}
          </div>
          <small style="display:block;color:#15803d;font-size:12px">${isInPerson ? (ar ? "احتفظ بهذا الرمز لتأكيد حضورك عند الاستقبال." : "Conservez ce code pour confirmer votre présence à l'accueil.") : (ar ? "استخدم هذا الرمز أو اضغط مباشرة على الزر أدناه للدخول إلى الجلسة." : "Conservez ce code ou cliquez simplement sur le bouton ci-dessous pour vous connecter directement.")}</small>
        </div>
        <p style="text-align:center;margin:24px 0">
          ${isInPerson ? `<span style="display:inline-block;background:#082d55;color:#ffffff;padding:14px 28px;border-radius:8px;font-weight:bold;font-size:16px">${ar ? "حضور في عين المكان" : "Session en présentiel"}</span>` : `<a style="display:inline-block;background:${btnBg};color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px" href="${url}">${ar ? `الانضمام عبر ${providerLabel}` : `Rejoindre sur ${providerLabel}`}</a>`}
        </p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#64748b;margin:0">
          ${ar ? "أكاديمية ANEI للتربية الدامجة ومرافقة ذوي الاحتياجات الخاصة." : "Académie ANEI · Pour une école inclusive et l'accompagnement des besoins éducatifs particuliers."}
        </p>
      </div>`,
    },
    "WEBINAR_ACCESS_PASS",
  );
}

export type CareAlertMailInput = {
  name: string;
  email: string;
  title: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  locale: Locale;
};

export async function sendCareAlertEmail(input: CareAlertMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const title = escapeHtml(input.title);
  const body = escapeHtml(input.body);
  const ctaUrl = input.ctaUrl ? escapeHtml(input.ctaUrl) : null;
  const ctaText = input.ctaText ? escapeHtml(input.ctaText) : (ar ? "عرض التفاصيل" : "Consulter");

  await sendMail(
    {
      to: input.email,
      subject: `${title} — ANEI`,
      text: `${ar ? `مرحباً ${input.name}` : `Bonjour ${input.name}`},\n\n${input.body}\n\n${input.ctaUrl ? `${ctaText}: ${input.ctaUrl}\n\n` : ""}ANEI`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:20px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="${ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 20px;border-radius:8px;color:#082d55;text-align:center;margin-bottom:20px">
          <h1 style="margin:0;font-size:18px;color:#082d55">${ar ? "مساحة المتابعة والرعاية" : "Espace Soin & Accompagnement · ANEI"}</h1>
        </div>
        <h2 style="color:#082d55;font-size:18px;margin-top:0">${title}</h2>
        <p style="font-size:15px">${ar ? `مرحباً <strong>${name}</strong>،` : `Bonjour <strong>${name}</strong>,`}</p>
        <p style="font-size:15px;color:#334155">${body}</p>
        ${ctaUrl ? `<p style="text-align:center;margin:24px 0">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px" href="${ctaUrl}">${ctaText}</a>
        </p>` : ""}
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="font-size:12px;color:#64748b;margin:0">
          ${ar ? "منصة ANEI للمتابعة التربوية والتأهيلية الشاملة." : "Plateforme ANEI · Pour une éducation inclusive et un accompagnement pluridisciplinaire."}
        </p>
      </div>`,
    },
    "CARE_ALERT",
  );
}

export type ContactInquiryMailInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale?: Locale;
};

export async function sendContactInquiryNotification(input: ContactInquiryMailInput) {
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const subject = escapeHtml(input.subject);
  const message = escapeHtml(input.message).replace(/\n/g, "<br/>");
  const timestamp = new Date().toLocaleString("fr-FR", { timeZone: "Africa/Tunis" });

  await sendMail(
    {
      to: env.CONTACT_EMAIL,
      subject: `[Support ANEI] Nouveau message de ${input.name}: ${input.subject}`,
      text: `Nouveau message reçu via le formulaire de contact ANEI:\n\nNom: ${input.name}\nEmail: ${input.email}\nSujet: ${input.subject}\nDate: ${timestamp}\n\nMessage:\n${input.message}\n\nRépondre directement à: ${input.email}`,
      html: `<div dir="ltr" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #c9913f;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px">
          <span style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#c9913f;background:#fdfbf7;border:1px solid #f3e8d2;padding:4px 10px;border-radius:999px">SUPPORT & CONTACT ANEI</span>
        </div>
        <h2 style="color:#082d55;margin:0 0 16px 0;font-size:20px;font-weight:700">Demande de contact reçue</h2>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:20px">
          <p style="margin:0 0 8px 0;font-size:14px"><strong>Expéditeur :</strong> ${name} &lt;<a href="mailto:${email}">${email}</a>&gt;</p>
          <p style="margin:0 0 8px 0;font-size:14px"><strong>Objet :</strong> ${subject}</p>
          <p style="margin:0;font-size:13px;color:#64748b"><strong>Date de réception :</strong> ${timestamp} (Heure Tunis)</p>
        </div>
        <h3 style="font-size:15px;color:#082d55;margin:0 0 8px 0">Message transmis :</h3>
        <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:16px;font-size:14px;color:#334155;line-height:1.7;white-space:pre-wrap">
${message}
        </div>
        <div style="margin:24px 0;text-align:center">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px" href="mailto:${email}?subject=${encodeURIComponent(`Re: [ANEI] ${input.subject}`)}">Répondre à ${name}</a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">Notification automatique générée par la plateforme de l'Académie Nationale de l'Éducation Inclusive.</p>
      </div>`,
    },
    "CONTACT_INQUIRY"
  );
}

export async function sendContactAcknowledgmentEmail(input: ContactInquiryMailInput) {
  const ar = input.locale === "ar";
  const name = escapeHtml(input.name);
  const subject = escapeHtml(input.subject);

  await sendMail(
    {
      to: input.email,
      subject: ar
        ? `تأكيد استلام رسالتكم — ANEI`
        : `Accusé de réception de votre message — ANEI`,
      text: ar
        ? `مرحباً ${input.name}،\n\nلقد استلمنا رسالتكم بخصوص « ${input.subject} ».\nيقوم فريق الأكاديمية بدراسة طلبكم وسيقوم بالرد في أقرب وقت.\n\nالأكاديمية الوطنية للتربية الدامجة`
        : `Bonjour ${input.name},\n\nNous avons bien reçu votre demande concernant « ${input.subject} ».\nL’équipe de l’Académie Nationale de l’Éducation Inclusive traite votre message et vous répondra sous 24 à 48 heures ouvrées.\n\nCordialement,\nL’équipe ANEI`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #082d55;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="${ar ? "الأكاديمية الوطنية للتربية الدامجة" : "Académie Nationale de l’Éducation Inclusive"}" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <h2 style="color:#082d55;margin:0 0 12px 0;font-size:20px;font-weight:700">
          ${ar ? "تم استلام رسالتكم بنجاح" : "Nous avons bien reçu votre demande"}
        </h2>
        <p style="font-size:15px;margin:0 0 12px 0">
          ${ar ? `مرحباً <strong>${name}</strong>،` : `Bonjour <strong>${name}</strong>,`}
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `نشكركم على تواصلكم مع الأكاديمية الوطنية للتربية الدامجة بخصوص « <strong>${subject}</strong> ». تم تسجيل طلبكم وسيقوم الفريق المعني بالرد عليكم في غضون 24 إلى 48 ساعة عمل.`
              : `Nous vous remercions d’avoir contacté l’Académie Nationale de l’Éducation Inclusive au sujet de « <strong>${subject}</strong> ». Votre demande a été enregistrée et notre pôle d’orientation vous répondra sous 24 à 48 heures ouvrées.`
          }
        </p>
        <div style="background:#fdfbf7;border:1px solid #f3e8d2;border-radius:8px;padding:14px;margin:20px 0">
          <strong style="display:block;color:#a66f24;font-size:13px;margin-bottom:6px">
            ${ar ? "معلومات الاتصال المباشر بمقر الأكاديمية :" : "Permanence & Campus ANEI :"}
          </strong>
          <span style="display:block;font-size:13px;color:#475569">
            ${ar ? "📍 تونس، المركز العمراني الشمالي — تونس" : "📍 Avenue Habib Bourguiba, Centre Urbain Nord, Tunis"}
          </span>
          <span style="display:block;font-size:13px;color:#475569">
            ${ar ? "⏱️ أوقات العمل: الإثنين إلى الجمعة من 08:30 إلى 17:30" : "⏱️ Accueil public : Du Lundi au Vendredi de 08h30 à 17h30"}
          </span>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">
          ${ar ? "الأكاديمية الوطنية للتربية الدامجة (ANEI) — تجربة تعليمية شاملة وإنسانية." : "Académie Nationale de l’Éducation Inclusive (ANEI) — Pour une école et une société accessibles à tous."}
        </p>
      </div>`,
    },
    "CONTACT_CONFIRMATION"
  );
}

export type BookingEscrowMailInput = {
  parentName: string;
  parentEmail: string;
  avsName: string;
  childName: string;
  requestedDate: string;
  requestedTimeSlot: string;
  meetingType: string;
  amountTnd: number;
  escrowRef: string;
  locale?: Locale;
};

export async function sendBookingEscrowNotification(input: BookingEscrowMailInput) {
  const ar = input.locale === "ar";
  const parentName = escapeHtml(input.parentName);
  const avsName = escapeHtml(input.avsName);
  const childName = escapeHtml(input.childName);

  await sendMail(
    {
      to: input.parentEmail,
      subject: ar
        ? `تأكيد حجز موعد المرافقة وسداد الضمان — ANEI (${input.escrowRef})`
        : `Confirmation de rendez-vous AVS & Garantie Séquestre — ANEI (${input.escrowRef})`,
      text: `Rendez-vous AVS confirmé.\nRéf Séquestre: ${input.escrowRef}\nMontant: ${input.amountTnd} TND (Fonds sous séquestre tiers de confiance ANEI).\nAVS: ${input.avsName}\nDate: ${input.requestedDate} à ${input.requestedTimeSlot}`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #082d55;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="ANEI" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <div style="margin-bottom:12px">
          <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:4px 10px;border-radius:999px">
            ${ar ? "🛡️ مدفوع — ضمان طرف ثالث ANEI" : "🛡️ PAYÉ — GARANTIE TIERS DE CONFIANCE ANEI"}
          </span>
        </div>
        <h2 style="color:#082d55;margin:0 0 12px 0;font-size:20px;font-weight:700">
          ${ar ? "تم تأكيد حجز موعد المرافقة المدرسية" : "Rendez-vous AVS confirmé"}
        </h2>
        <p style="font-size:15px;margin:0 0 16px 0">
          ${ar ? `مرحباً <strong>${parentName}</strong>،` : `Bonjour <strong>${parentName}</strong>,`}
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `تم تسجيل وسداد موعدكم مع المرافق المدرسي <strong>${avsName}</strong> لصالح التلميذ(ة) <strong>${childName}</strong> بنجاح. تم حفظ المبلغ تحت حساب الضمان المحمي (Séquestre) لدى الأكاديمية.`
              : `Votre rendez-vous avec l'accompagnant(e) scolaire <strong>${avsName}</strong> pour l'élève <strong>${childName}</strong> a été validé et réglé avec succès. Les fonds sont sécurisés sous séquestre par l'ANEI.`
          }
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "المرجع الآمن للضمان :" : "Réf. Séquestre :"}</strong> <code style="color:#082d55;font-weight:bold">${input.escrowRef}</code></p>
          <p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "التاريخ والتوقيت :" : "Date & Créneau :"}</strong> ${input.requestedDate} (${input.requestedTimeSlot})</p>
          <p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "المبلغ المودع تحت الضمان :" : "Montant sous séquestre :"}</strong> ${input.amountTnd}.000 TND</p>
          <p style="margin:0;font-size:13px;color:#059669"><strong>${ar ? "الحالة :" : "Statut :"}</strong> ${ar ? "الأموال محفوظة لدى ANEI حتى إتمام الجلسة" : "Fonds conservés par l'ANEI jusqu'à la tenue de la séance"}</p>
        </div>
        <div style="text-align:center;margin:24px 0">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px" href="${env.APP_URL}/${input.locale || "fr"}/dashboard">
            ${ar ? "متابعة الطلب في لوحة التحكم" : "Gérer mon dossier dans l'espace Parent"}
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">
          ${ar ? "الأكاديمية الوطنية للتربية الدامجة — حماية الأسرة والمرافق المدرسي." : "ANEI — Tiers de confiance pour l'accompagnement scolaire inclusif."}
        </p>
      </div>`,
    },
    "BOOKING_ESCROW"
  );
}

export type PractitionerNewBookingMailInput = {
  practitionerEmail: string;
  practitionerName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterLocation?: string;
  childName: string;
  childAge?: number | null;
  requestedDate: string;
  requestedTimeSlot: string;
  meetingType: string;
  needDescription: string;
  notes?: string | null;
  bookingId: string;
  locale?: Locale;
};

export async function sendPractitionerNewBookingAlert(input: PractitionerNewBookingMailInput) {
  const ar = input.locale === "ar";
  const practitionerName = escapeHtml(input.practitionerName);
  const requesterName = escapeHtml(input.requesterName);
  const requesterEmail = escapeHtml(input.requesterEmail);
  const requesterPhone = escapeHtml(input.requesterPhone);
  const requesterLocation = escapeHtml(input.requesterLocation || (ar ? "تونس" : "Tunisie"));
  const childName = escapeHtml(input.childName);
  const needDesc = escapeHtml(input.needDescription);
  const notes = escapeHtml(input.notes || "");
  const isOnline = input.meetingType === "ONLINE" || input.meetingType === "ONLINE_VISIO";
  const meetingTypeLabel = isOnline
    ? ar ? "عن بعد (استشارة مرئية ANEI)" : "En ligne (Visioconférence ANEI)"
    : ar ? "حضوري (على عين المكان / بالعيادة)" : "Sur place (Présentiel / Cabinet)";

  const dashboardUrl = `${env.APP_URL}/${input.locale || "fr"}/dashboard/praticien`;

  await sendMail(
    {
      to: input.practitionerEmail,
      subject: ar
        ? `📅 طلب موعد جديد — ${requesterName} (${input.requestedDate} à ${input.requestedTimeSlot})`
        : `📅 Nouvelle demande de rendez-vous ANEI — ${requesterName} (${input.requestedDate} à ${input.requestedTimeSlot})`,
      text: `Nouvelle demande de rendez-vous reçue sur votre espace ANEI.\nDemandeur: ${input.requesterName} (Tél: ${input.requesterPhone}, Email: ${input.requesterEmail})\nÉlève: ${input.childName}\nDate: ${input.requestedDate} à ${input.requestedTimeSlot}\nModalité: ${meetingTypeLabel}\nBesoin: ${input.needDescription}\nConfirmez dans votre espace: ${dashboardUrl}`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #082d55;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="ANEI" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <div style="margin-bottom:12px">
          <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#d97706;background:#fffbeb;border:1px solid #fde68a;padding:4px 10px;border-radius:999px">
            ${ar ? "⏳ طلب موعد جديد في انتظار تأكيدكم" : "⏳ NOUVELLE DEMANDE DE RENDEZ-VOUS EN ATTENTE"}
          </span>
        </div>
        <h2 style="color:#082d55;margin:0 0 12px 0;font-size:20px;font-weight:700">
          ${ar ? "طلب موعد مقابلة واستشارة" : "Nouvelle demande de consultation"}
        </h2>
        <p style="font-size:15px;margin:0 0 16px 0">
          ${ar ? `مرحباً <strong>${practitionerName}</strong>،` : `Bonjour <strong>${practitionerName}</strong>,`}
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `تلقيتم طلباً جديداً لحجز موعد استشارة ومرافقة عبر ملفكم المهني في منصة ANEI.`
              : `Une famille vient de solliciter un rendez-vous sur votre profil professionnel ANEI.`
          }
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0">
          <h3 style="margin:0 0 10px 0;font-size:14px;color:#082d55;text-transform:uppercase;font-weight:700">
            ${ar ? "معلومات الولي والطفل" : "Demandeur & Coordonnées"}
          </h3>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "الاسم الكامل :" : "Nom :"}</strong> ${requesterName}</p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "الهاتف :" : "Téléphone :"}</strong> <a href="tel:${requesterPhone}" style="color:#0056D2;font-weight:bold">${requesterPhone}</a></p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "البريد الإلكتروني :" : "Email :"}</strong> <a href="mailto:${requesterEmail}" style="color:#0056D2">${requesterEmail}</a></p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "الموقع / المحافظة :" : "Localisation :"}</strong> ${requesterLocation}</p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "التلميذ(ة) :" : "Élève :"}</strong> ${childName} ${input.childAge ? `(${input.childAge} ${ar ? "سنوات" : "ans"})` : ""}</p>
          <hr style="border:none;border-top:1px dashed #e2e8f0;margin:12px 0" />
          <h3 style="margin:0 0 10px 0;font-size:14px;color:#082d55;text-transform:uppercase;font-weight:700">
            ${ar ? "تفاصيل الموعد المطلوب" : "Détails du Rendez-vous"}
          </h3>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "التاريخ والتوقيت :" : "Date & Créneau :"}</strong> <span style="color:#082d55;font-weight:bold">${input.requestedDate} à ${input.requestedTimeSlot}</span></p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "الصيغة :" : "Modalité :"}</strong> ${meetingTypeLabel}</p>
          <p style="margin:0 0 6px 0;font-size:14px"><strong>${ar ? "طبيعة الاحتياج :" : "Besoin / Motif :"}</strong> ${needDesc}</p>
          ${notes ? `<p style="margin:0;font-size:13px;color:#64748b"><strong>${ar ? "ملاحظة إضافية :" : "Note :"}</strong> ${notes}</p>` : ""}
        </div>
        <div style="text-align:center;margin:24px 0">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px" href="${dashboardUrl}">
            ${ar ? "فتح لوحة التحكم لتأكيد الموعد ←" : "Ouvrir mon Dashboard pour Confirmer ce RDV →"}
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">
          ${ar ? "الأكاديمية الوطنية للتربية الدامجة — فضاء الممارسين والأخصائيين المعتمدين." : "Académie Nationale de l'Éducation Inclusive — Espace Praticiens & AVS agréés."}
        </p>
      </div>`,
    },
    "PRACTITIONER_BOOKING_ALERT"
  );
}

export type RequesterBookingConfirmedMailInput = {
  requesterEmail: string;
  requesterName: string;
  practitionerName: string;
  practitionerPhone?: string | null;
  practitionerSpecialty?: string | null;
  requestedDate: string;
  requestedTimeSlot: string;
  meetingType: string;
  locationOrVisioUrl: string;
  bookingId: string;
  locale?: Locale;
};

export async function sendRequesterBookingConfirmedNotification(input: RequesterBookingConfirmedMailInput) {
  const ar = input.locale === "ar";
  const requesterName = escapeHtml(input.requesterName);
  const practitionerName = escapeHtml(input.practitionerName);
  const practitionerSpecialty = escapeHtml(input.practitionerSpecialty || (ar ? "أخصائي / مرافق معتمد" : "Praticien agréé"));
  const practitionerPhone = escapeHtml(input.practitionerPhone || "");
  const locationOrVisioUrl = escapeHtml(input.locationOrVisioUrl);
  const isOnline = input.meetingType === "ONLINE" || input.meetingType === "ONLINE_VISIO";

  const accessLabel = isOnline
    ? ar ? "رابط قاعة الفيديو ANEI" : "Lien de visioconférence sécurisée"
    : ar ? "عنوان ومقر الاستشارة" : "Lieu & Adresse du rendez-vous";

  await sendMail(
    {
      to: input.requesterEmail,
      subject: ar
        ? `✅ تم تأكيد موعدكم مع ${practitionerName} — ${input.requestedDate} à ${input.requestedTimeSlot}`
        : `✅ Rendez-vous confirmé avec ${practitionerName} — ${input.requestedDate} à ${input.requestedTimeSlot}`,
      text: `Votre rendez-vous avec ${input.practitionerName} (${practitionerSpecialty}) a été confirmé.\nDate: ${input.requestedDate} à ${input.requestedTimeSlot}\nAccès: ${input.locationOrVisioUrl}\nConsultez votre espace ANEI: ${env.APP_URL}/${input.locale || "fr"}/dashboard`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #059669;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="ANEI" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <div style="margin-bottom:12px">
          <span style="display:inline-block;font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:4px 10px;border-radius:999px">
            ${ar ? "✅ موعد مؤكد رسمياً من الممارس" : "✅ RENDEZ-VOUS CONFIRMÉ PAR LE PRATICIEN"}
          </span>
        </div>
        <h2 style="color:#082d55;margin:0 0 12px 0;font-size:20px;font-weight:700">
          ${ar ? "تم تأكيد موعدكم بنجاح" : "Votre rendez-vous est confirmé"}
        </h2>
        <p style="font-size:15px;margin:0 0 16px 0">
          ${ar ? `مرحباً <strong>${requesterName}</strong>،` : `Bonjour <strong>${requesterName}</strong>,`}
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `يسعدنا إعلامكم بأن <strong>${practitionerName}</strong> (${practitionerSpecialty}) قد أكد(ت) موعدكم رسمياً.`
              : `Nous vous confirmons que <strong>${practitionerName}</strong> (${practitionerSpecialty}) a validé votre créneau de consultation.`
          }
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:20px 0">
          <p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "الممارس :" : "Praticien :"}</strong> ${practitionerName} (${practitionerSpecialty})</p>
          ${practitionerPhone ? `<p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "الهاتف المهني :" : "Téléphone :"}</strong> <a href="tel:${practitionerPhone}" style="color:#0056D2;font-weight:bold">${practitionerPhone}</a></p>` : ""}
          <p style="margin:0 0 8px 0;font-size:14px"><strong>${ar ? "التاريخ والتوقيت :" : "Date & Créneau :"}</strong> <span style="color:#082d55;font-weight:bold">${input.requestedDate} à ${input.requestedTimeSlot}</span></p>
          <hr style="border:none;border-top:1px dashed #e2e8f0;margin:12px 0" />
          <p style="margin:0 0 6px 0;font-size:13px;color:#64748b;font-weight:700;text-transform:uppercase">${accessLabel}</p>
          ${
            isOnline
              ? `<div style="margin:8px 0"><a href="${input.locationOrVisioUrl}" style="display:inline-block;background:#0056D2;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px">${ar ? "🎥 دخول قاعة الفيديو المباشرة" : "🎥 Rejoindre la visioconférence ANEI"}</a></div>
                 <p style="margin:4px 0 0;font-size:12px;color:#94a3b8">Lien direct : <code style="word-break:break-all">${input.locationOrVisioUrl}</code></p>`
              : `<p style="margin:0;font-size:14px;color:#0f172a;font-weight:bold">${locationOrVisioUrl}</p>`
          }
        </div>
        <div style="text-align:center;margin:24px 0">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px" href="${env.APP_URL}/${input.locale || "fr"}/dashboard">
            ${ar ? "عرض الموعد في فضاء العائلة" : "Consulter mon rendez-vous sur ANEI →"}
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">
          ${ar ? "الأكاديمية الوطنية للتربية الدامجة — شريككم في الإدماج المدرسي." : "Académie Nationale de l'Éducation Inclusive — Tiers de confiance pour l'éducation inclusive."}
        </p>
      </div>`,
    },
    "BOOKING_CONFIRMED"
  );
}

export type RequesterBookingDeclinedMailInput = {
  requesterEmail: string;
  requesterName: string;
  practitionerName: string;
  requestedDate: string;
  requestedTimeSlot: string;
  reason?: string | null;
  locale?: Locale;
};

export async function sendRequesterBookingDeclinedNotification(input: RequesterBookingDeclinedMailInput) {
  const ar = input.locale === "ar";
  const requesterName = escapeHtml(input.requesterName);
  const practitionerName = escapeHtml(input.practitionerName);
  const reason = escapeHtml(input.reason || "");

  await sendMail(
    {
      to: input.requesterEmail,
      subject: ar
        ? `تحديث حول موعدكم مع ${practitionerName}`
        : `Mise à jour concernant votre demande de rendez-vous avec ${practitionerName}`,
      text: `Votre demande de rendez-vous avec ${input.practitionerName} le ${input.requestedDate} à ${input.requestedTimeSlot} n'a pas pu être acceptée.\nVous pouvez sélectionner un autre créneau disponible sur son profil.\nEspace ANEI: ${env.APP_URL}/${input.locale || "fr"}/dashboard`,
      html: `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;max-width:580px;margin:auto;color:#082d55;line-height:1.6;padding:24px;border:1px solid #e2e8f0;border-top:4px solid #ef4444;border-radius:12px;background:#ffffff">
        <div style="margin-bottom:16px;text-align:${ar ? "right" : "left"}">
          <img src="${env.APP_URL}/brand/anei-logo-2x-transparent.png" alt="ANEI" width="160" style="display:inline-block;width:160px;height:auto;max-width:100%;border:0" />
        </div>
        <h2 style="color:#082d55;margin:0 0 12px 0;font-size:20px;font-weight:700">
          ${ar ? "عدم توفر الموعد المطلوب" : "Indisponibilité du créneau demandé"}
        </h2>
        <p style="font-size:15px;margin:0 0 16px 0">
          ${ar ? `مرحباً <strong>${requesterName}</strong>،` : `Bonjour <strong>${requesterName}</strong>,`}
        </p>
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `نأسف لإعلامكم بأن <strong>${practitionerName}</strong> غير متاح(ة) في التوقيت الذي تم اختياره (${input.requestedDate} à ${input.requestedTimeSlot}).`
              : `Nous vous informons que <strong>${practitionerName}</strong> n'est malheureusement pas disponible sur le créneau demandé (${input.requestedDate} à ${input.requestedTimeSlot}).`
          }
        </p>
        ${
          reason
            ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;color:#991b1b">
                <strong>${ar ? "رسالة من الممارس :" : "Motif communiqué :"}</strong> ${reason}
              </div>`
            : ""
        }
        <p style="font-size:14px;color:#334155;line-height:1.6">
          ${
            ar
              ? `ندعوكم لاختيار موعد بديل عبر جدول المواعيد المتاح في الملف المهني للممارس.`
              : `Nous vous invitons à choisir un autre créneau directement sur sa fiche professionnelle.`
          }
        </p>
        <div style="text-align:center;margin:24px 0">
          <a style="display:inline-block;background:#082d55;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px" href="${env.APP_URL}/${input.locale || "fr"}/dashboard">
            ${ar ? "العودة إلى لوحة التحكم" : "Consulter mon tableau de bord →"}
          </a>
        </div>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0" />
        <p style="font-size:12px;color:#94a3b8;margin:0">
          ${ar ? "الأكاديمية الوطنية للتربية الدامجة." : "Académie Nationale de l'Éducation Inclusive."}
        </p>
      </div>`,
    },
    "BOOKING_DECLINED"
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char] ?? char);
}
