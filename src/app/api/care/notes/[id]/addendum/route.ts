import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { hasActivePersona } from "@/server/queries/personas";
import { createNoteAddendum } from "@/server/services/care-notes-documents";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

const addendumSchema = z
  .object({
    content: z.string().min(1).max(10000),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const rate = await consumeRateLimit(`care-note-addendum:${session.user.id}`, 30, 60);
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

  const { id: parentNoteId } = await params;
  const body = await readLimitedJson(request).catch(() => null);
  const parsed = addendumSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.issues }, { status: 400 });
  }

  const result = await createNoteAddendum(session.user.id, {
    parentNoteId,
    content: parsed.data.content,
  });

  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (result.kind === "invalid_input") {
    return NextResponse.json({ error: "INVALID_INPUT", message: result.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}
