import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { automationExecution } from "@/server/db/schema";
import { authenticateInternalAutomation, requireAutomationScope, json } from "@/server/automation/internal-auth";
import { AUTOMATION_EXECUTIONS_UPDATE } from "@/server/mcp/scopes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ automationExecutionId: z.string() }).strict();

export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateInternalAutomation(request);
  if (!auth.ok) return auth.response;

  const forbidden = await requireAutomationScope(auth.actor, AUTOMATION_EXECUTIONS_UPDATE, request);
  if (forbidden) return forbidden;

  const raw = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json(400, { error: "Invalid request" });

  const [row] = await db
    .select({
      id: automationExecution.id,
      workflowName: automationExecution.workflowName,
      workflowVersion: automationExecution.workflowVersion,
      status: automationExecution.status,
      referenceId: automationExecution.referenceId,
      organizationId: automationExecution.organizationId,
      requestedByUserId: automationExecution.requestedByUserId,
    })
    .from(automationExecution)
    .where(
      and(
        eq(automationExecution.id, parsed.data.automationExecutionId),
        auth.actor.organizationId ? eq(automationExecution.organizationId, auth.actor.organizationId) : undefined,
      ),
    )
    .limit(1);

  if (!row) return json(404, { error: "Execution not found" });

  return json(200, {
    automationExecutionId: row.id,
    workflowName: row.workflowName,
    workflowVersion: row.workflowVersion,
    status: row.status,
    referenceId: row.referenceId,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
  });
}