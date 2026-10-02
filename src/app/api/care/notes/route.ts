import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { hasActivePersona } from "@/server/queries/personas";
import { createSessionNote } from "@/server/services/care-notes-documents";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const noteSchema = z
  .object({
    assignmentId: z.string().min(1),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(10000),
    visibility: z.enum(["PRIVATE", "SHARED"]),
    sessionDate: z.string().datetime(),
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

  const rate = await consumeRateLimit(`care-note-create:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const isSpecialist = await hasActivePersona(session.user.id, "SPECIALIST");
  if (!isSpecialist) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const result = await createSessionNote(session.user.id, {
    assignmentId: parsed.data.assignmentId,
    title: parsed.data.title,
    content: parsed.data.content,
    visibility: parsed.data.visibility,
    sessionDate: new Date(parsed.data.sessionDate),
  });

  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (result.kind === "invalid_input") {
    return NextResponse.json({ error: "INVALID_INPUT", message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
