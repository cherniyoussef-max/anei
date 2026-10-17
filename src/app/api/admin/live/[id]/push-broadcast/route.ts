import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, liveSessions } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isSudoModeActive } from "@/server/auth/sudo";
import { isTrustedMutation } from "@/server/security/origin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });

  // Exclusive SUPER_ADMIN permission
  const session = await getAdminSessionFor("live.broadcast.global");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  // Strict Sudo Mode requirement
  const sudoActive = await isSudoModeActive(request, session.user.id);
  if (!sudoActive) {
    return NextResponse.json(
      {
        error: "SUDO_REQUIRED",
        message: "Mode Sudo requis : veuillez confirmer votre mot de passe administrateur pour diffuser ce direct à tous les utilisateurs.",
      },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [existing] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const [updated] = await db
    .update(liveSessions)
    .set({
      status: "LIVE_NOW",
      isBroadcastPushed: true,
      updatedAt: new Date(),
    })
    .where(eq(liveSessions.id, id))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "admin.live.broadcast_push",
    entityType: "live_session",
    entityId: id,
    metadata: {
      titleFr: existing.titleFr,
      titleAr: existing.titleAr,
      provider: existing.provider,
    },
  });

  return NextResponse.json({ ok: true, session: updated });
}
