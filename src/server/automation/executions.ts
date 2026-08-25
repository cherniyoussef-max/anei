import "server-only";
import { and, asc, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/server/db";
import { automationExecution } from "@/server/db/schema";

export type ExecutionFinalStatus = "SUCCEEDED" | "FAILED" | "WORKFLOW_FAILED";

export type AutomationReconciliation = {
  automationExecutionId: string;
  previousStatus: "DISPATCHED" | "RUNNING";
  classification: "RETRYABLE" | "NEEDS_OPERATOR_ATTENTION";
  reasonCode: "DISPATCH_CLAIM_TIMEOUT" | "RUNNING_TIMEOUT_UNCERTAIN_OUTCOME";
};

/**
 * Reconciles stale n8n executions from ANEI's authoritative state.
 *
 * A DISPATCHED execution never reached the mandatory claim endpoint, so it is
 * retryable by an operator after checking n8n availability. A RUNNING timeout
 * has an uncertain external-side-effect outcome and therefore must never be
 * retried automatically. Both are moved monotonically to WORKFLOW_FAILED and
 * carry a safe reason code for metrics/operations. Conditional updates make
 * concurrent watchdog processes harmless.
 */
export async function reconcileStaleAutomationExecutions(input: {
  now?: Date;
  dispatchedBefore: Date;
  runningBefore: Date;
  limit?: number;
}): Promise<AutomationReconciliation[]> {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);
  const reconciled: AutomationReconciliation[] = [];

  const staleDispatched = await db
    .select({ id: automationExecution.id })
    .from(automationExecution)
    .where(and(eq(automationExecution.status, "DISPATCHED"), lt(automationExecution.dispatchedAt, input.dispatchedBefore)))
    .orderBy(asc(automationExecution.dispatchedAt))
    .limit(limit);

  for (const candidate of staleDispatched) {
    const [updated] = await db
      .update(automationExecution)
      .set({
        status: "WORKFLOW_FAILED",
        completedAt: now,
        updatedAt: now,
        resultCode: "DISPATCH_CLAIM_TIMEOUT",
        safeError: "Workflow was dispatched but not claimed within its SLA.",
      })
      .where(and(eq(automationExecution.id, candidate.id), eq(automationExecution.status, "DISPATCHED"), lt(automationExecution.dispatchedAt, input.dispatchedBefore)))
      .returning({ id: automationExecution.id });
    if (updated) {
      reconciled.push({
        automationExecutionId: updated.id,
        previousStatus: "DISPATCHED",
        classification: "RETRYABLE",
        reasonCode: "DISPATCH_CLAIM_TIMEOUT",
      });
    }
  }

  const remaining = limit - reconciled.length;
  if (remaining <= 0) return reconciled;

  const staleRunning = await db
    .select({ id: automationExecution.id })
    .from(automationExecution)
    .where(and(eq(automationExecution.status, "RUNNING"), lt(automationExecution.startedAt, input.runningBefore)))
    .orderBy(asc(automationExecution.startedAt))
    .limit(remaining);

  for (const candidate of staleRunning) {
    const [updated] = await db
      .update(automationExecution)
      .set({
        status: "WORKFLOW_FAILED",
        completedAt: now,
        updatedAt: now,
        resultCode: "RUNNING_TIMEOUT_UNCERTAIN_OUTCOME",
        safeError: "Workflow exceeded its running SLA; external outcome requires operator review.",
      })
      .where(and(eq(automationExecution.id, candidate.id), eq(automationExecution.status, "RUNNING"), lt(automationExecution.startedAt, input.runningBefore)))
      .returning({ id: automationExecution.id });
    if (updated) {
      reconciled.push({
        automationExecutionId: updated.id,
        previousStatus: "RUNNING",
        classification: "NEEDS_OPERATOR_ATTENTION",
        reasonCode: "RUNNING_TIMEOUT_UNCERTAIN_OUTCOME",
      });
    }
  }

  return reconciled;
}

/**
 * automation_execution is the ANEI source of truth for automation status:
 *
 *   PENDING -> DISPATCHED -> RUNNING -> SUCCEEDED | FAILED | WORKFLOW_FAILED
 *   PENDING -> FAILED_TO_DISPATCH   (outbox could never deliver the dispatch)
 *
 * PENDING:   created; outbox event not yet dispatched.
 * DISPATCHED: the outbox worker POSTed the webhook (at-least-once; n8n may
 *             receive it more than once). The workflow has NOT started yet.
 * RUNNING:   exactly ONE n8n execution won the atomic claim below. Only the
 *            winner is authorized to perform ANEI-controlled side effects.
 * SUCCEEDED/FAILED/WORKFLOW_FAILED: terminal, monotonic, never overwritten.
 *
 * The outbox is at-least-once; the claim is what turns duplicate webhook
 * deliveries into one authorized execution (same principle as the AI
 * confirmation race fix). External third-party side effects are NOT globally
 * exactly-once unless the provider itself is idempotent.
 */

/**
 * Atomically claims an execution for exactly one n8n run. The conditional
 * UPDATE is a single statement — no SELECT-then-UPDATE race. A duplicate
 * webhook delivery (same automationExecutionId) finds the execution already
 * RUNNING/terminal and is told so, so the workflow can exit before any
 * business side effect.
 *
 * organizationId must be the service credential's org (null = credential not
 * org-scoped, meaning it may claim cross-org executions).
 */
export async function claimExecution(input: {
  automationExecutionId: string;
  organizationId: string | null;
  credentialId: string;
}): Promise<{ kind: "CLAIMED"; status: "RUNNING" } | { kind: "ALREADY_CLAIMED"; status: string } | { kind: "NOT_FOUND" }> {
  const orgFilter = input.organizationId ? eq(automationExecution.organizationId, input.organizationId) : undefined;

  const [claimed] = await db
    .update(automationExecution)
    .set({
      status: "RUNNING",
      startedAt: new Date(),
      claimedBy: input.credentialId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(automationExecution.id, input.automationExecutionId),
        orgFilter,
        inArray(automationExecution.status, ["PENDING", "DISPATCHED"]),
      ),
    )
    .returning({ id: automationExecution.id, status: automationExecution.status });

  if (claimed) return { kind: "CLAIMED", status: "RUNNING" };

  const [existing] = await db
    .select({
      id: automationExecution.id,
      status: automationExecution.status,
      organizationId: automationExecution.organizationId,
    })
    .from(automationExecution)
    .where(eq(automationExecution.id, input.automationExecutionId))
    .limit(1);

  if (!existing) return { kind: "NOT_FOUND" };
  if (input.organizationId && existing.organizationId !== input.organizationId) return { kind: "NOT_FOUND" };

  return { kind: "ALREADY_CLAIMED", status: existing.status };
}

/**
 * Finalizes a RUNNING execution. Monotonic: only the RUNNING -> terminal
 * transition is allowed. A repeated callback for the same terminal state is
 * idempotent (returns the current state as success); any other transition on a
 * non-terminal (or differently-terminal) execution is rejected.
 */
export async function finalizeExecution(input: {
  automationExecutionId: string;
  organizationId: string | null;
  status: ExecutionFinalStatus;
  externalExecutionId?: string | null;
  resultCode?: string | null;
  safeError?: string | null;
}): Promise<
  | { kind: "FINALIZED"; status: ExecutionFinalStatus }
  | { kind: "IDEMPOTENT"; status: ExecutionFinalStatus }
  | { kind: "CONFLICT"; status: string }
  | { kind: "NOT_FOUND" }
> {
  const orgFilter = input.organizationId ? eq(automationExecution.organizationId, input.organizationId) : undefined;

  const [updated] = await db
    .update(automationExecution)
    .set({
      status: input.status,
      completedAt: new Date(),
      updatedAt: new Date(),
      externalExecutionId: input.externalExecutionId ?? null,
      resultCode: input.resultCode ?? input.status,
      safeError: input.safeError ?? null,
    })
    .where(
      and(
        eq(automationExecution.id, input.automationExecutionId),
        orgFilter,
        eq(automationExecution.status, "RUNNING"),
      ),
    )
    .returning({ id: automationExecution.id, status: automationExecution.status });

  if (updated) return { kind: "FINALIZED", status: input.status };

  const [existing] = await db
    .select({
      id: automationExecution.id,
      status: automationExecution.status,
      organizationId: automationExecution.organizationId,
    })
    .from(automationExecution)
    .where(eq(automationExecution.id, input.automationExecutionId))
    .limit(1);

  if (!existing) return { kind: "NOT_FOUND" };
  if (input.organizationId && existing.organizationId !== input.organizationId) return { kind: "NOT_FOUND" };

  if (existing.status === input.status) return { kind: "IDEMPOTENT", status: input.status };
  return { kind: "CONFLICT", status: existing.status };
}
