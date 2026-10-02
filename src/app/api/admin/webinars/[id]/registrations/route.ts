import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  approveWebinarRegistration,
  getWebinarRegistrationsAdmin,
  getWebinarStats,
} from "@/server/services/webinars";
import { db } from "@/server/db";
import { auditLogs, webinars, webinarRegistrations } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import type { Locale } from "@/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getAdminSessionFor("webinars.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const [webinar] = await db
    .select({
      id: webinars.id,
      titleFr: webinars.titleFr,
      titleAr: webinars.titleAr,
      formFields: webinars.formFields,
      meetingProvider: webinars.meetingProvider,
      startsAt: webinars.startsAt,
      requireApproval: webinars.requireApproval,
    })
    .from(webinars)
    .where(eq(webinars.id, id))
    .limit(1);

  if (!webinar) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const [registrations, stats] = await Promise.all([
    getWebinarRegistrationsAdmin(id),
    getWebinarStats(id),
  ]);

  return NextResponse.json({
    webinar,
    registrations,
    stats,
  });
}

const mutationSchema = z.object({
  action: z.enum(["approve", "approve_all", "reject"]),
  registrationId: z.string().optional(),
  locale: z.enum(["fr", "ar", "en"]).optional().default("fr"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const { id: webinarId } = await params;
  const session = await getAdminSessionFor("webinars.manage");
  if (!session) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = mutationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { action, registrationId, locale } = parsed.data;

  if (action === "approve") {
    if (!registrationId) {
      return NextResponse.json({ error: "MISSING_REGISTRATION_ID" }, { status: 400 });
    }

    const result = await approveWebinarRegistration({
      registrationId,
      actorAdminId: session.user.id,
      locale: locale as Locale,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "webinar.registration.approve",
      entityType: "webinar_registration",
      entityId: registrationId,
    });

    return NextResponse.json(result);
  }

  if (action === "approve_all") {
    const pendingList = await db
      .select({ id: webinarRegistrations.id })
      .from(webinarRegistrations)
      .where(
        and(
          eq(webinarRegistrations.webinarId, webinarId),
          eq(webinarRegistrations.status, "PENDING_APPROVAL"),
        ),
      );

    const approvedIds: string[] = [];
    for (const item of pendingList) {
      const res = await approveWebinarRegistration({
        registrationId: item.id,
        actorAdminId: session.user.id,
        locale: locale as Locale,
      });
      if (res.ok) approvedIds.push(item.id);
    }

    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "webinar.registration.approve_all",
      entityType: "webinar",
      entityId: webinarId,
    });

    return NextResponse.json({ ok: true, count: approvedIds.length });
  }

  if (action === "reject") {
    if (!registrationId) {
      return NextResponse.json({ error: "MISSING_REGISTRATION_ID" }, { status: 400 });
    }

    await db
      .update(webinarRegistrations)
      .set({ status: "REJECTED" })
      .where(eq(webinarRegistrations.id, registrationId));

    await db.insert(auditLogs).values({
      actorUserId: session.user.id,
      action: "webinar.registration.reject",
      entityType: "webinar_registration",
      entityId: registrationId,
    });

    return NextResponse.json({ ok: true, status: "REJECTED" });
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 });
}
