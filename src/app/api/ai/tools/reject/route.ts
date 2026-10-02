import { getFreshSession } from "@/server/auth/session";
import { getToolRegistry } from "@/server/tools/registry";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { env } from "@/server/env";

interface RejectRequest {
  executionId: string;
}

export async function POST(request: Request): Promise<Response> {
  if (!env.ENABLE_AI) {
    return new Response(JSON.stringify({ error: "AI feature is disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isTrustedMutation(request)) {
    return new Response(JSON.stringify({ error: "Untrusted origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const session = await getFreshSession();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rate = await consumeRateLimit(`ai-tools-reject:${session.user.id}`, 20, 60);
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "RATE_LIMITED" }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  const locale = (session.user.locale ?? "fr") as "fr" | "ar";

  const body = await readLimitedJson<RejectRequest>(request, 1024);
  if (!body?.executionId) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const toolRegistry = getToolRegistry();
    await toolRegistry.rejectTool(
      { userId: session.user.id, locale, requestId: body.executionId },
      body.executionId
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
}