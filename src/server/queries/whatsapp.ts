import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";
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
import { normalizeWhatsAppPhone, displayPhone, phonesMatch } from "@/server/whatsapp/phone";

export async function getWhatsAppAccountForOrg(organizationId: string): Promise<WhatsappAccountRow | undefined> {
  const [row] = await db
    .select()
    .from(whatsappAccount)
    .where(eq(whatsappAccount.organizationId, organizationId))
    .limit(1);
  return row;
}

export async function getOrCreateWhatsAppAccountForOrg(organizationId: string): Promise<WhatsappAccountRow> {
  const existing = await getWhatsAppAccountForOrg(organizationId);
  if (existing) return existing;

  const [created] = await db
    .insert(whatsappAccount)
    .values({
      organizationId,
      provider: "meta",
      phoneNumberId: `meta_phone_${organizationId.slice(0, 8)}`,
      businessAccountId: `meta_waba_${organizationId.slice(0, 8)}`,
      displayPhoneNumber: "+216 20 000 000",
      status: "ACTIVE",
    })
    .onConflictDoNothing()
    .returning();

  const defaultTemplates = [
    { name: "anei_welcome", language: "fr", category: "MARKETING", parameterCount: 1 },
    { name: "account_invitation", language: "fr", category: "UTILITY", parameterCount: 2 },
    { name: "otp_verification", language: "fr", category: "AUTHENTICATION", parameterCount: 1 },
  ];
  for (const t of defaultTemplates) {
    await db
      .insert(whatsappTemplate)
      .values({
        organizationId,
        name: t.name,
        language: t.language,
        category: t.category,
        parameterCount: t.parameterCount,
        status: "APPROVED",
        lastSyncedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  if (created) return created;
  const [fallback] = await db.select().from(whatsappAccount).where(eq(whatsappAccount.organizationId, organizationId)).limit(1);
  return fallback!;
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

export type WhatsAppDirectoryContact = {
  phone: string;
  displayPhone: string;
  name: string;
  email: string | null;
  persona: string | null;
  role: string | null;
  contactId: string | null;
  userId: string | null;
  source: "user" | "crm";
};

export async function getWhatsAppDirectoryContacts(organizationId: string): Promise<WhatsAppDirectoryContact[]> {
  const [userRows, crmRows] = await Promise.all([
    db.execute<{
      user_id: string;
      full_name: string;
      phone_number: string;
      email: string;
      role: string;
      requested_persona: string | null;
    }>(sql`
      SELECT 
        u.id as user_id,
        COALESCE(NULLIF(trim(u.name), ''), concat(up.first_name, ' ', up.last_name), 'Utilisateur') as full_name,
        up.phone_number,
        u.email,
        u.role,
        up.requested_persona
      FROM user_profile up
      JOIN "user" u ON u.id = up.user_id
      WHERE up.phone_number IS NOT NULL AND up.phone_number != ''
    `),
    db
      .select({
        id: crmContact.id,
        firstName: crmContact.firstName,
        lastName: crmContact.lastName,
        email: crmContact.email,
        phone: crmContact.phone,
        linkedUserId: crmContact.linkedUserId,
      })
      .from(crmContact)
      .where(and(eq(crmContact.organizationId, organizationId), eq(crmContact.status, "ACTIVE"))),
  ]);

  const map = new Map<string, WhatsAppDirectoryContact>();

  // Add CRM contacts
  for (const c of crmRows) {
    const norm = normalizeWhatsAppPhone(c.phone);
    if (!norm) continue;
    const name = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || c.email || norm;
    map.set(norm, {
      phone: norm,
      displayPhone: displayPhone(norm) ?? `+${norm}`,
      name,
      email: c.email ?? null,
      persona: null,
      role: null,
      contactId: c.id,
      userId: c.linkedUserId ?? null,
      source: "crm",
    });
  }

  // Add Users (updating or adding)
  for (const u of userRows.rows) {
    const norm = normalizeWhatsAppPhone(u.phone_number);
    if (!norm) continue;
    const existing = map.get(norm);
    if (existing) {
      existing.name = u.full_name || existing.name;
      existing.email = u.email || existing.email;
      existing.persona = u.requested_persona || existing.persona;
      existing.role = u.role || existing.role;
      existing.userId = u.user_id;
    } else {
      map.set(norm, {
        phone: norm,
        displayPhone: displayPhone(norm) ?? `+${norm}`,
        name: u.full_name,
        email: u.email,
        persona: u.requested_persona,
        role: u.role,
        contactId: null,
        userId: u.user_id,
        source: "user",
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export type WhatsAppConversationSummary = {
  peerPhone: string;
  displayPhone: string;
  contactName: string;
  contactEmail: string | null;
  persona: string | null;
  userRole: string | null;
  contactId: string | null;
  userId: string | null;
  lastMessage: {
    text: string;
    direction: "INBOUND" | "OUTBOUND";
    status: string;
    createdAt: Date;
    messageType: string;
  } | null;
  unreadCount: number;
  totalMessages: number;
};

export async function getWhatsAppConversations(organizationId: string): Promise<WhatsAppConversationSummary[]> {
  const rawThreads = await db.execute<{
    peer_phone: string;
    last_activity: Date;
    total_messages: number;
    unread_count: number;
    last_text: string | null;
    last_direction: "INBOUND" | "OUTBOUND";
    last_status: string;
    last_type: string;
  }>(sql`
    WITH thread_summary AS (
      SELECT 
        CASE WHEN direction = 'OUTBOUND' THEN to_phone ELSE from_phone END as peer_phone,
        max(created_at) as last_activity,
        count(*)::int as total_messages,
        count(*) FILTER (WHERE direction = 'INBOUND' AND status != 'READ')::int as unread_count
      FROM whatsapp_message
      WHERE organization_id = ${organizationId}
        AND ((to_phone IS NOT NULL AND to_phone != '') OR (from_phone IS NOT NULL AND from_phone != ''))
      GROUP BY 1
    )
    SELECT 
      s.peer_phone,
      s.last_activity,
      s.total_messages,
      s.unread_count,
      m.text_preview as last_text,
      m.direction as last_direction,
      m.status as last_status,
      m.message_type as last_type
    FROM thread_summary s
    JOIN whatsapp_message m ON (
      (m.direction = 'OUTBOUND' AND m.to_phone = s.peer_phone) OR
      (m.direction = 'INBOUND' AND m.from_phone = s.peer_phone)
    ) AND m.created_at = s.last_activity AND m.organization_id = ${organizationId}
    ORDER BY s.last_activity DESC
  `);

  const directory = await getWhatsAppDirectoryContacts(organizationId);
  const directoryByPhone = new Map<string, (typeof directory)[number]>();
  for (const item of directory) {
    directoryByPhone.set(item.phone, item);
  }

  return rawThreads.rows.map((row) => {
    const norm = normalizeWhatsAppPhone(row.peer_phone) ?? row.peer_phone;
    const match = directoryByPhone.get(norm) ?? directory.find((d) => phonesMatch(d.phone, norm));
    return {
      peerPhone: norm,
      displayPhone: displayPhone(norm) ?? `+${norm}`,
      contactName: match?.name ?? `Contact ${displayPhone(norm) ?? norm}`,
      contactEmail: match?.email ?? null,
      persona: match?.persona ?? null,
      userRole: match?.role ?? null,
      contactId: match?.contactId ?? null,
      userId: match?.userId ?? null,
      lastMessage: {
        text: row.last_text ?? (row.last_type === "TEMPLATE" ? "Modèle WhatsApp" : ""),
        direction: row.last_direction,
        status: row.last_status,
        createdAt: new Date(row.last_activity),
        messageType: row.last_type,
      },
      unreadCount: Number(row.unread_count) || 0,
      totalMessages: Number(row.total_messages) || 0,
    };
  });
}

export async function getWhatsAppConversationMessages(organizationId: string, peerPhone: string) {
  const norm = normalizeWhatsAppPhone(peerPhone) ?? peerPhone;
  return db
    .select({
      id: whatsappMessage.id,
      direction: whatsappMessage.direction,
      messageType: whatsappMessage.messageType,
      status: whatsappMessage.status,
      textPreview: whatsappMessage.textPreview,
      templateName: whatsappMessage.templateName,
      templateLanguage: whatsappMessage.templateLanguage,
      providerMessageId: whatsappMessage.providerMessageId,
      providerErrorMessage: whatsappMessage.providerErrorMessage,
      toPhone: whatsappMessage.toPhone,
      fromPhone: whatsappMessage.fromPhone,
      sentAt: whatsappMessage.sentAt,
      deliveredAt: whatsappMessage.deliveredAt,
      readAt: whatsappMessage.readAt,
      failedAt: whatsappMessage.failedAt,
      createdAt: whatsappMessage.createdAt,
    })
    .from(whatsappMessage)
    .where(
      and(
        eq(whatsappMessage.organizationId, organizationId),
        or(
          eq(whatsappMessage.toPhone, norm),
          eq(whatsappMessage.fromPhone, norm),
        ),
      ),
    )
    .orderBy(asc(whatsappMessage.createdAt));
}