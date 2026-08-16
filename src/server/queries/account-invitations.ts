import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { accountInvitation, type AccountInvitationRow } from "@/server/db/schema";

/** Admin-facing read: never returns tokenHash/rawToken material to the caller. */
export type AccountInvitationSummary = Pick<
  AccountInvitationRow,
  "id" | "status" | "destinationPhone" | "tokenExpiresAt" | "sentAt" | "phoneVerifiedAt" | "consumedAt" | "revokedAt" | "createdAt"
>;

export async function getAccountInvitationForContact(organizationId: string, contactId: string): Promise<AccountInvitationSummary | undefined> {
  const [row] = await db
    .select({
      id: accountInvitation.id,
      status: accountInvitation.status,
      destinationPhone: accountInvitation.destinationPhone,
      tokenExpiresAt: accountInvitation.tokenExpiresAt,
      sentAt: accountInvitation.sentAt,
      phoneVerifiedAt: accountInvitation.phoneVerifiedAt,
      consumedAt: accountInvitation.consumedAt,
      revokedAt: accountInvitation.revokedAt,
      createdAt: accountInvitation.createdAt,
    })
    .from(accountInvitation)
    .where(and(eq(accountInvitation.contactId, contactId), eq(accountInvitation.organizationId, organizationId)))
    .orderBy(desc(accountInvitation.createdAt))
    .limit(1);
  return row;
}
