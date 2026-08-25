import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { authResetAuthorization, authVerificationChallenge, user } from "@/server/db/schema";
import { invalidateSessionAssuranceByUser } from "@/server/auth/assurance";
import {
  AUTH_RESET_TOKEN_TTL_MINUTES,
  generateResetAuthorizationToken,
  hashResetAuthorizationToken,
} from "@/server/security/auth-otp-crypto";
import { recordAuthEvent } from "@/server/auth/events";

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
