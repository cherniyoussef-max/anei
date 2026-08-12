import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getSuperAdminSession } from "@/server/auth/admin";
import { revokeUserSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { auditLogs, user } from "@/server/db/schema";
import { logger } from "@/server/security/logger";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const schema = z.object({ role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!id.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  if (id.data === session.user.id && parsed.data.role !== "SUPER_ADMIN") return NextResponse.json({ error: "CANNOT_DEMOTE_SELF" }, { status: 409 });

  const result = await db.transaction(async (tx) => {
    // Serialize privileged role changes so two concurrent requests cannot both demote the final super-admin.
    await tx.execute(sql`select pg_advisory_xact_lock(615946241)`);
    const [target] = await tx.select({ id: user.id, role: user.role }).from(user).where(eq(user.id, id.data)).limit(1);
    if (!target) return { kind: "not_found" as const };
    if (target.role === "SUPER_ADMIN" && parsed.data.role !== "SUPER_ADMIN") {
      const [{ value }] = await tx.select({ value: count() }).from(user).where(eq(user.role, "SUPER_ADMIN"));
      if (value <= 1) return { kind: "last_super_admin" as const };
    }
    const [updated] = await tx.update(user).set({ role: parsed.data.role, updatedAt: new Date() }).where(eq(user.id, id.data)).returning({ id: user.id, role: user.role });
    await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: "user.role.update", entityType: "user", entityId: id.data, metadata: { from: target.role, to: parsed.data.role } });
    return { kind: "ok" as const, updated, roleChanged: target.role !== parsed.data.role };
  });

  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "last_super_admin") return NextResponse.json({ error: "LAST_SUPER_ADMIN" }, { status: 409 });

  // The role change is already committed and authoritative; a stale existing
  // session must not keep authorizing on the old role. Revocation is best-effort:
  // it never rolls back the already-committed role update, it only forces the
  // affected user to re-authenticate so their next session reflects the new role.
  if (result.roleChanged) {
    try {
      await revokeUserSessions(id.data);
    } catch (error) {
      logger.error("admin.role_session_revocation_failed", { userId: id.data, error: String(error) });
    }
  }

  return NextResponse.json({ user: result.updated });
}
