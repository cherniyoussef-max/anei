import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { partnerEstablishments } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreatePartnerEstablishment } from "@/server/services/inclusive-ecosystem";

export async function GET(_request: Request) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const data = await getOrCreatePartnerEstablishment(session.user.id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[EstablishmentProfile GET error]:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

const updateEstablishmentSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  level: z.string().max(50).optional(),
  region: z.string().max(100).optional(),
  studentCount: z.number().int().min(0).max(10000).optional(),
  needsBreakdownJson: z.record(z.string(), z.number()).optional(),
  existingResourcesJson: z.array(z.string()).optional(),
  constraintsJson: z.array(z.string()).optional(),
  partnershipStage: z.number().int().min(0).max(4).optional(),
  conventionSignedAt: z.string().datetime().optional().nullable(),
  selfEvalAnswersJson: z.record(z.string(), z.number()).optional(),
  selfEvalScorePercent: z.number().int().min(0).max(100).optional().nullable(),
});

export async function PATCH(request: Request) {
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

  const rate = await consumeRateLimit(`est-profile-update:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = updateEstablishmentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { establishment } = await getOrCreatePartnerEstablishment(session.user.id);

  const [updated] = await db
    .update(partnerEstablishments)
    .set({
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.level ? { level: parsed.data.level } : {}),
      ...(parsed.data.region ? { region: parsed.data.region } : {}),
      ...(parsed.data.studentCount !== undefined ? { studentCount: parsed.data.studentCount } : {}),
      ...(parsed.data.needsBreakdownJson ? { needsBreakdownJson: parsed.data.needsBreakdownJson } : {}),
      ...(parsed.data.existingResourcesJson ? { existingResourcesJson: parsed.data.existingResourcesJson } : {}),
      ...(parsed.data.constraintsJson ? { constraintsJson: parsed.data.constraintsJson } : {}),
      ...(parsed.data.partnershipStage !== undefined ? { partnershipStage: parsed.data.partnershipStage } : {}),
      ...(parsed.data.conventionSignedAt !== undefined ? { conventionSignedAt: parsed.data.conventionSignedAt ? new Date(parsed.data.conventionSignedAt) : null } : {}),
      ...(parsed.data.selfEvalAnswersJson ? { selfEvalAnswersJson: parsed.data.selfEvalAnswersJson } : {}),
      ...(parsed.data.selfEvalScorePercent !== undefined ? { selfEvalScorePercent: parsed.data.selfEvalScorePercent } : {}),
      updatedAt: new Date(),
    })
    .where(eq(partnerEstablishments.id, establishment.id))
    .returning();

  return NextResponse.json({ ok: true, establishment: updated });
}
