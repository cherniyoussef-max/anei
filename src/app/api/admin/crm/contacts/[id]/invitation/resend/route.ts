import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { resolveActorOrgRole } from "@/server/queries/admission";
import { resendAccountInvitation } from "@/server/services/account-invitations";

const idSchema = z.string().uuid();
const bodySchema = z.object({ organizationId: z.string().uuid() }).strict();

/** Rotates the invitation secret (old links stop working) and re-attempts delivery. Cooldown/limit-enforced. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  const parsed = bodySchema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  const actorRole = await resolveActorOrgRole(session.user.id, parsed.data.organizationId);
  const result = await resendAccountInvitation(session.user.id, actorRole, parsed.data.organizationId, id.data);

  if (result.kind === "forbidden") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (result.kind === "not_found") return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ error: "INVALID_TRANSITION" }, { status: 409 });
  if (result.kind === "send_cooldown") return NextResponse.json({ error: "SEND_COOLDOWN" }, { status: 429 });
  if (result.kind === "send_limit") return NextResponse.json({ error: "SEND_LIMIT" }, { status: 429 });
  if (result.kind !== "ok") return NextResponse.json({ error: "RESEND_FAILED" }, { status: 409 });
  return NextResponse.json({ id: result.id, sent: result.sent });
}
