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

const actionSchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["acc", "rdv", "done"]),
  rdv: z
    .object({
      d: z.string().min(1),
      h: z.string().min(1),
      mo: z.string().min(1),
    })
    .optional(),
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

  const rate = await consumeRateLimit(`spec-action:${session.user.id}`, 30, 60, { fallbackLimit: 15 });
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }

  const rawBody = await readLimitedJson(request).catch(() => null);
  const parsed = actionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT", issues: parsed.error.flatten() }, { status: 400 });
  }

  const { requestId, action, rdv } = parsed.data;

  const [targetReq] = await db
    .select()
    .from(establishmentServiceRequests)
    .where(eq(establishmentServiceRequests.id, requestId))
    .limit(1);

  if (!targetReq) {
    return NextResponse.json({ ok: false, error: "REQUEST_NOT_FOUND" }, { status: 404 });
  }

  const specialistName = session.user.name || "Spécialiste Référent";

  if (action === "acc") {
    // Transition to stage 2 (En cours)
    await db
      .update(establishmentServiceRequests)
      .set({
        stage: 2,
        assignedSpecialistUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(establishmentServiceRequests.id, requestId));

    await db.insert(serviceRequestMessages).values({
      requestId,
      senderRole: "Spécialiste",
      senderName: specialistName,
      body: "Demande prise en charge. Je prépare l'intervention et reviens vers vous rapidement.",
    });
  } else if (action === "rdv") {
    if (!rdv) {
      return NextResponse.json({ ok: false, error: "MISSING_RDV_DETAILS" }, { status: 400 });
    }
    // Transition to stage 3 (Rendez-vous fixé)
    await db
      .update(establishmentServiceRequests)
      .set({
        stage: 3,
        scheduledRdvJson: rdv,
        assignedSpecialistUserId: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(establishmentServiceRequests.id, requestId));

    await db.insert(serviceRequestMessages).values({
      requestId,
      senderRole: "Spécialiste",
      senderName: specialistName,
      body: `Rendez-vous proposé le ${rdv.d} à ${rdv.h} (${rdv.mo.toLowerCase()}).`,
    });
  } else if (action === "done") {
    // Transition to stage 4 (Traitée)
    await db
      .update(establishmentServiceRequests)
      .set({
        stage: 4,
        updatedAt: new Date(),
      })
      .where(eq(establishmentServiceRequests.id, requestId));

    await db.insert(serviceRequestMessages).values({
      requestId,
      senderRole: "Spécialiste",
      senderName: specialistName,
      body: "Demande clôturée et traitée. Compte-rendu disponible au dossier.",
    });
  }

  return NextResponse.json({ ok: true });
}
