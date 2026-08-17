import { getFreshSession } from "@/server/auth/session";
import { getToolRegistry } from "@/server/tools/registry";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request";
import { env } from "@/server/env";

interface ConfirmRequest {
  executionId: string;
  toolName: string;
  arguments: unknown;
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

  const locale = (session.user.locale ?? "fr") as "fr" | "ar";

  const body = await readLimitedJson<ConfirmRequest>(request, 4096);
  if (!body?.executionId || !body?.toolName || !body?.arguments) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { executionId, toolName, arguments: args } = body;

  try {
    const toolRegistry = getToolRegistry();
    const result = await toolRegistry.confirmAndExecuteTool(
      toolName,
      { userId: session.user.id, locale, requestId: executionId },
      executionId,
      args
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
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