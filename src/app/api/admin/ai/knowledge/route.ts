import { getAdminSessionFor } from "@/server/auth/admin";
import { isTrustedMutation } from "@/server/security/origin";
import { readLimitedJson } from "@/server/security/request";
import { ingestDocument } from "@/server/ai/ingestion";
import { env } from "@/server/env";

interface IngestRequest {
  sourceType: string;
  sourceId?: string;
  title: string;
  visibility: "PUBLIC" | "PLATFORM" | "ORGANIZATION" | "PRIVATE";
  content: string;
  metadata?: Record<string, unknown>;
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

  const adminSession = await getAdminSessionFor("ai.knowledge.manage");
  if (!adminSession) {
    return new Response(JSON.stringify({ error: "Admin authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await readLimitedJson<IngestRequest>(request, 100_000);
  if (!body?.title || !body?.content || !body?.sourceType || !body?.visibility) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (body.content.length > 500_000) {
    return new Response(JSON.stringify({ error: "Content too large (max 500KB)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const result = await ingestDocument({
      organizationId: null,
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      title: body.title,
      visibility: body.visibility,
      content: body.content,
      metadata: body.metadata,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}