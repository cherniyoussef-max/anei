import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/server/db";
import { establishmentServiceRequests, serviceRequestMessages } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { isImpersonationActive } from "@/server/auth/impersonation";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { getOrCreatePartnerEstablishment } from "@/server/services/inclusive-ecosystem";

const createRequestSchema = z.object({
  serviceType: z.enum(["cons", "visit", "form", "acc", "mat", "exam"]),
  urgency: z.enum(["Normale", "Urgente", "Très urgente"]).default("Normale"),
  concernedCount: z.number().int().min(1).max(500).default(1),
  situationDescription: z.string().min(5).max(3000),
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

  const rate = await consumeRateLimit(`est-create-request:${session.user.id}`, 20, 60, { fallbackLimit: 10 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = createRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { establishment } = await getOrCreatePartnerEstablishment(session.user.id);

  // Generate unique reference code like D-2026-0XX
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const referenceCode = `D-2026-${randomSuffix}`;

  const [createdRequest] = await db
    .insert(establishmentServiceRequests)
    .values({
      referenceCode,
      establishmentId: establishment.id,
      serviceType: parsed.data.serviceType,
      urgency: parsed.data.urgency,
      concernedCount: parsed.data.concernedCount,
      situationDescription: parsed.data.situationDescription,
      stage: 0, // 0 = Envoyée / Nouvelle
    })
    .returning();

  // Add initial system message acknowledging receipt
  await db.insert(serviceRequestMessages).values({
    requestId: createdRequest.id,
    senderRole: "Académie",
    senderName: "Portail Académique ANEI",
    body: "Votre demande a été transmise aux spécialistes et conseillers de l'Académie.",
  });

  return NextResponse.json({ ok: true, request: createdRequest }, { status: 201 });
}
