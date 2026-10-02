import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getUserCareNotifications } from "@/server/services/care-notifications";
import { consumeRateLimit } from "@/server/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rate = await consumeRateLimit(`care-notifs-get:${session.user.id}`, 60, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get("limit")) || 30;
  const result = await getUserCareNotifications(session.user.id, limitParam);

  return NextResponse.json(result);
}
