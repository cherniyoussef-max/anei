import "server-only";
import crypto from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  auditLogs,
  authResetAuthorization,
  authVerificationChallenge,
  passwordResetTokens,
  user,
} from "@/server/db/schema";
import { invalidateSessionAssuranceByUser } from "@/server/auth/assurance";
import {
  AUTH_RESET_TOKEN_TTL_MINUTES,
  generateResetAuthorizationToken,
  hashResetAuthorizationToken,
} from "@/server/security/auth-otp-crypto";
import { recordAuthEvent } from "@/server/auth/events";
import { sendResetEmail } from "@/server/services/mailer";
import { env } from "@/server/env";
import type { Locale } from "@/types";

export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;

export function hashPasswordResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Initiates a password reset request with anti-enumeration protection.
 * Always resolves gracefully. If the account exists, revokes any previous active
 * tokens, generates a 32-byte cryptographically secure token, hashes it, saves it
 * with a 30-minute expiry, and dispatches the official ANEI reset email.
 */
export async function createPasswordResetRequest(input: {
  email: string;
  locale: Locale;
  requestId: string;
  ipKey?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const now = new Date();

  const [accountRow] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  // Anti-enumeration: if no account, exit early with identical public status
  if (!accountRow) {
    return { ok: true as const };
  }

  // Revoke any existing active reset tokens for this user
  await db
    .update(passwordResetTokens)
    .set({ status: "REVOKED", updatedAt: now })
    .where(
      and(
        eq(passwordResetTokens.userId, accountRow.id),
        eq(passwordResetTokens.status, "ACTIVE"),
      ),
    );

  // Generate cryptographically secure random token (32 bytes hex = 64 characters)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60_000);

  await db.insert(passwordResetTokens).values({
    userId: accountRow.id,
    email: accountRow.email,
    tokenHash,
    status: "ACTIVE",
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  const resetUrl = `${env.APP_URL}/${input.locale}/reinitialiser-mot-de-passe?token=${rawToken}&email=${encodeURIComponent(accountRow.email)}`;

  await sendResetEmail({
    name: accountRow.name || "Apprenant ANEI",
    email: accountRow.email,
    url: resetUrl,
    locale: input.locale,
  });

  await recordAuthEvent({
    requestId: input.requestId,
    userId: accountRow.id,
    purpose: "PASSWORD_RESET",
    channel: "EMAIL",
    eventType: "PASSWORD_RESET_REQUESTED",
  });

  return { ok: true as const };
}

/**
 * Validates a raw password reset token on server side without consuming it.
 * Verifies existence, active status, and expiry (< 30 minutes).
 */
export async function validatePasswordResetToken(rawToken: string): Promise<{
  valid: boolean;
  email?: string;
  userId?: string;
  error?: "EXPIRED" | "ALREADY_USED" | "INVALID";
}> {
  if (!rawToken || rawToken.length < 24) {
    return { valid: false, error: "INVALID" };
  }

  const tokenHash = hashPasswordResetToken(rawToken);
  const now = new Date();

  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      email: passwordResetTokens.email,
      status: passwordResetTokens.status,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (row) {
    if (row.status === "CONSUMED") return { valid: false, error: "ALREADY_USED" };
    if (row.status !== "ACTIVE") return { valid: false, error: "INVALID" };
    if (row.expiresAt <= now) return { valid: false, error: "EXPIRED" };
    return { valid: true, email: row.email, userId: row.userId };
  }

  // Fallback check on authResetAuthorization (OTP flow)
  const legacyHash = hashResetAuthorizationToken(rawToken);
  const [legacyRow] = await db
    .select({
      id: authResetAuthorization.id,
      userId: authResetAuthorization.userId,
      status: authResetAuthorization.status,
      expiresAt: authResetAuthorization.expiresAt,
    })
    .from(authResetAuthorization)
    .where(eq(authResetAuthorization.tokenHash, legacyHash))
    .limit(1);

  if (legacyRow) {
    if (legacyRow.status === "CONSUMED") return { valid: false, error: "ALREADY_USED" };
    if (legacyRow.status !== "ACTIVE") return { valid: false, error: "INVALID" };
    if (legacyRow.expiresAt <= now) return { valid: false, error: "EXPIRED" };
    return { valid: true, userId: legacyRow.userId };
  }

  return { valid: false, error: "INVALID" };
}

/**
 * Resets a user password using a verified single-use token.
 * Hashes password using Better Auth, consumes token, revokes sessions,
 * invalidates assurance, and records audit trail.
 */
export async function resetPasswordWithToken(input: {
  requestId: string;
  token: string;
  newPassword: string;
}) {
  if (input.newPassword.length < 15) {
    return { ok: false as const, error: "PASSWORD_TOO_SHORT" };
  }

  const tokenHash = hashPasswordResetToken(input.token);
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        eq(passwordResetTokens.status, "ACTIVE"),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    // Attempt fallback to legacy authorization token
    return resetPasswordWithAuthorization(input);
  }

  const [accountRow] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, tokenRow.userId))
    .limit(1);

  if (!accountRow) {
    return { ok: false as const, error: "INVALID_RESET_TOKEN" };
  }

  const context = await auth.$context;
  const hashedPassword = await context.password.hash(input.newPassword);

  await db.transaction(async (tx) => {
    await context.internalAdapter.updatePassword(accountRow.id, hashedPassword);
    await tx
      .update(passwordResetTokens)
      .set({ status: "CONSUMED", consumedAt: now, updatedAt: now })
      .where(eq(passwordResetTokens.id, tokenRow.id));
  });

  await context.internalAdapter.deleteUserSessions(accountRow.id);
  await invalidateSessionAssuranceByUser(accountRow.id);

  await recordAuthEvent({
    requestId: input.requestId,
    userId: accountRow.id,
    purpose: "PASSWORD_RESET",
    eventType: "PASSWORD_RESET_COMPLETED",
  });

  await db.insert(auditLogs).values({
    actorUserId: accountRow.id,
    action: "auth.password.reset_success",
    entityType: "user",
    entityId: accountRow.id,
    metadata: { requestId: input.requestId, email: accountRow.email },
    createdAt: now,
  });

  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Legacy OTP-based Reset Authorization Functions (Retained for Compatibility)
// ---------------------------------------------------------------------------

export async function issuePasswordResetAuthorization(input: {
  userId: string;
  requestId: string;
  challengeId: string;
}) {
  const now = new Date();
  const token = generateResetAuthorizationToken();
  const tokenHash = hashResetAuthorizationToken(token);

  await db
    .update(authResetAuthorization)
    .set({ status: "REVOKED", updatedAt: now })
    .where(and(eq(authResetAuthorization.userId, input.userId), eq(authResetAuthorization.status, "ACTIVE")));

  await db.insert(authResetAuthorization).values({
    userId: input.userId,
    challengeId: input.challengeId,
    tokenHash,
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() + AUTH_RESET_TOKEN_TTL_MINUTES * 60_000),
    createdAt: now,
    updatedAt: now,
  });

  await recordAuthEvent({ requestId: input.requestId, userId: input.userId, purpose: "PASSWORD_RESET", eventType: "PASSWORD_RESET_REQUESTED" });

  return { token, expiresAt: new Date(now.getTime() + AUTH_RESET_TOKEN_TTL_MINUTES * 60_000).toISOString() };
}

export async function resetPasswordWithAuthorization(input: {
  requestId: string;
  token: string;
  newPassword: string;
}) {
  const tokenHash = hashResetAuthorizationToken(input.token);
  const now = new Date();
  const [authz] = await db
    .select()
    .from(authResetAuthorization)
    .where(
      and(
        eq(authResetAuthorization.tokenHash, tokenHash),
        eq(authResetAuthorization.status, "ACTIVE"),
        gt(authResetAuthorization.expiresAt, now),
      ),
    )
    .limit(1);

  if (!authz) return { ok: false as const, error: "INVALID_RESET_AUTHORIZATION" };

  const [accountRow] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, authz.userId)).limit(1);
  if (!accountRow) return { ok: false as const, error: "INVALID_RESET_AUTHORIZATION" };

  const context = await auth.$context;
  const hashedPassword = await context.password.hash(input.newPassword);

  await db.transaction(async (tx) => {
    await context.internalAdapter.updatePassword(accountRow.id, hashedPassword);
    await tx
      .update(authResetAuthorization)
      .set({ status: "CONSUMED", consumedAt: now, updatedAt: now })
      .where(eq(authResetAuthorization.id, authz.id));
    await tx
      .update(authVerificationChallenge)
      .set({ status: "SUPERSEDED", supersededAt: now, updatedAt: now })
      .where(eq(authVerificationChallenge.id, authz.challengeId));
  });

  await context.internalAdapter.deleteUserSessions(accountRow.id);
  await invalidateSessionAssuranceByUser(accountRow.id);
  await recordAuthEvent({ requestId: input.requestId, userId: accountRow.id, purpose: "PASSWORD_RESET", eventType: "PASSWORD_RESET_COMPLETED" });

  return { ok: true as const };
}
