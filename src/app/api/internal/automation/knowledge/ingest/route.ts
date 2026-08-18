import { z } from "zod";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { AUTOMATION_KNOWLEDGE_INGEST } from "@/server/mcp/scopes";
import { ingestDocument } from "@/server/ai/ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    sourceType: z.string().min(1).max(80),
    sourceId: z.string().max(200).optional(),
    title: z.string().min(1).max(300),
    content: z.string().min(1).max(240_000),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_KNOWLEDGE_INGEST, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  // Visibility and org scope are forced server-side: content ingested by an
  // automation is always bound to the credential's organization and marked
  // ORGANIZATION (never PUBLIC/PLATFORM), regardless of what the caller sent.
  const result = await ingestDocument({
    organizationId: auth.actor.organizationId ?? null,
    sourceType: parsed.data.sourceType,
    sourceId: parsed.data.sourceId,
    title: parsed.data.title,
    visibility: auth.actor.organizationId ? "ORGANIZATION" : "PRIVATE",
    content: parsed.data.content,
    metadata: parsed.data.metadata,
  });

  return json(200, { documentId: result.documentId, chunksCreated: result.chunksCreated, status: result.status });
}