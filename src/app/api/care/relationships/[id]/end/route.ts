import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { endCareRelationship } from "@/server/services/care-relationships";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { hasAdminPermission } from "@/modules/admin/domain/permissions";

const endSchema = z
  .object({
    endReason: z.string().max(500).optional().nullable(),
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

  const rate = await consumeRateLimit(`care-end:${session.user.id}`, 20, 60);
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
  const parsed = endSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userRole = String(session.user.role ?? "USER");
  const isAdmin =
    (userRole === "ADMIN" || userRole === "SUPER_ADMIN") &&
    (hasAdminPermission(userRole, "care.relationships.manage") ||
      hasAdminPermission(userRole, "relationships.manage"));

  const result = await endCareRelationship(
    session.user.id,
    idParsed.data,
    parsed.data.endReason,
    isAdmin,
  );

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

  return NextResponse.json({ ok: true, id: result.id }, { status: 200 });
}
