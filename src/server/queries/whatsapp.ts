import { and, asc, count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  crmContact,
  whatsappAccount,
  whatsappMessage,
  whatsappTemplate,
  type WhatsappAccountRow,
} from "@/server/db/schema";
import type {
  WhatsAppDirection,
  WhatsAppMessageStatus,
} from "@/modules/whatsapp/domain/permissions";

export async function getWhatsAppAccountForOrg(organizationId: string): Promise<WhatsappAccountRow | undefined> {
  const [row] = await db
    .select()
    .from(whatsappAccount)
    .where(eq(whatsappAccount.organizationId, organizationId))
    .limit(1);
  return row;
}

export async function listWhatsAppTemplates(organizationId: string): Promise<Array<typeof whatsappTemplate.$inferSelect>> {
  return db
    .select()
    .from(whatsappTemplate)
    .where(eq(whatsappTemplate.organizationId, organizationId))
    .orderBy(desc(whatsappTemplate.updatedAt));
}

/**
 * Resolves the organization's APPROVED template by name for Phase 6
 * system-initiated sends (invitation / OTP delivery), preferring
 * `preferredLanguage` when more than one approved language variant exists.
 * Returns undefined when no APPROVED template with that name is configured
 * for the organization -- callers must treat this as a controlled
 * NOT_CONFIGURED domain result, never an internal error.
 */
export async function getApprovedWhatsAppTemplateByName(
  organizationId: string,
  name: string,
  preferredLanguage: string,
): Promise<typeof whatsappTemplate.$inferSelect | undefined> {
  const rows = await db
    .select()
    .from(whatsappTemplate)
    .where(and(eq(whatsappTemplate.organizationId, organizationId), eq(whatsappTemplate.name, name), eq(whatsappTemplate.status, "APPROVED")));
  if (!rows.length) return undefined;
  return rows.find((row) => row.language === preferredLanguage) ?? rows[0];
}

export type WhatsappMessagesFilter = {
  organizationId: string;
  contactId?: string;
  direction?: WhatsAppDirection;
  status?: WhatsAppMessageStatus;
  page: number;
  pageSize: number;
};

const PAGE_SIZE_MAX = 100;

const sortColumns = {
  createdAt: whatsappMessage.createdAt,
  sentAt: whatsappMessage.sentAt,
  deliveredAt: whatsappMessage.deliveredAt,
  readAt: whatsappMessage.readAt,
  failedAt: whatsappMessage.failedAt,
} as const;
type WhatsappMessageSort = keyof typeof sortColumns;

export type WhatsappMessageWithContact = {
  id: string;
  organizationId: string;
  accountId: string | null;
  contactId: string | null;
  direction: string;
  messageType: string;
  status: string;
  providerMessageId: string | null;
  localRequestId: string | null;
  templateName: string | null;
  templateLanguage: string | null;
  textPreview: string | null;
  toPhone: string | null;
  fromPhone: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedAt: Date | null;
  providerErrorCode: string | null;
  providerErrorMessage: string | null;
  createdAt: Date;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactPhone: string | null;
};

export async function searchWhatsappMessages(
  filter: WhatsappMessagesFilter,
  sort: { column: string; direction: "asc" | "desc" },
): Promise<{ rows: WhatsappMessageWithContact[]; total: number }> {
  const pageSize = Math.min(Math.max(1, filter.pageSize), PAGE_SIZE_MAX);
  const offset = Math.max(0, filter.page - 1) * pageSize;

  const conditions: SQL[] = [eq(whatsappMessage.organizationId, filter.organizationId)];
  if (filter.contactId) conditions.push(eq(whatsappMessage.contactId, filter.contactId));
  if (filter.direction) conditions.push(eq(whatsappMessage.direction, filter.direction));
  if (filter.status) conditions.push(eq(whatsappMessage.status, filter.status));
  const where = and(...conditions);

  const sortKey: WhatsappMessageSort = sort.column in sortColumns ? (sort.column as WhatsappMessageSort) : "createdAt";
  const order = sort.direction === "asc" ? asc(sortColumns[sortKey]) : desc(sortColumns[sortKey]);

  const [totalResult, rows] = await Promise.all([
    db.select({ value: count() }).from(whatsappMessage).where(where),
    db
      .select({
        id: whatsappMessage.id,
        organizationId: whatsappMessage.organizationId,
        accountId: whatsappMessage.accountId,
        contactId: whatsappMessage.contactId,
        direction: whatsappMessage.direction,
        messageType: whatsappMessage.messageType,
        status: whatsappMessage.status,
        providerMessageId: whatsappMessage.providerMessageId,
        localRequestId: whatsappMessage.localRequestId,
        templateName: whatsappMessage.templateName,
        templateLanguage: whatsappMessage.templateLanguage,
        textPreview: whatsappMessage.textPreview,
        toPhone: whatsappMessage.toPhone,
        fromPhone: whatsappMessage.fromPhone,
        sentAt: whatsappMessage.sentAt,
        deliveredAt: whatsappMessage.deliveredAt,
        readAt: whatsappMessage.readAt,
        failedAt: whatsappMessage.failedAt,
        providerErrorCode: whatsappMessage.providerErrorCode,
        providerErrorMessage: whatsappMessage.providerErrorMessage,
        createdAt: whatsappMessage.createdAt,
        contactFirstName: crmContact.firstName,
        contactLastName: crmContact.lastName,
        contactPhone: crmContact.phone,
      })
      .from(whatsappMessage)
      .leftJoin(crmContact, eq(crmContact.id, whatsappMessage.contactId))
      .where(where)
      .orderBy(order)
      .limit(pageSize)
      .offset(offset),
  ]);

  const [{ value: total }] = totalResult;
  return { rows, total };
}

export async function getWhatsappMessageById(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(whatsappMessage)
    .where(and(eq(whatsappMessage.id, id), eq(whatsappMessage.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function getWhatsappMessageByProviderId(providerMessageId: string) {
  const [row] = await db
    .select()
    .from(whatsappMessage)
    .where(eq(whatsappMessage.providerMessageId, providerMessageId))
    .limit(1);
  return row;
}

export async function countWhatsappMessagesForOrg(organizationId: string): Promise<number> {
  const result = await db
    .select({ count: whatsappMessage.id })
    .from(whatsappMessage)
    .where(eq(whatsappMessage.organizationId, organizationId));
  return result.length;
}