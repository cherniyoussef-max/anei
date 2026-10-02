import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { getCareMessages } from "@/server/queries/care-messaging";
import { sendCareMessage } from "@/server/services/care-messaging";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";

const sendCareMessageSchema = z
  .object({
    content: z.string().min(1).max(4000),
  })
  .strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rawId = (await params).id;
  const idParsed = z.string().min(1).safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const data = await getCareMessages(session.user.id, idParsed.data);
  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND_OR_FORBIDDEN" }, { status: 404 });
  }

  return NextResponse.json(data);
}

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

  const rate = await consumeRateLimit(`care-msg:${session.user.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const rawId = (await params).id;
  const idParsed = z.string().min(1).safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = sendCareMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await sendCareMessage({
    callerUserId: session.user.id,
    conversationId: idParsed.data,
    content: parsed.data.content,
  });

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (result.kind === "conversation_read_only") {
    return NextResponse.json({ error: "CONVERSATION_READ_ONLY" }, { status: 403 });
  }
  if (result.kind === "invalid_content") {
    return NextResponse.json({ error: "INVALID_CONTENT" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, messageId: result.messageId }, { status: 201 });
}
