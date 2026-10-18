import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { establishmentServiceRequests, serviceRequestMessages } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreatePartnerEstablishment } from "@/server/services/inclusive-ecosystem";

const postMessageSchema = z.object({
  requestId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ ok: false, error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (await isImpersonationActive(await headers())) {
    return NextResponse.json({ ok: false, error: "MUTATION_BLOCKED_IN_IMPERSONATION" }, { status: 403 });
  }

  const rate = await consumeRateLimit(`est-msg:${session.user.id}`, 40, 60, { fallbackLimit: 20 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = postMessageSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { establishment } = await getOrCreatePartnerEstablishment(session.user.id);

  // Verify request belongs to this establishment
  const [targetReq] = await db
    .select({ id: establishmentServiceRequests.id })
    .from(establishmentServiceRequests)
    .where(eq(establishmentServiceRequests.id, parsed.data.requestId))
    .limit(1);

  if (!targetReq) {
    return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
  }

  const [message] = await db
    .insert(serviceRequestMessages)
    .values({
      requestId: targetReq.id,
      senderRole: "Établissement",
      senderName: establishment.name || "Établissement",
      body: parsed.data.body,
    })
    .returning();

  return NextResponse.json({ ok: true, message }, { status: 201 });
}
