import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSuperAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { db } from "@/server/db";
import { user } from "@/server/db/schema";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  IMPERSONATION_TTL_MS,
  recordImpersonationAudit,
  setImpersonationCookie,
  signImpersonationToken,
} from "@/server/auth/impersonation";

const schema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
}).strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSuperAdminSession();
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Trop de requêtes administratives." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const { targetUserId, reason } = parsed.data;

  if (targetUserId === session.user.id) {
    return NextResponse.json({ error: "CANNOT_IMPERSONATE_SELF" }, { status: 400 });
  }

  const [targetUser] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
    .limit(1);

  if (!targetUser) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const now = Date.now();
  const expiresAt = new Date(now + IMPERSONATION_TTL_MS);

  const token = signImpersonationToken({
    impersonatorId: session.user.id,
    impersonatorName: session.user.name,
    impersonatorEmail: session.user.email,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    targetUserEmail: targetUser.email,
    startedAt: now,
    expiresAt: expiresAt.getTime(),
  });

  await recordImpersonationAudit(session.user.id, targetUser.id, "start", {
    reason: reason || "Support inspection",
    targetEmail: targetUser.email,
  });

  const response = NextResponse.json({
    ok: true,
    redirectUrl: "/fr/dashboard",
    targetUser: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
  });

  setImpersonationCookie(response, token, expiresAt);
  return response;
}
