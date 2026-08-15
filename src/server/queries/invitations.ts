import { and, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accountInvitation,
  accountInvitationEvent,
  accountVerificationChallenge,
  admission,
  crmContact,
  organization,
  user,
  type AccountInvitationRow,
} from "@/server/db/schema";
import { invitationLiveStatuses, type InvitationStatus } from "@/modules/invitation/domain/permissions";

/**
 * READ-ONLY invitation queries. `organizationId` is always required and is
 * never authorization by itself — callers must have already verified the
 * caller may act within it (same contract as `searchCrmContacts` /
 * `searchAdmissions`). The token lookup key is the SHA-256 digest of the raw
 * token; the raw token never enters this module.
 */

export async function getInvitation(organizationId: string, invitationId: string): Promise<AccountInvitationRow | undefined> {
  const [row] = await db
    .select()
    .from(accountInvitation)
    .where(and(eq(accountInvitation.id, invitationId), eq(accountInvitation.organizationId, organizationId)))
    .limit(1);
  return row;
}

function invitationPageBounds(page?: number, pageSize = 25) {
  const safePage = Number.isSafeInteger(page) && (page ?? 0) > 0 ? page! : 1;
  const safeSize = Math.min(100, Math.max(10, pageSize));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

export type InvitationListItem = AccountInvitationRow & {
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
  contactLinkedUserId: string | null;
};

export async function searchInvitations(
  organizationId: string,
  filter: { status?: string; contactId?: string; page?: number; pageSize?: number },
) {
  const { page, pageSize, offset } = invitationPageBounds(filter.page, filter.pageSize);
  const conditions: SQL[] = [eq(accountInvitation.organizationId, organizationId)];
  if (filter.contactId) conditions.push(eq(accountInvitation.contactId, filter.contactId));
  if (filter.status) conditions.push(eq(accountInvitation.status, filter.status));
  const where = and(...conditions)!;

  const [countRows, rows] = await Promise.all([
    db.select({ value: count() }).from(accountInvitation).where(where),
    db.select().from(accountInvitation).where(where).orderBy(desc(accountInvitation.createdAt)).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;

  const contacts = await db
    .select({ id: crmContact.id, firstName: crmContact.firstName, lastName: crmContact.lastName, phone: crmContact.phone, linkedUserId: crmContact.linkedUserId })
    .from(crmContact)
    .where(inArray(crmContact.id, rows.map((r) => r.contactId)));
  const contactMap = new Map(contacts.map((c) => [c.id, c]));

  const items: InvitationListItem[] = rows.map((row) => ({
    ...row,
    contactFirstName: contactMap.get(row.contactId)?.firstName ?? null,
    contactLastName: contactMap.get(row.contactId)?.lastName ?? null,
    contactPhone: contactMap.get(row.contactId)?.phone ?? null,
    contactLinkedUserId: contactMap.get(row.contactId)?.linkedUserId ?? null,
  }));
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getInvitationForContact(organizationId: string, contactId: string): Promise<AccountInvitationRow | undefined> {
  const [row] = await db
    .select()
    .from(accountInvitation)
    .where(and(eq(accountInvitation.organizationId, organizationId), eq(accountInvitation.contactId, contactId)))
    .orderBy(desc(accountInvitation.createdAt))
    .limit(1);
  return row;
}

/**
 * Resolves an invitation by the SHA-256 digest of its raw token. Returns the
 * joined detail the invitation page needs (organization name, masked phone,
 * intended persona, created-by). Never returns the raw token or its hash to
 * callers that would leak it.
 */
export async function getInvitationByTokenHash(tokenHash: string) {
  const [row] = await db
    .select({
      invitation: accountInvitation,
      contact: {
        id: crmContact.id,
        firstName: crmContact.firstName,
        lastName: crmContact.lastName,
        linkedUserId: crmContact.linkedUserId,
      },
      organization: { id: organization.id, name: organization.name },
      createdBy: { id: user.id, name: user.name },
    })
    .from(accountInvitation)
    .innerJoin(crmContact, eq(crmContact.id, accountInvitation.contactId))
    .innerJoin(organization, eq(organization.id, accountInvitation.organizationId))
    .leftJoin(user, eq(user.id, accountInvitation.createdByUserId))
    .where(eq(accountInvitation.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function getInvitationEvents(invitationId: string) {
  return db
    .select()
    .from(accountInvitationEvent)
    .where(eq(accountInvitationEvent.invitationId, invitationId))
    .orderBy(accountInvitationEvent.createdAt);
}

export async function getActiveChallenge(invitationId: string) {
  const [row] = await db
    .select()
    .from(accountVerificationChallenge)
    .where(and(eq(accountVerificationChallenge.invitationId, invitationId), eq(accountVerificationChallenge.status, "ACTIVE")))
    .limit(1);
  return row;
}

export async function getAcceptedAdmissionForContact(organizationId: string, contactId: string) {
  const [row] = await db
    .select()
    .from(admission)
    .where(and(eq(admission.organizationId, organizationId), eq(admission.contactId, contactId), eq(admission.decision, "ACCEPTED")))
    .orderBy(desc(admission.createdAt))
    .limit(1);
  return row;
}

export async function countInvitationEvents(invitationId: string, eventType: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(accountInvitationEvent)
    .where(and(eq(accountInvitationEvent.invitationId, invitationId), eq(accountInvitationEvent.eventType, eventType)));
  return row?.value ?? 0;
}

export async function latestInvitationEventAt(invitationId: string, eventType: string): Promise<Date | null> {
  const [row] = await db
    .select({ createdAt: accountInvitationEvent.createdAt })
    .from(accountInvitationEvent)
    .where(and(eq(accountInvitationEvent.invitationId, invitationId), eq(accountInvitationEvent.eventType, eventType)))
    .orderBy(desc(accountInvitationEvent.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

export function isLiveInvitationStatus(status: string | null | undefined): status is InvitationStatus {
  return invitationLiveStatuses.includes(status as InvitationStatus);
}

export type { AccountInvitationRow };