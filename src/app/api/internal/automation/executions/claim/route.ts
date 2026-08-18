import { z } from "zod";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { claimExecution } from "@/server/automation/executions";
import { AUTOMATION_EXECUTIONS_UPDATE } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ automationExecutionId: z.string() }).strict();

/**
 * Atomic execution claim. Exactly ONE n8n execution (per automationExecutionId)
 * transitions PENDING/DISPATCHED -> RUNNING; every duplicate webhook delivery
 * gets a 409 and must exit before producing any business side effect.
 */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_EXECUTIONS_UPDATE, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  const result = await claimExecution({
    automationExecutionId: parsed.data.automationExecutionId,
    organizationId: auth.actor.organizationId,
    credentialId: auth.actor.credentialId,
  });

  if (result.kind === "CLAIMED") {
    return json(200, { automationExecutionId: parsed.data.automationExecutionId, claimed: true, status: result.status });
  }
  if (result.kind === "ALREADY_CLAIMED") {
    return json(200, {
      automationExecutionId: parsed.data.automationExecutionId,
      claimed: false,
      status: result.status,
      duplicate: true,
    });
  }
  return json(404, { error: "Execution not found" });
}
