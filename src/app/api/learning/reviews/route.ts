import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { learnerFlashcardReviews } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";
import {
  calculateSm2Review,
  getLearnerDailyReviewSummary,
} from "@/server/queries/learning-experience";

const reviewPostSchema = z.object({
  cardId: z.string().min(1),
  grade: z.number().int().min(1).max(4),
});

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const summary = await getLearnerDailyReviewSummary(session.user.id);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`reviews:${session.user.id}`, 60, 60);
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
  const parsed = reviewPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const { cardId, grade } = parsed.data;

  // Retrieve existing review state if available
  const existing = await db
    .select({
      id: learnerFlashcardReviews.id,
      easeFactor: learnerFlashcardReviews.easeFactor,
      intervalDays: learnerFlashcardReviews.intervalDays,
      repetitionCount: learnerFlashcardReviews.repetitionCount,
      lastGrade: learnerFlashcardReviews.lastGrade,
    })
    .from(learnerFlashcardReviews)
    .where(
      and(
        eq(learnerFlashcardReviews.userId, session.user.id),
        eq(learnerFlashcardReviews.cardId, cardId)
      )
    )
    .limit(1);

  const currentReps = existing[0]?.repetitionCount ?? 0;
  const currentEf = existing[0]?.easeFactor ?? 2.5;
  const currentInterval = existing[0]?.intervalDays ?? 0;

  const sm2Result = calculateSm2Review(grade, currentReps, currentEf, currentInterval);
  const now = new Date();

  if (existing.length > 0 && existing[0]) {
    await db
      .update(learnerFlashcardReviews)
      .set({
        easeFactor: sm2Result.easeFactor,
        intervalDays: sm2Result.intervalDays,
        repetitionCount: sm2Result.repetitionCount,
        nextReviewDate: sm2Result.nextReviewDate,
        lastReviewedAt: now,
        lastGrade: grade,
      })
      .where(eq(learnerFlashcardReviews.id, existing[0].id));
  } else {
    await db.insert(learnerFlashcardReviews).values({
      id: crypto.randomUUID(),
      userId: session.user.id,
      cardId,
      easeFactor: sm2Result.easeFactor,
      intervalDays: sm2Result.intervalDays,
      repetitionCount: sm2Result.repetitionCount,
      nextReviewDate: sm2Result.nextReviewDate,
      lastReviewedAt: now,
      lastGrade: grade,
    });
  }

  return NextResponse.json({
    success: true,
    cardId,
    grade,
    intervalDays: sm2Result.intervalDays,
    repetitionCount: sm2Result.repetitionCount,
    nextReviewDate: sm2Result.nextReviewDate.toISOString(),
  });
}
