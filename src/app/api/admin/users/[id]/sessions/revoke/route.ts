import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { revokeUserSessions } from "@/server/auth/session";
import { invalidateAdminUserCaches } from "@/server/cache/admin-users";
import { db } from "@/server/db";
import { auditLogs, user } from "@/server/db/schema";
import { logger } from "@/server/security/logger";
import { isTrustedMutation } from "@/server/security/origin";

const idSchema = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSessionFor("users.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const id = idSchema.safeParse((await params).id);
  if (!id.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const userId = id.data;

  const [target] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (!target) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    await revokeUserSessions(userId);
  } catch (error) {
    logger.error("admin.revoke_sessions_failed", { userId, error: String(error) });
    return NextResponse.json({ error: "REVOCATION_FAILED" }, { status: 500 });
  }

  try {
    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "user.sessions.revoke_all",
      entityType: "user",
      entityId: userId,
      metadata: { targetEmail: target.email, revokedBy: session.user.email },
    });
  } catch (error) {
    logger.error("admin.revoke_sessions_audit_failed", { userId, error: String(error) });
  }

  await invalidateAdminUserCaches(userId);

  return NextResponse.json({ ok: true });
}
