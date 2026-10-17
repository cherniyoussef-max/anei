import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { auditLogs, liveSessions } from "@/server/db/schema";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { liveSessionCreateSchema } from "@/lib/live-validation";
import { getLiveSessionsForAdmin } from "@/server/queries/live";

export async function GET() {
  const session = await getAdminSessionFor("live.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const sessions = await getLiveSessionsForAdmin();
    return NextResponse.json({ sessions });
  } catch (_error) {
    return NextResponse.json({ error: "FETCH_FAILED" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = liveSessionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  // Creating a global broadcast requires exclusive SUPER_ADMIN permission
  if (parsed.data.scope === "GLOBAL_WEBINAR" || parsed.data.isBroadcastPushed) {
    if (!hasAdminPermission(session.user.role, "live.broadcast.global")) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Seul un Super Admin peut créer un webinaire global diffusé à toute la plateforme." },
        { status: 403 }
      );
    }
  }

  try {
    const [created] = await db
      .insert(liveSessions)
      .values({
        ...parsed.data,
        createdById: session.user.id,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "admin.live.create",
      entityType: "live_session",
      entityId: created.id,
      metadata: {
        titleFr: created.titleFr,
        scope: created.scope,
        provider: created.provider,
        status: created.status,
      },
    });

    return NextResponse.json({ session: created }, { status: 201 });
  } catch (_err) {
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 409 });
  }
}
