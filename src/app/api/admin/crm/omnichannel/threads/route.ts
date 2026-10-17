import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionFor, adminMutationRateLimit } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import {
  listOmnichannelThreads,
  ingestOmnichannelMessage,
  type OmnichannelChannel,
  type OmnichannelPipelineStage,
} from "@/server/services/omnichannel-crm";

export async function GET(request: Request) {
  const session = await getAdminSessionFor("crm.read");
  if (!session) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const channel = (url.searchParams.get("channel") || "ALL") as OmnichannelChannel | "ALL";
  const filter = (url.searchParams.get("filter") || "all") as "all" | "unread" | "meta_ads" | "registered_users";
  const pipelineStage = url.searchParams.get("pipelineStage") as OmnichannelPipelineStage | undefined;
  const q = url.searchParams.get("q") || undefined;
  const page = Number(url.searchParams.get("page") || "1");

  const data = await listOmnichannelThreads({
    channel,
    filter,
    pipelineStage,
    q,
    page,
  });

  return NextResponse.json(data);
}

const simulateSchema = z.object({
  channel: z.enum(["WHATSAPP", "INSTAGRAM", "MESSENGER"]),
  externalContactId: z.string().trim().min(3).max(100),
  contactName: z.string().trim().max(100).optional(),
  content: z.string().trim().min(1).max(2000),
  referral: z.object({
    source_type: z.string().optional(),
    source_id: z.string().optional(),
    headline: z.string().optional(),
    body: z.string().optional(),
    ctwa_clid: z.string().optional(),
  }).optional(),
}).strict();

export async function POST(request: Request) {
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

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = simulateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const res = await ingestOmnichannelMessage({
    channel: parsed.data.channel,
    externalContactId: parsed.data.externalContactId,
    contactName: parsed.data.contactName,
    direction: "INBOUND",
    content: parsed.data.content,
    referral: parsed.data.referral,
  });

  return NextResponse.json(res, { status: 201 });
}
