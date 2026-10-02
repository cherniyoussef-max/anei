import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { hasActivePersona } from "@/server/queries/personas";
import { requestCareRelationship } from "@/server/services/care-relationships";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";

const requestCareSchema = z
  .object({
    studentUserId: z.string().min(1),
    specialistUserId: z.string().min(1),
    requestMessage: z.string().max(1000).optional().nullable(),
    consentAccepted: z.literal(true),
    consentVersion: z.string().default("v1.0"),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`care-request:${session.user.id}`, 15, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const isParent = await hasActivePersona(session.user.id, "PARENT");
  if (!isParent) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = requestCareSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await requestCareRelationship({
    parentUserId: session.user.id,
    studentUserId: parsed.data.studentUserId,
    specialistUserId: parsed.data.specialistUserId,
    requestMessage: parsed.data.requestMessage,
    consentAccepted: parsed.data.consentAccepted,
    consentVersion: parsed.data.consentVersion,
  });

  if (result.kind === "consent_required") {
    return NextResponse.json({ error: "CONSENT_REQUIRED" }, { status: 400 });
  }
  if (result.kind === "forbidden_student") {
    return NextResponse.json({ error: "FORBIDDEN_STUDENT" }, { status: 403 });
  }
  if (result.kind === "invalid_persona") {
    return NextResponse.json({ error: "INVALID_PERSONA" }, { status: 403 });
  }
  if (result.kind === "specialist_not_active") {
    return NextResponse.json({ error: "SPECIALIST_NOT_ACTIVE" }, { status: 400 });
  }
  if (result.kind === "already_exists") {
    return NextResponse.json({ error: "ALREADY_EXISTS" }, { status: 409 });
  }
  if (result.kind === "self_assignment") {
    return NextResponse.json({ error: "SELF_ASSIGNMENT" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
