import { NextResponse } from "next/server";
import { z } from "zod";
import { adminMutationRateLimit, getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { getPrimaryOrganization } from "@/server/queries/organizations";
import { simulateSocialInboundMessage } from "@/server/services/social-messaging";

const schema = z
  .object({
    organizationId: z.string().uuid().optional(),
    channel: z.enum(["INSTAGRAM", "MESSENGER"]),
    senderId: z.string().trim().min(1).max(128).optional(),
    senderName: z.string().trim().min(1).max(128),
    senderUsername: z.string().trim().min(1).max(64).optional(),
    text: z.string().trim().min(1).max(4000),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["IMAGE", "AUDIO", "FILE", "VIDEO"]).optional(),
    contactId: z.string().uuid().optional(),
  })
  .strict();

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });

  const parsed = schema.safeParse(await readLimitedJson(request).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });

  let organizationId = parsed.data.organizationId;
  if (!organizationId) {
    const primaryOrg = await getPrimaryOrganization();
    if (!primaryOrg) return NextResponse.json({ error: "NO_ORGANIZATION" }, { status: 404 });
    organizationId = primaryOrg.id;
  }

  const message = await simulateSocialInboundMessage({
    organizationId,
    channel: parsed.data.channel,
    senderId: parsed.data.senderId,
    senderName: parsed.data.senderName,
    senderUsername: parsed.data.senderUsername,
    text: parsed.data.text,
    mediaUrl: parsed.data.mediaUrl,
    mediaType: parsed.data.mediaType,
    contactId: parsed.data.contactId,
  });

  return NextResponse.json({ ok: true, message });
}
