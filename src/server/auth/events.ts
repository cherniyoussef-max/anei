import "server-only";
import { db } from "@/server/db";
import { authEvent } from "@/server/db/schema";
import { logger } from "@/server/security/logger";

export type AuthEventType =
  | "LOGIN_PRIMARY_STARTED"
  | "LOGIN_PRIMARY_SUCCEEDED"
  | "LOGIN_PRIMARY_FAILED"
  | "GOOGLE_LOGIN_STARTED"
  | "GOOGLE_LOGIN_SUCCEEDED"
  | "GOOGLE_LOGIN_FAILED"
  | "GOOGLE_LINK_REJECTED"
  | "PROFILE_REQUIRED"
  | "PROFILE_COMPLETED"
  | "OTP_REQUESTED"
  | "OTP_SENT"
  | "OTP_DELIVERY_FAILED"
  | "OTP_VERIFIED"
  | "OTP_REJECTED"
  | "OTP_EXPIRED"
  | "OTP_RATE_LIMITED"
  | "SESSION_ASSURANCE_COMPLETED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "ACCOUNT_RECOVERY_REQUESTED"
  | "ACCOUNT_RECOVERY_COMPLETED";

export type AuthChannel = "EMAIL" | "WHATSAPP";
export type AuthPurpose =
  | "LOGIN"
  | "PASSWORD_RESET"
  | "ACCOUNT_RECOVERY"
  | "VERIFY_EMAIL"
  | "VERIFY_PHONE"
  | "CHANGE_EMAIL"
  | "CHANGE_PHONE"
  | "SENSITIVE_ACTION";

export async function recordAuthEvent(input: {
  requestId: string;
  eventType: AuthEventType;
  userId?: string | null;
  provider?: string | null;
  channel?: AuthChannel | null;
  purpose?: AuthPurpose | null;
  safeReasonCode?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(authEvent).values({
    requestId: input.requestId,
    eventType: input.eventType,
    userId: input.userId ?? null,
    provider: input.provider ?? null,
    channel: input.channel ?? null,
    purpose: input.purpose ?? null,
    safeReasonCode: input.safeReasonCode ?? null,
    metadata: input.metadata ?? null,
  });

  logger.info("auth.event", {
    requestId: input.requestId,
    eventType: input.eventType,
    userId: input.userId ?? null,
    provider: input.provider ?? null,
    channel: input.channel ?? null,
    purpose: input.purpose ?? null,
    safeReasonCode: input.safeReasonCode ?? null,
  });
}
