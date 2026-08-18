import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "@/server/db";
import { automationExecution, type OutboxEventRow } from "@/server/db/schema";
import type { HandlerOutcome, OutboxHandler, SanitizedError } from "@/server/queue/handler-types";
import { parseOutboxPayload, type AutomationTriggerPayload } from "@/server/queue/event-types";
import { getN8NClient, isAllowlistedWorkflow } from "@/server/automation/contracts";

export const automationTriggerHandler: OutboxHandler<AutomationTriggerPayload> = {
  eventType: "AUTOMATION_TRIGGER",

  parsePayload(raw) {
    return parseOutboxPayload("AUTOMATION_TRIGGER", raw);
  },

  async handle(event: OutboxEventRow, payload: AutomationTriggerPayload): Promise<HandlerOutcome> {
    const [execution] = await db
      .select({
        id: automationExecution.id,
        organizationId: automationExecution.organizationId,
        workflowName: automationExecution.workflowName,
        status: automationExecution.status,
        requestedByUserId: automationExecution.requestedByUserId,
        referenceId: automationExecution.referenceId,
        attemptCount: automationExecution.attemptCount,
      })
      .from(automationExecution)
      .where(eq(automationExecution.id, payload.automationExecutionId))
      .limit(1);

    if (!execution) {
      return { outcome: "NON_RETRYABLE", error: { code: "UNKNOWN_EXECUTION", message: "Automation execution does not exist" } };
    }

    // A previously progressed execution is a redelivered outbox event — safe to
    // treat as already handled (idempotent).
    if (execution.status !== "PENDING") {
      return { outcome: "SUCCEEDED" };
    }

    if (!isAllowlistedWorkflow(execution.workflowName)) {
      const sanitized: SanitizedError = { code: "WORKFLOW_NOT_ALLOWED", message: `Workflow not allowlisted: ${execution.workflowName}` };
      await db
        .update(automationExecution)
        .set({ status: "WORKFLOW_FAILED", resultCode: sanitized.code, safeError: sanitized.message })
        .where(eq(automationExecution.id, execution.id));
      return { outcome: "NON_RETRYABLE", error: sanitized };
    }

    const client = getN8NClient();
    if (!client) {
      const sanitized: SanitizedError = { code: "NOT_CONFIGURED", message: "n8n automation client is not configured" };
      await db
        .update(automationExecution)
        .set({ status: "FAILED_TO_DISPATCH", resultCode: sanitized.code, safeError: sanitized.message })
        .where(eq(automationExecution.id, execution.id));
      return { outcome: "NON_RETRYABLE", error: sanitized };
    }

    const dispatch = await client.triggerWorkflow(execution.workflowName, { automationExecutionId: execution.id }, {
      userId: execution.requestedByUserId ?? "automation",
      organizationId: execution.organizationId,
      locale: "fr",
      requestId: `outbox:${event.id}`,
      externalExecutionId: execution.referenceId ?? undefined,
    });

    if (dispatch.success) {
      await db
        .update(automationExecution)
        .set({
          status: "DISPATCHED",
          dispatchedAt: new Date(),
          externalExecutionId: dispatch.externalExecutionId ?? null,
          attemptCount: execution.attemptCount + 1,
          resultCode: "DISPATCHED",
        })
        .where(and(eq(automationExecution.id, execution.id), eq(automationExecution.status, "PENDING")));
      return { outcome: "SUCCEEDED" };
    }

    if (dispatch.error === "UNAUTHORIZED_DISPATCH") {
      const sanitized: SanitizedError = {
        code: "DISPATCH_UNAUTHORIZED",
        message: "n8n dispatch rejected the ANEI webhook credential",
      };
      await db
        .update(automationExecution)
        .set({ status: "FAILED_TO_DISPATCH", attemptCount: execution.attemptCount + 1, resultCode: sanitized.code, safeError: sanitized.message })
        .where(and(eq(automationExecution.id, execution.id), eq(automationExecution.status, "PENDING")));
      return { outcome: "NON_RETRYABLE", error: sanitized };
    }

    if (dispatch.error?.startsWith("HTTP 4")) {
      const sanitized: SanitizedError = {
        code: "DISPATCH_BAD_REQUEST",
        message: (dispatch.error ?? "n8n dispatch rejected the request").slice(0, 300),
      };
      await db
        .update(automationExecution)
        .set({ status: "FAILED_TO_DISPATCH", attemptCount: execution.attemptCount + 1, resultCode: sanitized.code, safeError: sanitized.message })
        .where(and(eq(automationExecution.id, execution.id), eq(automationExecution.status, "PENDING")));
      return { outcome: "NON_RETRYABLE", error: sanitized };
    }

    // Transient dispatch failure (network/timeout/provider 5xx): keep PENDING
    // so the outbox retry (with backoff) re-dispatches. Records the attempt.
    const sanitized: SanitizedError = { code: "DISPATCH_FAILED", message: (dispatch.error ?? "n8n dispatch failed").slice(0, 300) };
    await db
      .update(automationExecution)
      .set({ attemptCount: execution.attemptCount + 1, resultCode: sanitized.code, safeError: sanitized.message })
      .where(and(eq(automationExecution.id, execution.id), eq(automationExecution.status, "PENDING")));
    return { outcome: "RETRYABLE", error: sanitized };
  },

  async onTerminalFailure(event: OutboxEventRow, payload: AutomationTriggerPayload, error: SanitizedError): Promise<void> {
    await db
      .update(automationExecution)
      .set({ status: "FAILED_TO_DISPATCH", resultCode: error.code, safeError: error.message })
      .where(and(eq(automationExecution.id, payload.automationExecutionId), eq(automationExecution.status, "PENDING")));
  },
};
