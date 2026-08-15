import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { sendInvitation } from "@/server/services/invitations";

const schema = z
  .object({ organizationId: z.string().uuid() })
  .strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const actorRole = await resolveActorOrgRole(session.user.id, parsed.data.organizationId);
  const result = await sendInvitation(session.user.id, actorRole, parsed.data.organizationId, id);
  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  if (result.kind === "cooldown") return NextResponse.json({ error: "COOLDOWN" }, { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } });
  if (result.kind === "limit_reached") return NextResponse.json({ error: "LIMIT_REACHED" }, { status: 429 });
  if (result.kind === "already_linked") return NextResponse.json({ error: "ALREADY_LINKED" }, { status: 409 });
  if (result.kind === "no_account") return NextResponse.json({ error: "NO_ACCOUNT" }, { status: 422 });
  if (result.kind === "invalid_template") return NextResponse.json({ error: "INVALID_TEMPLATE" }, { status: 422 });
  if (result.kind === "not_configured") return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (result.kind === "provider_error") {
    return NextResponse.json(
      { error: "PROVIDER_ERROR", providerErrorCode: result.providerErrorCode, providerErrorMessage: result.providerErrorMessage },
      { status: 502 },
    );
  }
  if (result.kind !== "ok") return NextResponse.json({ error: "SEND_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id });
}