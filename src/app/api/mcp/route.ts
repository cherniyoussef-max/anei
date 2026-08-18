import { resolveMcpActor } from "@/server/mcp/auth";
import { getMcpHandler } from "@/server/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // Read the flags at request time so tests can toggle them per process without
  // depending on module-evaluation order. Production startup still enforces
  // these flags via env.ts.
  if (process.env.ENABLE_AI !== "true" || process.env.ENABLE_MCP !== "true") {
    return new Response(JSON.stringify({ error: "MCP is disabled" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const auth = await resolveMcpActor(request);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handler = await getMcpHandler();
  return handler(request, { actor: auth.actor, actorType: auth.actor.actorType });
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST" },
  });
}

export async function DELETE(): Promise<Response> {
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST" },
  });
}
