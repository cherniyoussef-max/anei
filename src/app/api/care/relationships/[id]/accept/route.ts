import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { hasActivePersona } from "@/server/queries/personas";
import { acceptCareRelationship } from "@/server/services/care-relationships";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";

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

  const rate = await consumeRateLimit(`care-accept:${session.user.id}`, 20, 60);
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

  const rawId = (await params).id;
  const idParsed = z.string().min(1).safeParse(rawId);
  if (!idParsed.success) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  }

  const result = await acceptCareRelationship(session.user.id, idParsed.data);

  if (result.kind === "not_found") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (result.kind === "forbidden") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  if (result.kind === "invalid_status") {
    return NextResponse.json(
      { error: "INVALID_STATUS", currentStatus: result.currentStatus },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { ok: true, id: result.id, conversationId: result.conversationId },
    { status: 200 },
  );
}
