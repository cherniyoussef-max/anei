import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, personaMembership, referralCode, referralConversion } from "@/server/db/schema";
import {
  defaultStatusFor,
  legacyPersonaFromProfileType,
  type Persona,
  type PersonaStatus,
} from "@/modules/personas/domain/permissions";
import { grantPoints, POINT_VALUES } from "@/server/services/points";

export type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Grants the referrer's bonus once a referred user's persona becomes ACTIVE
 * (either immediately for auto-active personas like STUDENT/PARENT, or later
 * via admin approval of a professional persona). Idempotent: a PENDING
 * conversion is only ever flipped to REWARDED once (guarded by the WHERE
 * clause on this UPDATE, executed inside the caller's transaction), and
 * `grantPoints` itself is idempotent on (userId, reason, referenceId).
 */
async function maybeRewardReferral(tx: DbClient, referredUserId: string) {
  const [conversion] = await tx
    .update(referralConversion)
    .set({ status: "REWARDED", rewardedAt: new Date() })
    .where(and(eq(referralConversion.referredUserId, referredUserId), eq(referralConversion.status, "PENDING")))
    .returning({ id: referralConversion.id, referralCodeId: referralConversion.referralCodeId });
  if (!conversion) return;
  const [owner] = await tx.select({ userId: referralCode.userId }).from(referralCode).where(eq(referralCode.id, conversion.referralCodeId)).limit(1);
  if (!owner) return;
  await grantPoints(tx, { userId: owner.userId, reason: "REFERRAL_BONUS", delta: POINT_VALUES.REFERRAL_BONUS, referenceType: "referral_conversion", referenceId: conversion.id });
}

/**
 * Called from the Better Auth `user.create.after` hook, once the row already
 * exists. By this point `profileType` has already been strictly validated
 * by `enforceNewUserDefaults` (the `before` hook) — this only reads it back;
 * `legacyPersonaFromProfileType`'s STUDENT fallback is defense-in-depth, not
 * how malformed registration input is actually rejected (see
 * `parseRegistrationProfileType`). Idempotent: retries or double-fires
 * (e.g. a client retry after a dropped response) never create duplicate or
 * extra-primary rows because of the DB-level unique constraints on
 * (userId, persona) and on (userId) WHERE isPrimary.
 */
export async function ensurePrimaryPersonaMembership(userId: string, profileType: string): Promise<void> {
  const persona = legacyPersonaFromProfileType(profileType);
  const status = defaultStatusFor(persona);
  await db.transaction(async (tx) => {
    await tx
      .insert(personaMembership)
      .values({ userId, persona, status, isPrimary: true })
      .onConflictDoNothing();
    if (status === "ACTIVE") await maybeRewardReferral(tx, userId);
  });
}

/**
 * Phase 6: idempotently ensures a user holds an ACTIVE STUDENT persona
 * membership, for use inside the account-invitation claim transaction
 * (src/server/services/account-invitations.ts). Never removes/suspends any
 * other persona and never overwrites an existing different primary persona:
 * STUDENT is only ever marked primary when the user currently has none.
 * Idempotent under concurrency the same way `ensurePrimaryPersonaMembership`
 * is — `onConflictDoNothing` on the (userId, persona) unique constraint
 * means a duplicate call (or a losing race against the primary-partial-
 * unique-index) is always a safe no-op, never an error.
 */
export async function ensureStudentPersonaMembership(tx: DbClient, userId: string): Promise<void> {
  const [existingPrimary] = await tx
    .select({ id: personaMembership.id })
    .from(personaMembership)
    .where(and(eq(personaMembership.userId, userId), eq(personaMembership.isPrimary, true)))
    .limit(1);

  try {
    await tx
      .insert(personaMembership)
      .values({ userId, persona: "STUDENT", status: "ACTIVE", isPrimary: !existingPrimary })
      .onConflictDoNothing({ target: [personaMembership.userId, personaMembership.persona] });
  } catch {
    // Lost a race against a concurrent primary-persona grant for this user
    // (the partial unique index on isPrimary=true rejected this insert).
    // Retrying as non-primary is always safe: STUDENT membership itself is
    // still granted, just not as the (already-claimed-by-the-other-write)
    // primary persona.
    await tx
      .insert(personaMembership)
      .values({ userId, persona: "STUDENT", status: "ACTIVE", isPrimary: false })
      .onConflictDoNothing({ target: [personaMembership.userId, personaMembership.persona] });
  }
}

type PersonaMutationResult =
  | { kind: "ok"; from: PersonaStatus | null }
  | { kind: "not_found" };

type OnboardingPersonaResult = { kind: "ok" } | { kind: "locked" };

/**
 * Authoritative onboarding-time persona establishment/reconciliation. Not for
 * general self-service persona switching after onboarding — that remains
 * `adminSetPrimaryPersona`. Concurrency-safe via the same
 * `pg_advisory_xact_lock(hashtext(userId))` pattern as `adminSetPrimaryPersona`.
 *
 * Runs on the caller-supplied executor `tx` — the caller (e.g.
 * `completeUserProfile`) is responsible for opening the surrounding
 * `db.transaction`, so the advisory lock and the persona write share the same
 * transaction as the caller's `user`/`userProfile` writes instead of being
 * committed independently. Two concurrent onboarding submissions for the same
 * user still always serialize on the advisory lock.
 *
 * - No primary yet -> creates `persona` as primary.
 * - Primary already equals `persona` -> idempotent success, no writes.
 * - Primary differs and onboarding is not yet complete -> atomically
 *   reconciles: unsets the old primary, sets/creates `persona` as primary.
 * - Onboarding already complete and primary differs -> rejected ("locked").
 *   This onboarding path must never be usable to switch an already-onboarded
 *   user's primary persona; that remains an admin-only operation.
 *
 * Status is always computed server-side via `defaultStatusFor` (STUDENT/PARENT
 * auto-ACTIVE, professional personas PENDING_REVIEW) - never accepted from the
 * caller, so this can never be used to self-activate a professional persona.
 */
export async function establishOnboardingPersonaTx(
  tx: DbClient,
  userId: string,
  persona: Persona,
  onboardingAlreadyCompleted: boolean,
): Promise<OnboardingPersonaResult> {
  const status = defaultStatusFor(persona);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);

  const [existingPrimary] = await tx
    .select({ id: personaMembership.id, persona: personaMembership.persona })
    .from(personaMembership)
    .where(and(eq(personaMembership.userId, userId), eq(personaMembership.isPrimary, true)))
    .limit(1);

  if (existingPrimary?.persona === persona) return { kind: "ok" as const };
  if (onboardingAlreadyCompleted) return { kind: "locked" as const };

  if (existingPrimary) {
    await tx
      .update(personaMembership)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(personaMembership.id, existingPrimary.id));
  }

  await tx
    .insert(personaMembership)
    .values({ userId, persona, status, isPrimary: true })
    .onConflictDoUpdate({
      target: [personaMembership.userId, personaMembership.persona],
      set: { isPrimary: true, status, updatedAt: new Date() },
    });

  if (status === "ACTIVE") await maybeRewardReferral(tx, userId);

  return { kind: "ok" as const };
}

/** Standalone wrapper around {@link establishOnboardingPersonaTx} for call sites with no existing transaction. */
export async function establishOnboardingPersona(
  userId: string,
  persona: Persona,
  onboardingAlreadyCompleted: boolean,
): Promise<OnboardingPersonaResult> {
  return db.transaction((tx) => establishOnboardingPersonaTx(tx, userId, persona, onboardingAlreadyCompleted));
}

/** Admin-only: set (create or update) a persona's status for a user. Always audited. */
export async function adminSetPersonaStatus(
  actorUserId: string,
  targetUserId: string,
  persona: Persona,
  status: PersonaStatus,
): Promise<PersonaMutationResult> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ status: personaMembership.status })
      .from(personaMembership)
      .where(and(eq(personaMembership.userId, targetUserId), eq(personaMembership.persona, persona)))
      .limit(1);

    if (!existing) {
      await tx.insert(personaMembership).values({ userId: targetUserId, persona, status, isPrimary: false });
    } else {
      await tx
        .update(personaMembership)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(personaMembership.userId, targetUserId), eq(personaMembership.persona, persona)));
    }

    if (status === "ACTIVE" && existing?.status !== "ACTIVE") await maybeRewardReferral(tx, targetUserId);

    await tx.insert(auditLogs).values({
      actorUserId,
      action: `persona.status.${status.toLowerCase()}`,
      entityType: "persona_membership",
      entityId: targetUserId,
      metadata: { persona, from: existing?.status ?? null, to: status },
    });

    return { kind: "ok", from: (existing?.status as PersonaStatus | undefined) ?? null };
  });
}

/** Admin-only: mark an existing persona as the user's primary (unsets any other primary). */
export async function adminSetPrimaryPersona(actorUserId: string, targetUserId: string, persona: Persona) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${targetUserId}))`);
    const [existing] = await tx
      .select({ id: personaMembership.id })
      .from(personaMembership)
      .where(and(eq(personaMembership.userId, targetUserId), eq(personaMembership.persona, persona)))
      .limit(1);
    if (!existing) return { kind: "not_found" as const };

    await tx
      .update(personaMembership)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(personaMembership.userId, targetUserId), eq(personaMembership.isPrimary, true)));
    await tx
      .update(personaMembership)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(personaMembership.id, existing.id));

    await tx.insert(auditLogs).values({
      actorUserId,
      action: "persona.primary.set",
      entityType: "persona_membership",
      entityId: targetUserId,
      metadata: { persona },
    });

    return { kind: "ok" as const };
  });
}
