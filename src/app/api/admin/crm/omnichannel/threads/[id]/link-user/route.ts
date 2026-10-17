import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  linkOmnichannelThreadToUser,
  getOmnichannelThreadDetail,
} from "@/server/services/omnichannel-crm";

const linkSchema = z.object({
  userId: z.string().uuid(),
}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }
  const session = await getAdminSessionFor("crm.manage");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const rate = await adminMutationRateLimit(session.user.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const { id } = await params;
  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const linked = await linkOmnichannelThreadToUser(id, parsed.data.userId);
  if (!linked) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  const detail = await getOmnichannelThreadDetail(id);
  return NextResponse.json(detail);
}
