import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { trackWebinarJoin, type WebinarMeetingProvider } from "@/server/services/webinars";
import { db } from "@/server/db";
import { webinars } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { isTrustedMutation } from "@/server/security/origin";
import { consumeRateLimit, requestFingerprint } from "@/server/security/rate-limit";
import { safeAppRedirect } from "@/lib/security/safe-redirect";
import { validateWebinarMeetingUrl, validateWebinarReplayUrl } from "@/lib/webinar-validation";

function getClientIp(request: Request): string {
  if (process.env.TRUST_PROXY_HEADERS === "true") {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const realIp = request.headers.get("x-real-ip");
    if (realIp?.trim()) return realIp.trim();
  }
  return requestFingerprint(request);
}

import {
  createWebinarJoinPass,
  consumeWebinarJoinPass,
  buildClearPassCookieHeader,
  getWebinarPassCookieName,
} from "@/server/services/webinar-join-pass";

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveWebinarRedirect(
  webinar: { slug: string; startsAt: Date; durationMinutes: number | null; meetingProvider: string | null },
  target: { meetingUrl: string | null; replayUrl: string | null; provider?: string | null },
  requestUrl: string,
): NextResponse {
  // For in_person sessions: NEVER redirect to external meeting URL
  if (webinar.meetingProvider === "in_person" || target.provider === "in_person") {
    const destination = safeAppRedirect(
      `/fr/webinaires/${webinar.slug}?status=in_person`,
      "fr",
    );
    const res = NextResponse.redirect(new URL(destination, requestUrl), 302);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  // Determine authorized destination: replay if past, live meeting if active
  const now = new Date();
  const endTime = new Date(webinar.startsAt.getTime() + (webinar.durationMinutes || 60) * 60000);
  const isPast = now > endTime;
  const targetUrl =
    isPast && target.replayUrl
      ? target.replayUrl
      : target.meetingUrl || target.replayUrl;

  if (!targetUrl) {
    const destination = safeAppRedirect(
      `/fr/webinaires/${webinar.slug}?status=pending_link`,
      "fr",
    );
    const res = NextResponse.redirect(new URL(destination, requestUrl), 302);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  // AT READ TIME: validate targetUrl against host and protocol allowlist before redirecting
  const isReplayTarget = isPast && targetUrl === target.replayUrl;
  const validation = isReplayTarget
    ? validateWebinarReplayUrl(targetUrl)
    : validateWebinarMeetingUrl(
        (target.provider as WebinarMeetingProvider) || (webinar.meetingProvider as WebinarMeetingProvider) || "custom",
        targetUrl,
      );

  if (!validation.valid) {
    const destination = safeAppRedirect(
      `/fr/webinaires/${webinar.slug}?status=invalid_link`,
      "fr",
    );
    const res = NextResponse.redirect(new URL(destination, requestUrl), 302);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  const res = NextResponse.redirect(targetUrl, 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const code = searchParams.get("code");
  const session = await auth.api.getSession({ headers: request.headers });

  // Rate limit: per IP AND by webinar (webinar-join:${id}:${ip})
  const clientIp = getClientIp(request);
  const rateLimitKey = `webinar-join:${id}:${clientIp}`;
  const failClosedOnOutage = process.env.NODE_ENV === "production";
  const rate = await consumeRateLimit(rateLimitKey, 20, 60, { fallbackLimit: 5, failClosedOnOutage });
  if (!rate.allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(rate.retryAfterSeconds),
        "Referrer-Policy": "no-referrer",
      },
    });
  }

  const [webinar] = await db
    .select({
      id: webinars.id,
      slug: webinars.slug,
      startsAt: webinars.startsAt,
      durationMinutes: webinars.durationMinutes,
      published: webinars.published,
      meetingProvider: webinars.meetingProvider,
      location: webinars.location,
    })
    .from(webinars)
    .where(eq(webinars.id, id))
    .limit(1);

  if (!webinar || !webinar.published) {
    const fallback = safeAppRedirect("/fr/webinaires", "fr");
    const res = NextResponse.redirect(new URL(fallback, request.url), 302);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  const hasCredentialsInQuery = Boolean((code && code.trim()) || (token && token.trim()));

  if (hasCredentialsInQuery) {
    // Exchange query string code/token for short-lived HttpOnly cookie & 303 redirect to clean URL
    const result = await trackWebinarJoin({
      webinarId: id,
      accessCode: code || undefined,
      joinToken: token || undefined,
      userId: session?.user?.id || undefined,
    });

    if (!result.ok) {
      const statusParam = (result.error || "error").toLowerCase();
      const destination = safeAppRedirect(
        `/fr/webinaires/${webinar.slug}?status=${statusParam}`,
        "fr",
      );
      const res = NextResponse.redirect(new URL(destination, request.url), 302);
      res.headers.set("Referrer-Policy", "no-referrer");
      return res;
    }

    const pass = await createWebinarJoinPass(id, {
      meetingUrl: result.meetingUrl,
      replayUrl: result.replayUrl,
      location: result.location,
      provider: result.provider,
      title: result.title,
    });

    const cleanDestination = new URL(`/api/webinars/${id}/join`, request.url);
    const res = NextResponse.redirect(cleanDestination, 303);
    res.headers.set("Set-Cookie", pass.cookieHeader);
    res.headers.set("Referrer-Policy", "no-referrer");
    return res;
  }

  // Request arrived at clean URL without credentials in query string:
  // 1. Check for one-time HttpOnly pass cookie
  const cookieHeader = request.headers.get("cookie");
  const cookieVal = getCookieValue(cookieHeader, getWebinarPassCookieName(id));
  if (cookieVal) {
    const passData = await consumeWebinarJoinPass(id, cookieVal);
    if (passData) {
      const res = resolveWebinarRedirect(webinar, passData, request.url);
      res.headers.set("Set-Cookie", buildClearPassCookieHeader(id));
      return res;
    }
  }

  // 2. If no valid pass cookie, check if authenticated session user is registered
  if (session?.user?.id) {
    const result = await trackWebinarJoin({
      webinarId: id,
      userId: session.user.id,
    });
    if (result.ok) {
      return resolveWebinarRedirect(webinar, result, request.url);
    }
  }

  // Fallback: registration required
  const destination = safeAppRedirect(
    `/fr/webinaires/${webinar.slug}?status=registration_required`,
    "fr",
  );
  const res = NextResponse.redirect(new URL(destination, request.url), 302);
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isTrustedMutation(request)) {
    return NextResponse.json(
      { error: "UNTRUSTED_ORIGIN" },
      { status: 403, headers: { "Referrer-Policy": "no-referrer" } },
    );
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const code = searchParams.get("code");
  const session = await auth.api.getSession({ headers: request.headers });

  // Rate limit: per IP AND by webinar (webinar-join:${id}:${ip}), fail closed on Redis outage
  const clientIp = getClientIp(request);
  const rateLimitKey = `webinar-join:${id}:${clientIp}`;
  const rate = await consumeRateLimit(rateLimitKey, 20, 60, { failClosedOnOutage: true });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }

  const result = await trackWebinarJoin({
    webinarId: id,
    accessCode: code || undefined,
    joinToken: token || undefined,
    userId: session?.user?.id || undefined,
  });

  if (!result.ok) {
    const statusCode =
      result.error === "WEBINAR_NOT_FOUND"
        ? 404
        : result.error === "REGISTRATION_REQUIRED"
        ? session?.user?.id
          ? 403
          : 401
        : 403;

    return NextResponse.json(
      { error: result.error },
      { status: statusCode, headers: { "Referrer-Policy": "no-referrer" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      meetingUrl: result.meetingUrl,
      replayUrl: result.replayUrl,
      location: result.location,
      provider: result.provider,
      title: result.title,
    },
    { headers: { "Referrer-Policy": "no-referrer" } },
  );
}
