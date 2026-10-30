import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { learnerPracticeLogs } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const practiceSchema = z.object({
  actionId: z.string().min(1),
  triedIt: z.boolean(),
  reflectionNote: z.string().max(5000).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`practice:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = practiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const { actionId, triedIt, reflectionNote } = parsed.data;

  const existing = await db
    .select({ id: learnerPracticeLogs.id })
    .from(learnerPracticeLogs)
    .where(
      and(
        eq(learnerPracticeLogs.userId, session.user.id),
        eq(learnerPracticeLogs.practiceActionId, actionId)
      )
    )
    .limit(1);

  const now = new Date();

  if (existing.length > 0 && existing[0]) {
    await db
      .update(learnerPracticeLogs)
      .set({
        triedIt,
        reflectionNote: reflectionNote ?? null,
        loggedAt: now,
      })
      .where(eq(learnerPracticeLogs.id, existing[0].id));

    return NextResponse.json({
      success: true,
      log: { id: existing[0].id, actionId, triedIt, reflectionNote, loggedAt: now },
    });
  }

  const id = crypto.randomUUID();
  await db.insert(learnerPracticeLogs).values({
    id,
    userId: session.user.id,
    practiceActionId: actionId,
    triedIt,
    reflectionNote: reflectionNote ?? null,
    loggedAt: now,
  });

  return NextResponse.json({
    success: true,
    log: { id, actionId, triedIt, reflectionNote, loggedAt: now },
  });
}
