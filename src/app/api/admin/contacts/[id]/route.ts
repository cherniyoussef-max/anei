import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, contactMessages } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();

const schema = z.object({ status: z.enum(["new", "read", "closed"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("contacts.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const rawId = (await params).id;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const entityId = id.data;
  const [message] = await db.update(contactMessages).set({ status: parsed.data.status }).where(eq(contactMessages.id, entityId)).returning();
  if (!message) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "contact.status.update", entityType: "contactMessage", entityId, metadata: { status: parsed.data.status } });
  return NextResponse.json({ message });
}
