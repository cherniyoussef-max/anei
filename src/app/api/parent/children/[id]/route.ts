import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSession } from "@/server/auth/session";
import { hasActivePersona } from "@/server/queries/personas";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { db } from "@/server/db";
import { auditLogs, parentStudentLink } from "@/server/db/schema";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const isParent = await hasActivePersona(session.user.id, "PARENT");
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(String(session.user.role));
  if (!isParent && !isAdmin) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`parent-unlink-child:${session.user.id}`, 10, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id: linkId } = await params;

  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(parentStudentLink)
        .where(
          and(
            eq(parentStudentLink.id, linkId),
            isAdmin ? undefined : eq(parentStudentLink.parentUserId, session.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }

      await tx
        .update(parentStudentLink)
        .set({ status: "REVOKED", updatedAt: new Date() })
        .where(eq(parentStudentLink.id, linkId));

      await tx.insert(auditLogs).values({
        actorUserId: session.user.id,
        action: "relationship.parentLink.revoked",
        entityType: "parent_student_link",
        entityId: linkId,
        metadata: {
          parentUserId: existing.parentUserId,
          studentUserId: existing.studentUserId,
        },
      });

      return NextResponse.json({ ok: true, id: linkId });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNLINK_FAILED";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
