import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/server/auth/session";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";
import { registerWebinarParticipant } from "@/server/services/webinars";
import { db } from "@/server/db";
import { webinars } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { WebinarFormField } from "@/lib/webinars";

const registerSchema = z.object({
  webinarId: z.string().uuid(),
  answers: z.record(z.string(), z.string()).optional().default({}),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  // 1. Mandatory account check
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "ACCOUNT_REQUIRED" },
      { status: 401 },
    );
  }

  const rate = await consumeRateLimit(`webinar-register:user:${session.user.id}`, 25, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 2. Validate custom form fields configured for this webinar
  const [webinar] = await db
    .select({ id: webinars.id, formFields: webinars.formFields, published: webinars.published })
    .from(webinars)
    .where(eq(webinars.id, parsed.data.webinarId))
    .limit(1);

  if (!webinar || !webinar.published) {
    return NextResponse.json({ error: "WEBINAR_NOT_FOUND" }, { status: 404 });
  }

  const configuredFields = (webinar.formFields as WebinarFormField[]) || [];
  const missingFields: string[] = [];

  for (const field of configuredFields) {
    if (field.required) {
      const val = parsed.data.answers[field.id];
      if (!val || typeof val !== "string" || !val.trim()) {
        missingFields.push(field.id);
      }
    }
  }

  if (missingFields.length > 0) {
    return NextResponse.json(
      { error: "MISSING_REQUIRED_FIELDS", missingFields },
      { status: 400 },
    );
  }

  // 3. Register user with their form answers
  const result = await registerWebinarParticipant({
    webinarId: parsed.data.webinarId,
    userId: session.user.id,
    answers: parsed.data.answers,
  });

  if (!result.ok) {
    const status = result.error === "WEBINAR_FULL" ? 409 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result, { status: 200 });
}
