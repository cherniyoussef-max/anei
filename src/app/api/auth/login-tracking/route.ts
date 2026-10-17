import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { user, userOnboardingAnalytics, userProfile } from "@/server/db/schema";
import { auth } from "@/server/auth";
import { getSessionAssurance } from "@/server/auth/assurance";
import { getUserPersonas } from "@/server/queries/personas";
import { resolveUserHomePath } from "@/lib/security/safe-redirect";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request-body";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const rate = await consumeRateLimit(`login-tracking:${session.user.id}:${clientIp}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const raw = await readLimitedJson(request).catch(() => ({}));
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const locale = (body.locale === "ar" ? "ar" : "fr") as "fr" | "ar";
  const explicitNext = typeof body.next === "string" ? body.next : null;
  const now = new Date();
  const userAgent = request.headers.get("user-agent")?.slice(0, 255) || null;

  // 1. Update or create user onboarding analytics record
  const [existingAnalytics] = await db
    .select({ id: userOnboardingAnalytics.id, loginCount: userOnboardingAnalytics.loginCount })
    .from(userOnboardingAnalytics)
    .where(eq(userOnboardingAnalytics.userId, session.user.id))
    .limit(1);

  if (existingAnalytics) {
    await db
      .update(userOnboardingAnalytics)
      .set({
        lastLoginAt: now,
        lastLoginDevice: userAgent,
        lastLoginLocale: locale,
        loginCount: sql`${userOnboardingAnalytics.loginCount} + 1`,
        updatedAt: now,
      })
      .where(eq(userOnboardingAnalytics.id, existingAnalytics.id));
  } else {
    // If user registered before this sprint, retrieve userProfile to create initial analytics row
    const [profile] = await db
      .select()
      .from(userProfile)
      .where(eq(userProfile.userId, session.user.id))
      .limit(1);

    const [u] = await db
      .select({ profileType: user.profileType })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    const category = u?.profileType === "avs"
      ? "AVS"
      : u?.profileType === "specialist"
      ? "SPECIALIST"
      : "LEARNER";

    await db
      .insert(userOnboardingAnalytics)
      .values({
        userId: session.user.id,
        category,
        governorate: profile?.governorate || "Tunis",
        city: profile?.city || "Tunis",
        acquisitionSource: "ORGANIC",
        lastLoginAt: now,
        lastLoginDevice: userAgent,
        lastLoginLocale: locale,
        loginCount: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing();
  }

  // 2. Privilege & Assurance check
  const role = String(session.user.role || "");
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  if (isAdmin) {
    const assurance = await getSessionAssurance(session.session.id);
    if (!assurance) {
      return NextResponse.json({
        ok: true,
        requiresAssurance: true,
        destination: `/${locale}/verification-channel${explicitNext ? `?next=${encodeURIComponent(explicitNext)}` : ""}`,
      });
    }
    return NextResponse.json({
      ok: true,
      requiresAssurance: false,
      redirectUrl: explicitNext || `/${locale}/admin`,
    });
  }

  // 3. Resolve destination for regular practitioners and learners
  const memberships = await getUserPersonas(session.user.id);
  const primary = memberships.find((m) => m.isPrimary);
  const persona = primary?.persona;

  let redirectUrl: string;
  if (persona === "AVS" || persona === "SPECIALIST") {
    redirectUrl = explicitNext || `/${locale}/dashboard/praticien`;
  } else {
    redirectUrl = resolveUserHomePath(locale, {
      role: "USER",
      primaryPersona: persona || null,
      profileType: session.user.profileType as string,
    }, explicitNext);
  }

  return NextResponse.json({
    ok: true,
    requiresAssurance: false,
    redirectUrl,
  });
}
