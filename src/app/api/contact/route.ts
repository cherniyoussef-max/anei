import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { contactMessages } from "@/server/db/schema";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { sendContactInquiryNotification, sendContactAcknowledgmentEmail } from "@/server/services/mailer";
import { logger } from "@/server/security/logger";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  locale: z.enum(["fr", "ar", "en"]).default("fr"),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const rate = await consumeRateLimit(`contact:${requestFingerprint(request)}`, 5, 600);
  if (!rate.allowed) return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const [inserted] = await db.insert(contactMessages).values({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: "new",
  }).returning();

  // Send automatic email notification to ANEI support and acknowledgment to inquirer
  try {
    await Promise.allSettled([
      sendContactInquiryNotification({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        locale: parsed.data.locale,
      }),
      sendContactAcknowledgmentEmail({
        name: parsed.data.name,
        email: parsed.data.email,
        subject: parsed.data.subject,
        message: parsed.data.message,
        locale: parsed.data.locale,
      }),
    ]);
    logger.info("contact.inquiry.emails_dispatched", { messageId: inserted?.id, recipient: parsed.data.email });
  } catch (mailErr) {
    logger.error("contact.inquiry.mail_error", { error: mailErr });
  }

  return NextResponse.json({ ok: true, id: inserted?.id }, { status: 201 });
}

