import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { establishmentEventRegistrations } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreatePartnerEstablishment } from "@/server/services/inclusive-ecosystem";

const registerEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  eventType: z.string().max(50).default("EVENT"),
});

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { establishment } = await getOrCreatePartnerEstablishment(session.user.id);

  const registrations = await db
    .select({ eventId: establishmentEventRegistrations.eventId })
    .from(establishmentEventRegistrations)
    .where(eq(establishmentEventRegistrations.establishmentId, establishment.id));

  return NextResponse.json({
    ok: true,
    registeredEventIds: registrations.map((r) => r.eventId),
  });
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (await isImpersonationActive(await headers())) {
    return NextResponse.json({ ok: false, error: "MUTATION_BLOCKED_IN_IMPERSONATION" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`est-event-reg:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = registerEventSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { establishment } = await getOrCreatePartnerEstablishment(session.user.id);
  const { eventId, eventType } = parsed.data;

  // Check if registration exists
  const [existing] = await db
    .select()
    .from(establishmentEventRegistrations)
    .where(
      and(
        eq(establishmentEventRegistrations.establishmentId, establishment.id),
        eq(establishmentEventRegistrations.eventId, eventId)
      )
    )
    .limit(1);

  if (existing) {
    // Toggle off / cancel registration
    await db
      .delete(establishmentEventRegistrations)
      .where(eq(establishmentEventRegistrations.id, existing.id));

    return NextResponse.json({ ok: true, isRegistered: false, eventId });
  }

  // Register
  await db.insert(establishmentEventRegistrations).values({
    establishmentId: establishment.id,
    eventId,
    eventType,
  });

  return NextResponse.json({ ok: true, isRegistered: true, eventId });
}
