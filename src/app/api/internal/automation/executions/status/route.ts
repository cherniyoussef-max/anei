import { z } from "zod";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { finalizeExecution } from "@/server/automation/executions";
import { AUTOMATION_EXECUTIONS_UPDATE } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    automationExecutionId: z.string(),
    status: z.enum(["SUCCEEDED", "FAILED", "WORKFLOW_FAILED"]),
    externalExecutionId: z.string().max(200).optional(),
    resultCode: z.string().max(80).optional(),
    error: z.string().max(300).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_EXECUTIONS_UPDATE, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  const finalized = await finalizeExecution({
    automationExecutionId: parsed.data.automationExecutionId,
    organizationId: auth.actor.organizationId,
    status: parsed.data.status,
    externalExecutionId: parsed.data.externalExecutionId,
    resultCode: parsed.data.resultCode,
    safeError: parsed.data.error,
  });

  if (finalized.kind === "NOT_FOUND") {
    return json(404, { error: "Execution not found" });
  }
  if (finalized.kind === "CONFLICT") {
    return json(409, { error: `Execution already in state ${finalized.status}` });
  }

  return json(200, {
    id: parsed.data.automationExecutionId,
    status: finalized.status,
    idempotent: finalized.kind === "IDEMPOTENT",
  });
}
