import { z } from "zod";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { AUTOMATION_NOTIFICATIONS_REQUEST } from "@/server/mcp/scopes";
import { enqueueSystemWhatsAppTemplateWithSecretParameters } from "@/server/services/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    contactId: z.string().uuid(),
    templateId: z.string().uuid(),
    language: z.string().min(2).max(8),
    parameters: z.array(z.string()).max(20),
    requestId: z.string().min(1).max(128),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_NOTIFICATIONS_REQUEST, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  if (!auth.actor.organizationId) return json(403, { error: "Forbidden: credential is not organization-scoped" });

  // Reuses the Phase 9 outbox path: creates the QUEUED whatsapp_message row and
  // its WHATSAPP_TEMPLATE_SEND dispatch intent in one transaction. The worker
  // performs the actual Meta API call. Parameters are stored encrypted.
  const result = await enqueueSystemWhatsAppTemplateWithSecretParameters(auth.actor.organizationId, {
    contactId: parsed.data.contactId,
    templateId: parsed.data.templateId,
    language: parsed.data.language,
    parameters: parsed.data.parameters,
    requestId: parsed.data.requestId,
  });

  if (result.kind === "ok") {
    return json(200, { messageId: result.id });
  }
  return json(400, { error: `Notification request failed: ${result.kind}` });
}
