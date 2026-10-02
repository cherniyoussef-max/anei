import nodemailer from "nodemailer";
import { env } from "@/server/env";
import { logger } from "@/server/security/logger";
import { getProviderMeta } from "@/lib/webinars";
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
export type MailType = "EMAIL_VERIFICATION" | "PASSWORD_RESET" | "OTP" | "WEBINAR_ACCESS_PASS" | "CARE_ALERT";

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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char] ?? char);
}
