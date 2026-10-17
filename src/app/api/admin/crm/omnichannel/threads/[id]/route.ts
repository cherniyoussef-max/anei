import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  getOmnichannelThreadDetail,
  updateOmnichannelPipelineStage,
  updateOmnichannelThreadNotes,
  type OmnichannelPipelineStage,
} from "@/server/services/omnichannel-crm";

const patchSchema = z.object({
  pipelineStage: z.enum([
    "NEW_AD_LEAD",
    "QUALIFIED",
    "INTERESTED_IN_COURSE",
    "BOOKING_AVS_SPECIALIST",
    "CONVERTED_PAID",
    "ARCHIVED",
  ]).optional(),
  internalNotes: z.string().max(5000).optional(),
}).strict().refine((val) => val.pipelineStage !== undefined || val.internalNotes !== undefined, {
  message: "At least one field must be provided",
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  const detail = await getOmnichannelThreadDetail(id);
  if (!detail) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PATCH(
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
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.pipelineStage) {
    await updateOmnichannelPipelineStage(id, parsed.data.pipelineStage as OmnichannelPipelineStage, session.user.id);
  }
  if (parsed.data.internalNotes !== undefined) {
    await updateOmnichannelThreadNotes(id, parsed.data.internalNotes);
  }

  const updatedDetail = await getOmnichannelThreadDetail(id);
  return NextResponse.json(updatedDetail);
}
