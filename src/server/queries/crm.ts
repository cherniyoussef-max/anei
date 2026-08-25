import { and, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import {
  crmContact,
  crmContactActivity,
  crmContactNote,
  crmContactTag,
  crmPipeline,
  crmPipelineStage,
  crmTag,
  organization,
  userProfile,
  type CrmContactRow,
} from "@/server/db/schema";

export async function searchGlobalCrmContacts(rawQuery: string, rawPage?: number) {
  const { page, pageSize, offset } = crmPageBounds(rawPage, 25);
  const q = rawQuery.trim().slice(0, 100);
  if (!q) return { items: [], total: 0, page, pageSize, totalPages: 1 };
  const phoneQuery = q.replace(/\D/g, "");
  const search = or(
    ilike(crmContact.firstName, `%${q}%`),
    ilike(crmContact.lastName, `%${q}%`),
    ilike(sql<string>`concat(${crmContact.firstName}, ' ', ${crmContact.lastName})`, `%${q}%`),
    ilike(crmContact.email, `%${q}%`),
    ilike(crmContact.id, `%${q}%`),
    ilike(organization.name, `%${q}%`),
    ilike(userProfile.requestedPersona, `%${q}%`),
    ...(phoneQuery ? [ilike(sql<string>`regexp_replace(coalesce(${crmContact.phone}, ''), '[^0-9]', '', 'g')`, `%${phoneQuery}%`)] : []),
  )!;
  const base = db.select({
    id: crmContact.id,
    organizationId: crmContact.organizationId,
    organizationName: organization.name,
    firstName: crmContact.firstName,
    lastName: crmContact.lastName,
    email: crmContact.email,
    phone: crmContact.phone,
    status: crmContact.status,
    persona: userProfile.requestedPersona,
    updatedAt: crmContact.updatedAt,
  }).from(crmContact)
    .innerJoin(organization, eq(crmContact.organizationId, organization.id))
    .leftJoin(userProfile, eq(crmContact.linkedUserId, userProfile.userId));
  const [countRows, items] = await Promise.all([
    db.select({ value: count() }).from(crmContact)
      .innerJoin(organization, eq(crmContact.organizationId, organization.id))
      .leftJoin(userProfile, eq(crmContact.linkedUserId, userProfile.userId))
      .where(search),
    base.where(search).orderBy(desc(crmContact.updatedAt)).limit(pageSize).offset(offset),
  ]);
  const total = countRows[0]?.value ?? 0;
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

function crmPageBounds(page?: number, pageSize = 25) {
  const safePage = Number.isSafeInteger(page) && (page ?? 0) > 0 ? page! : 1;
  const safeSize = Math.min(100, Math.max(10, pageSize));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

const sortColumns = { createdAt: crmContact.createdAt, updatedAt: crmContact.updatedAt } as const;
type CrmContactSort = keyof typeof sortColumns;

export type CrmContactSearchInput = {
  organizationId: string;
  q?: string;
  status?: string;
  stageId?: string;
  tagId?: string;
  assignedToUserId?: string;
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Every filter is bounded and every sort field is server-allowlisted
 * (`sortColumns`) — the client can never inject raw SQL, matching
 * `searchAdminUsers`'s shape (src/server/queries/admin.ts). `organizationId`
 * is always required and is never itself sufficient authorization — callers
 * must have already verified the caller may act within it.
 */
export async function searchCrmContacts(input: CrmContactSearchInput) {
  const { page, pageSize, offset } = crmPageBounds(input.page, input.pageSize);
  const filters: SQL[] = [eq(crmContact.organizationId, input.organizationId)];

  const q = input.q?.trim().slice(0, 100);
  if (q) {
    filters.push(
      or(
        ilike(crmContact.firstName, `%${q}%`),
        ilike(crmContact.lastName, `%${q}%`),
        ilike(crmContact.email, `%${q}%`),
        ilike(crmContact.phone, `%${q}%`),
      )!,
    );
  }
  if (input.status === "ACTIVE" || input.status === "ARCHIVED") filters.push(eq(crmContact.status, input.status));
  if (input.stageId) filters.push(eq(crmContact.currentStageId, input.stageId));
  if (input.assignedToUserId) filters.push(eq(crmContact.assignedToUserId, input.assignedToUserId));

  let contactIdsForTag: string[] | undefined;
  if (input.tagId) {
    const rows = await db.select({ contactId: crmContactTag.contactId }).from(crmContactTag).where(eq(crmContactTag.tagId, input.tagId));
    contactIdsForTag = rows.map((r) => r.contactId);
    filters.push(inArray(crmContact.id, contactIdsForTag.length ? contactIdsForTag : ["__none__"]));
  }

  const where = and(...filters)!;
  const sortKey: CrmContactSort = input.sort && input.sort in sortColumns ? (input.sort as CrmContactSort) : "createdAt";
  const orderCol = sortColumns[sortKey];
  const orderBy = input.direction === "asc" ? orderCol : desc(orderCol);

  const [countRows, items] = await Promise.all([
    db.select({ value: count() }).from(crmContact).where(where),
    db.select().from(crmContact).where(where).orderBy(orderBy).limit(pageSize).offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Sole read authorization primitive for a single contact: `organizationId`
 * is checked *against* the row, never trusted as authorization on its own
 * (mirrors `getOwnOrganizationMembership`).
 */
export async function getCrmContact(organizationId: string, contactId: string): Promise<CrmContactRow | undefined> {
  const [row] = await db
    .select()
    .from(crmContact)
    .where(and(eq(crmContact.id, contactId), eq(crmContact.organizationId, organizationId)))
    .limit(1);
  return row;
}

/** Batched contact->tags lookup for a page of contacts — avoids N+1 queries in the list view. */
export async function getTagsForContacts(contactIds: string[]) {
  if (!contactIds.length) return new Map<string, { id: string; name: string }[]>();
  const rows = await db
    .select({ contactId: crmContactTag.contactId, id: crmTag.id, name: crmTag.name })
    .from(crmContactTag)
    .innerJoin(crmTag, eq(crmTag.id, crmContactTag.tagId))
    .where(inArray(crmContactTag.contactId, contactIds));
  const map = new Map<string, { id: string; name: string }[]>();
  for (const row of rows) {
    const list = map.get(row.contactId) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.contactId, list);
  }
  return map;
}

export async function getContactTags(contactId: string) {
  return db
    .select({ id: crmTag.id, name: crmTag.name })
    .from(crmContactTag)
    .innerJoin(crmTag, eq(crmTag.id, crmContactTag.tagId))
    .where(eq(crmContactTag.contactId, contactId));
}

export async function listCrmTags(organizationId: string) {
  return db.select().from(crmTag).where(eq(crmTag.organizationId, organizationId)).orderBy(crmTag.name);
}

export async function listCrmPipelines(organizationId: string) {
  return db.select().from(crmPipeline).where(eq(crmPipeline.organizationId, organizationId)).orderBy(crmPipeline.name);
}

export async function listCrmPipelineStages(pipelineId: string) {
  return db.select().from(crmPipelineStage).where(eq(crmPipelineStage.pipelineId, pipelineId)).orderBy(crmPipelineStage.position);
}

/** Batched pipeline->stages lookup for a page listing multiple pipelines — avoids N+1 queries. */
export async function getStagesForPipelines(pipelineIds: string[]) {
  if (!pipelineIds.length) return [];
  return db.select().from(crmPipelineStage).where(inArray(crmPipelineStage.pipelineId, pipelineIds)).orderBy(crmPipelineStage.position);
}

/** Scoped stage lookup — the sole authorization primitive for stage-scoped writes. */
export async function getCrmPipelineStage(organizationId: string, stageId: string) {
  const [row] = await db
    .select()
    .from(crmPipelineStage)
    .where(and(eq(crmPipelineStage.id, stageId), eq(crmPipelineStage.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function getCrmPipeline(organizationId: string, pipelineId: string) {
  const [row] = await db
    .select()
    .from(crmPipeline)
    .where(and(eq(crmPipeline.id, pipelineId), eq(crmPipeline.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function getCrmTag(organizationId: string, tagId: string) {
  const [row] = await db
    .select()
    .from(crmTag)
    .where(and(eq(crmTag.id, tagId), eq(crmTag.organizationId, organizationId)))
    .limit(1);
  return row;
}

export async function getContactNotes(contactId: string, page?: number, pageSize?: number) {
  const { page: safePage, pageSize: safeSize, offset } = crmPageBounds(page, pageSize ?? 25);
  const [countRows, items] = await Promise.all([
    db.select({ value: count() }).from(crmContactNote).where(eq(crmContactNote.contactId, contactId)),
    db
      .select()
      .from(crmContactNote)
      .where(eq(crmContactNote.contactId, contactId))
      .orderBy(desc(crmContactNote.createdAt))
      .limit(safeSize)
      .offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page: safePage, pageSize: safeSize, totalPages: Math.max(1, Math.ceil(total / safeSize)) };
}

export async function getContactActivity(contactId: string, page?: number, pageSize?: number) {
  const { page: safePage, pageSize: safeSize, offset } = crmPageBounds(page, pageSize ?? 25);
  const [countRows, items] = await Promise.all([
    db.select({ value: count() }).from(crmContactActivity).where(eq(crmContactActivity.contactId, contactId)),
    db
      .select()
      .from(crmContactActivity)
      .where(eq(crmContactActivity.contactId, contactId))
      .orderBy(desc(crmContactActivity.createdAt))
      .limit(safeSize)
      .offset(offset),
  ]);
  const [{ value: total }] = countRows;
  return { items, total, page: safePage, pageSize: safeSize, totalPages: Math.max(1, Math.ceil(total / safeSize)) };
}
