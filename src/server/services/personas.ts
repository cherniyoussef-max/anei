import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, personaMembership } from "@/server/db/schema";
import {
  defaultStatusFor,
  legacyPersonaFromProfileType,
  type Persona,
  type PersonaStatus,
} from "@/modules/personas/domain/permissions";

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
  await db
    .insert(personaMembership)
    .values({ userId, persona, status: defaultStatusFor(persona), isPrimary: true })
    .onConflictDoNothing();
}

type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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
