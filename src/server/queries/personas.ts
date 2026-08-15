import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { personaMembership, type PersonaMembershipRow } from "@/server/db/schema";
import type { Persona } from "@/modules/personas/domain/permissions";

// React-cache-deduped per request: multiple checks (e.g. layout guard +
// page body) for the same user in one render pass hit the DB once.
export const getUserPersonas = cache(async (userId: string): Promise<PersonaMembershipRow[]> => {
  return db.select().from(personaMembership).where(eq(personaMembership.userId, userId));
});

export async function getPrimaryPersona(userId: string): Promise<PersonaMembershipRow | undefined> {
  const memberships = await getUserPersonas(userId);
  return memberships.find((row) => row.isPrimary);
}

export async function hasActivePersona(userId: string, persona: Persona): Promise<boolean> {
  const memberships = await getUserPersonas(userId);
  return memberships.some((row) => row.persona === persona && row.status === "ACTIVE");
}
