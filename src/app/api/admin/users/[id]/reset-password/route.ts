import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { adminMutationRateLimit, getSuperAdminSession } from "@/server/auth/admin";
import { db } from "@/server/db";
import { auditLogs, user } from "@/server/db/schema";
import { logger } from "@/server/security/logger";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const idSchema = z.string().uuid();
const schema = z.object({ locale: z.enum(["fr", "ar"]).default("fr") }).strict();

/**
 * The target email always comes from our own user lookup, never from the
 * request body — the admin only chooses *who* by id, not what address the
 * reset link is sent to.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getSuperAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  const parsed = schema.safeParse((await readLimitedJson(request).catch(() => null)) ?? {});
  if (!id.success || !parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const [target] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.id, id.data)).limit(1);
  if (!target) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Better Auth's own email send can fail (see sendMail, which rethrows in
  // production). A successful audit record must never precede a reset that
  // never actually went out.
  try {
    await auth.api.requestPasswordReset({
      body: { email: target.email, redirectTo: `/${parsed.data.locale}/reset-password` },
    });
  } catch (error) {
    logger.error("admin.password_reset_send_failed", { targetUserId: id.data, error: String(error) });
    return NextResponse.json({ error: "RESET_SEND_FAILED" }, { status: 502 });
  }

  try {
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "user.password_reset.initiate", entityType: "user", entityId: id.data });
  } catch (error) {
    // The reset email has already been sent and cannot be undone; losing the
    // audit row is a logging gap, not a reason to report failure to the admin.
    logger.error("admin.password_reset_audit_failed", { targetUserId: id.data, actorUserId: session.user.id, error: String(error) });
  }

  return NextResponse.json({ ok: true });
}
