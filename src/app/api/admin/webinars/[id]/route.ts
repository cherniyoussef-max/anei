import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, webinars } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";

const idSchema = z.string().uuid();

/**
 * Soft-delete only: webinars can have registered attendees
 * (webinar_registrations references webinars.id ON DELETE CASCADE), so a hard
 * delete would silently destroy their registration history. Unpublishing
 * removes it from the public site while preserving that history, mirroring
 * the course archive convention.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("webinars.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const [webinar] = await db.update(webinars).set({ published: false }).where(eq(webinars.id, id.data)).returning({ id: webinars.id });
  if (!webinar) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "webinar.archive", entityType: "webinar", entityId: id.data });
  return NextResponse.json({ ok: true });
}
