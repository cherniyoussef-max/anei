import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import {
  getCareNotificationPreferences,
  updateCareNotificationPreferences,
} from "@/server/services/care-notifications";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { readLimitedJson } from "@/server/security/request-body";

export const dynamic = "force-dynamic";

const updatePreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    notifyOnMessages: z.boolean().optional(),
    notifyOnNotes: z.boolean().optional(),
    notifyOnDocuments: z.boolean().optional(),
    notifyOnRequests: z.boolean().optional(),
  })
  .strict();

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const prefs = await getCareNotificationPreferences(session.user.id);
  return NextResponse.json(prefs);
}

export async function PUT(request: Request) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json({ error: "UNTRUSTED_ORIGIN" }, { status: 403 });
  }

  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`care-prefs-update:${session.user.id}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const body = await readLimitedJson(request).catch(() => null);
  const parsed = updatePreferencesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const updated = await updateCareNotificationPreferences(session.user.id, parsed.data);
  return NextResponse.json(updated);
}
