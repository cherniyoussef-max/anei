import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  avsProfile,
  organizationProfile,
  personaMembership,
  specialistProfile,
  teacherProfile,
} from "@/server/db/schema";
import type { DbClient } from "@/server/services/personas";

/**
 * Every persona-specific profile table is owned by `persona_membership.id`,
 * not directly by `user_id` - this is what lets one account hold independent
 * TEACHER and SPECIALIST profiles without either overwriting the other. A
 * foreign key alone cannot express "this row must belong to a TEACHER
 * membership", so every upsert here re-reads the membership row and rejects
 * a mismatch before writing - the authoritative enforcement point for the
 * persona-type invariant (see src/server/db/schema.ts persona-profile
 * comment). Never accept a client-supplied personaMembershipId as authority;
 * callers must derive it server-side from the authenticated user's own
 * membership row.
 */
async function assertMembershipPersona(tx: DbClient, personaMembershipId: string, expectedPersona: string): Promise<void> {
  const [row] = await tx
    .select({ persona: personaMembership.persona })
    .from(personaMembership)
    .where(eq(personaMembership.id, personaMembershipId))
    .limit(1);
  if (!row) throw new Error(`persona_membership ${personaMembershipId} not found`);
  if (row.persona !== expectedPersona) {
    throw new Error(`persona_membership ${personaMembershipId} is ${row.persona}, expected ${expectedPersona}`);
  }
}

export type TeacherProfileInput = {
  discipline?: string | null;
  qualification?: string | null;
  experienceYears?: number | null;
  levelsTaught?: string[] | null;
  professionalInstitution?: string | null;
};

export async function upsertTeacherProfileTx(tx: DbClient, personaMembershipId: string, data: TeacherProfileInput) {
  await assertMembershipPersona(tx, personaMembershipId, "TEACHER");
  const now = new Date();
  await tx
    .insert(teacherProfile)
    .values({ personaMembershipId, ...data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: teacherProfile.personaMembershipId, set: { ...data, updatedAt: now } });
}

export type AvsProfileInput = {
  qualification?: string | null;
  experienceYears?: number | null;
  interventionDomains?: string[] | null;
};

export async function upsertAvsProfileTx(tx: DbClient, personaMembershipId: string, data: AvsProfileInput) {
  await assertMembershipPersona(tx, personaMembershipId, "AVS");
  const now = new Date();
  await tx
    .insert(avsProfile)
    .values({ personaMembershipId, ...data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: avsProfile.personaMembershipId, set: { ...data, updatedAt: now } });
}

export type SpecialistProfileInput = {
  specialty?: string | null;
  qualification?: string | null;
  experienceYears?: number | null;
  practiceStructure?: string | null;
  interventionDomains?: string[] | null;
};

export async function upsertSpecialistProfileTx(tx: DbClient, personaMembershipId: string, data: SpecialistProfileInput) {
  await assertMembershipPersona(tx, personaMembershipId, "SPECIALIST");
  const now = new Date();
  await tx
    .insert(specialistProfile)
    .values({ personaMembershipId, ...data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: specialistProfile.personaMembershipId, set: { ...data, updatedAt: now } });
}

export type OrganizationProfileInput = {
  organizationName?: string | null;
  organizationType?: string | null;
  representativeRole?: string | null;
};

export async function upsertOrganizationProfileTx(tx: DbClient, personaMembershipId: string, data: OrganizationProfileInput) {
  await assertMembershipPersona(tx, personaMembershipId, "ORGANIZATION");
  const now = new Date();
  await tx
    .insert(organizationProfile)
    .values({ personaMembershipId, ...data, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: organizationProfile.personaMembershipId, set: { ...data, updatedAt: now } });
}

/** Read-back helpers for profile display (dashboard/profil pages, admin review). Scoped to the caller-provided userId - never accept a client-supplied membership id. */
export async function getTeacherProfileForUser(userId: string) {
  const [row] = await db
    .select({ profile: teacherProfile })
    .from(teacherProfile)
    .innerJoin(personaMembership, eq(teacherProfile.personaMembershipId, personaMembership.id))
    .where(eq(personaMembership.userId, userId))
    .limit(1);
  return row?.profile ?? null;
}

export async function getAvsProfileForUser(userId: string) {
  const [row] = await db
    .select({ profile: avsProfile })
    .from(avsProfile)
    .innerJoin(personaMembership, eq(avsProfile.personaMembershipId, personaMembership.id))
    .where(eq(personaMembership.userId, userId))
    .limit(1);
  return row?.profile ?? null;
}

export async function getSpecialistProfileForUser(userId: string) {
  const [row] = await db
    .select({ profile: specialistProfile })
    .from(specialistProfile)
    .innerJoin(personaMembership, eq(specialistProfile.personaMembershipId, personaMembership.id))
    .where(eq(personaMembership.userId, userId))
    .limit(1);
  return row?.profile ?? null;
}

export async function getOrganizationProfileForUser(userId: string) {
  const [row] = await db
    .select({ profile: organizationProfile })
    .from(organizationProfile)
    .innerJoin(personaMembership, eq(organizationProfile.personaMembershipId, personaMembership.id))
    .where(eq(personaMembership.userId, userId))
    .limit(1);
  return row?.profile ?? null;
}
