import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { auditLogs, liveSessions } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";
import { isSudoModeActive } from "@/server/auth/sudo";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { liveSessionUpdateSchema } from "@/lib/live-validation";
import { getLiveSessionAttendees, getLiveSessionById } from "@/server/queries/live";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFor("live.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const liveSession = await getLiveSessionById(id);
  if (!liveSession) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const attendees = await getLiveSessionAttendees(id);

  return NextResponse.json({ session: liveSession, attendees });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });

  const session = await getAdminSessionFor("live.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = liveSessionUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Elevating scope to GLOBAL_WEBINAR or broadcasting requires SUPER_ADMIN
  if (parsed.data.scope === "GLOBAL_WEBINAR" || parsed.data.isBroadcastPushed) {
    if (!hasAdminPermission(session.user.role, "live.broadcast.global")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Seul un Super Admin peut modifier un webinaire global ou activer la diffusion push." },
        { status: 403 }
      );
    }
  }

  const [existing] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const [updated] = await db
    .update(liveSessions)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
    })
    .where(eq(liveSessions.id, id))
    .returning();

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "admin.live.status_change",
    entityType: "live_session",
    entityId: id,
    metadata: {
      fromStatus: existing.status,
      toStatus: updated.status,
      changes: parsed.data,
    },
  });

  return NextResponse.json({ session: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });

  // Deletion is reserved exclusively for SUPER_ADMIN
  const session = await getAdminSessionFor("live.broadcast.global");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  // Mode Sudo Verification
  const sudoActive = await isSudoModeActive(request, session.user.id);
  if (!sudoActive) {
    return NextResponse.json(
      {
        error: "SUDO_REQUIRED",
        message: "Mode Sudo requis : veuillez confirmer votre mot de passe administrateur pour supprimer cette session live.",
      },
      { status: 403 }
    );
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  const [existing] = await db.select().from(liveSessions).where(eq(liveSessions.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await db.delete(liveSessions).where(eq(liveSessions.id, id));

  await db.insert(auditLogs).values({
    actorUserId: session.user.id,
    action: "admin.live.delete",
    entityType: "live_session",
    entityId: id,
    metadata: { titleFr: existing.titleFr, scope: existing.scope },
  });

  return NextResponse.json({ ok: true, deletedId: id });
}
