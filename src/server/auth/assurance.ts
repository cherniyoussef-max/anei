import "server-only";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/server/db";
import { authSessionAssurance, authVerificationChallenge, session } from "@/server/db/schema";
import type { AuthSession } from "@/server/auth";
import type { AuthChannel } from "@/server/auth/events";

export async function getSessionAssurance(sessionId: string) {
  const [row] = await db
    .select()
    .from(authSessionAssurance)
    .where(and(eq(authSessionAssurance.sessionId, sessionId), gt(authSessionAssurance.expiresAt, new Date())))
    .limit(1);
  return row ?? null;
}

export async function isSessionAssured(sessionId: string) {
  return Boolean(await getSessionAssurance(sessionId));
}

export async function completeSessionAssurance(input: { sessionId: string; userId: string; method: AuthChannel }) {
  const now = new Date();
  const [sessionRow] = await db.select({ expiresAt: session.expiresAt }).from(session).where(eq(session.id, input.sessionId)).limit(1);
  if (!sessionRow) return false;

  await db
    .insert(authSessionAssurance)
    .values({
      sessionId: input.sessionId,
      userId: input.userId,
      method: input.method,
      verifiedAt: now,
      completedAt: now,
      expiresAt: sessionRow.expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: authSessionAssurance.sessionId,
      set: {
        method: input.method,
        verifiedAt: now,
        completedAt: now,
        expiresAt: sessionRow.expiresAt,
        updatedAt: now,
      },
    });

  await db
    .update(authVerificationChallenge)
    .set({ status: "SUPERSEDED", supersededAt: now, updatedAt: now })
    .where(
      and(
        eq(authVerificationChallenge.sessionId, input.sessionId),
        eq(authVerificationChallenge.purpose, "LOGIN"),
        eq(authVerificationChallenge.status, "ACTIVE"),
      ),
    );

  return true;
}

export async function invalidateSessionAssuranceByUser(userId: string) {
  await db.delete(authSessionAssurance).where(eq(authSessionAssurance.userId, userId));
}

export function requiresOtpAssurance(current: AuthSession | null, assured: Awaited<ReturnType<typeof getSessionAssurance>>) {
  if (!current) return false;
  return !assured;
}
