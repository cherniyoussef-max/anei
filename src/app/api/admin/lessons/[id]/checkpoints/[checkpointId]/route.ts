import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { deleteCheckpoint } from "@/server/services/video-checkpoints";

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; checkpointId: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("courses.update");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  const checkpointId = idSchema.safeParse((await params).checkpointId);
  if (!checkpointId.success) return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  const deleted = await deleteCheckpoint(checkpointId.data);
  if (!deleted) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  await db.insert(auditLogs).values({ actorUserId: session.user.id, action: "admin.lesson.checkpoint.delete", entityType: "video_checkpoint", entityId: checkpointId.data });
  return NextResponse.json({ ok: true });
}
