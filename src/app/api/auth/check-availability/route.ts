import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/server/db";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { checkIdentityAvailability } from "@/server/auth/identity-normalizer";

export const dynamic = "force-dynamic";

const checkAvailabilitySchema = z.object({
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
});

export async function POST(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const rate = await consumeRateLimit(`check-availability:${clientIp}`, 15, 300);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Trop de vérifications rapprochées. Veuillez patienter quelques instants.",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const raw = await readLimitedJson(request).catch(() => null);
  const parsed = checkAvailabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, phone } = parsed.data;
  const result = await checkIdentityAvailability(db, {
    email: email || undefined,
    phone: phone || undefined,
  });

  return NextResponse.json(result);
}
