import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { avsBookingRequests } from "@/server/db/schema";
import { getAdminSession, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const updateSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "DECLINED", "COMPLETED"]).optional(),
  action: z.enum(["release_escrow", "refund", "update_status"]).optional(),
  notes: z.string().max(1000).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { id } = await params;
  const body = await readLimitedJson(request).catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const [existing] = await db
    .select()
    .from(avsBookingRequests)
    .where(eq(avsBookingRequests.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const updates: Partial<typeof avsBookingRequests.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (parsed.data.action === "release_escrow") {
    updates.paymentStatus = "RELEASED_TO_AVS";
    updates.escrowReleasedAt = new Date();
    updates.status = "COMPLETED";
  } else if (parsed.data.action === "refund") {
    updates.paymentStatus = "REFUNDED_TO_PARENT";
    updates.refundedAt = new Date();
    updates.status = "DECLINED";
  } else if (parsed.data.status) {
    updates.status = parsed.data.status;
  }

  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes;
  }

  const [updated] = await db
    .update(avsBookingRequests)
    .set(updates)
    .where(eq(avsBookingRequests.id, id))
    .returning();

  return NextResponse.json({ ok: true, booking: updated });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const { id } = await params;
  await db.delete(avsBookingRequests).where(eq(avsBookingRequests.id, id));

  return NextResponse.json({ ok: true });
}
