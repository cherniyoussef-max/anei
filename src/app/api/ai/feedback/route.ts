import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { aiFeedbackLog } from "@/server/db/schema";
import { getSession } from "@/server/auth/session";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";

const feedbackSchema = z.object({
  rating: z.enum(["HELPFUL", "UNHELPFUL"]),
  comment: z.string().max(1000).optional(),
  queryText: z.string().max(3000).optional(),
  responseText: z.string().max(10000).optional(),
  sourcesUsed: z.any().optional(),
  category: z.string().max(100).optional(),
  locale: z.enum(["fr", "ar"]).default("fr"),
  messageId: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  if (!isTrustedMutation(req)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`ai:feedback:${requestFingerprint(req)}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many feedback submissions. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const rawBody = await readLimitedJson(req).catch(() => null);
    const parsed = feedbackSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.issues }, { status: 400 });
    }

    const session = await getSession().catch(() => null);
    const userId = session?.user?.id ?? null;

    const data = parsed.data;

    await db.insert(aiFeedbackLog).values({
      userId,
      messageId: data.messageId ?? null,
      rating: data.rating,
      comment: data.comment ?? null,
      queryText: data.queryText ?? null,
      responseText: data.responseText ?? null,
      sourcesUsed: data.sourcesUsed ?? null,
      category: data.category ?? null,
      locale: data.locale,
    });

    return NextResponse.json({ success: true, message: "Feedback recorded" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error recording feedback";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
