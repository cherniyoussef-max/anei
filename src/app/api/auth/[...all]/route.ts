import { NextResponse } from "next/server";
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { auditLogs } from "@/server/db/schema";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { normalizeCanonicalEmail } from "@/lib/auth/canonical-identity";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export const POST = async (request: Request) => {
  const url = new URL(request.url);

  // Hardening specifically for /api/auth/sign-in/email
  if (url.pathname.endsWith("/sign-in/email")) {
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    let rawBody: Record<string, unknown> | null = null;
    try {
      rawBody = await request.clone().json();
    } catch {
      rawBody = null;
    }

    if (rawBody && typeof rawBody.email === "string") {
      const canonicalEmail = normalizeCanonicalEmail(rawBody.email);
      const rateKey = `login-bf:${clientIp}:${canonicalEmail}`;

      // Check current brute force status (limit 5 failed attempts per 15 min / 900s)
      const checkRate = await consumeRateLimit(rateKey, 5, 900);
      if (!checkRate.allowed) {
        // Log in audit_logs as requested
        try {
          await db.insert(auditLogs).values({
            actorUserId: null,
            action: "auth.login.rate_limited",
            entityType: "auth",
            entityId: canonicalEmail,
            metadata: {
              ip: clientIp,
              email: canonicalEmail,
              attempts: 5,
              retryAfterSeconds: checkRate.retryAfterSeconds,
            },
          });
        } catch {
          // Non-blocking fallback
        }

        return NextResponse.json(
          {
            error: "TOO_MANY_ATTEMPTS",
            message: "Trop de tentatives de connexion échouées. Veuillez réessayer dans 15 minutes.",
          },
          {
            status: 429,
            headers: { "Retry-After": String(checkRate.retryAfterSeconds) },
          },
        );
      }

      // Re-package request with canonical email so Better Auth matches database row
      const normalizedBody = {
        ...rawBody,
        email: canonicalEmail,
      };

      const clonedHeaders = new Headers(request.headers);
      clonedHeaders.set("content-type", "application/json");

      const normalizedRequest = new Request(request.url, {
        method: request.method,
        headers: clonedHeaders,
        body: JSON.stringify(normalizedBody),
      });

      return handler.POST(normalizedRequest);
    }
  }

  return handler.POST(request);
};
