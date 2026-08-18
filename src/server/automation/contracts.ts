import "server-only";
import crypto from "node:crypto";
import { db } from "@/server/db";
import { automationExecution } from "@/server/db/schema";
import { enqueueOutboxEvent } from "@/server/queue/outbox";

export interface AutomationWorkflow {
  name: string;
  description: string;
  riskLevel: "read" | "write" | "sensitive";
}

/**
 * Allowlisted automation workflows. n8n may only ever be asked to run one of
 * these stable names — a workflow name coming from the database, from a
 * request body, or from any other untrusted source is rejected outright.
 * Adding a workflow requires updating this list, the corresponding
 * n8n/workflows/*.json export, and the security tests.
 */
export const AUTOMATION_WORKFLOWS: readonly AutomationWorkflow[] = [
  {
    name: "automation.appointment_reminder",
    description: "Reminds a learner/contact of an upcoming appointment.",
    riskLevel: "write",
  },
  {
    name: "automation.onboarding_followup",
    description: "Follows up with newly onboarded learners after enrollment.",
    riskLevel: "write",
  },
  {
    name: "automation.teacher_notification",
    description: "Notifies a teacher when a new student joins their course.",
    riskLevel: "write",
  },
  {
    name: "automation.knowledge_sync",
    description: "Synchronizes approved external content into the ANEI knowledge base.",
    riskLevel: "write",
  },
];

const AUTOMATION_WORKFLOW_MAP = new Map(AUTOMATION_WORKFLOWS.map((w) => [w.name, w]));

export function isAllowlistedWorkflow(name: string): boolean {
  return AUTOMATION_WORKFLOW_MAP.has(name);
}

export interface N8NClient {
  triggerWorkflow(workflowName: string, input: Record<string, unknown>, context: {
    userId: string;
    organizationId?: string | null;
    locale: "fr" | "ar";
    requestId: string;
    externalExecutionId?: string;
  }): Promise<{ success: boolean; externalExecutionId?: string; error?: string }>;
}

/**
 * ANEI -> n8n dispatch client.
 *
 * Authentication direction: ANEI sends the dispatch secret as the
 * `Authorization: Bearer <token>` header, which n8n's Webhook node validates
 * natively (authentication = "headerAuth", bound to an httpHeaderAuth
 * credential). The
 * webhook will not start its business flow when the header is missing or
 * wrong, so a failed dispatch is a hard non-2xx that the outbox worker treats
 * as terminal (misconfiguration) rather than retrying forever.
 *
 * The dispatch secret is DISTINCT from the n8n -> ANEI service credential
 * (which is provisioned through the automation service-credential API and
 * stored as a SHA-256 digest in ANEI's DB).
 */
export class N8NAutomationClient implements N8NClient {
  private baseUrl: string;
  private dispatchToken: string;
  private timeoutMs: number;

  constructor(baseUrl: string, dispatchToken: string, timeoutMs = 8_000) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.dispatchToken = dispatchToken;
    this.timeoutMs = timeoutMs;
  }

  async triggerWorkflow(workflowName: string, input: Record<string, unknown>, context: {
    userId: string;
    organizationId?: string | null;
    locale: "fr" | "ar";
    requestId: string;
    externalExecutionId?: string;
  }): Promise<{ success: boolean; externalExecutionId?: string; error?: string }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/webhook/${workflowName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.dispatchToken}`,
          "X-ANEI-User-ID": context.userId,
          "X-ANEI-Org-ID": context.organizationId ?? "",
          "X-ANEI-Locale": context.locale,
          "X-ANEI-Request-ID": context.requestId,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "UNAUTHORIZED_DISPATCH" };
      }

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const text = await response.text();
      let result: { executionId?: string } = {};
      if (text) {
        try {
          result = JSON.parse(text);
        } catch {
          // Non-JSON body (e.g. empty 200) is acceptable.
        }
      }
      return { success: true, externalExecutionId: result.executionId };
    } catch (error) {
      clearTimeout(timeoutId);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

let n8nClientInstance: N8NClient | null = null;

export function getN8NClient(): N8NClient | null {
  return n8nClientInstance;
}

export function setN8NClient(client: N8NClient): void {
  n8nClientInstance = client;
}

/**
 * Request an automation run. Records an automation_execution row and enqueues
 * an AUTOMATION_TRIGGER outbox event whose payload is only the execution id.
 * The workflow name is validated against the allowlist here (business layer);
 * the worker handler re-validates it from the DB before dispatching to n8n.
 *
 * The execution insert and the outbox enqueue commit atomically in one
 * transaction, so a durable dispatch intent is never lost between the two
 * writes.
 */
export async function triggerAutomation(input: {
  workflowName: string;
  organizationId?: string | null;
  requestedByUserId?: string | null;
  referenceId?: string | null;
  idempotencyKey?: string;
}): Promise<{ executionId: string; created: boolean }> {
  if (!isAllowlistedWorkflow(input.workflowName)) {
    throw new Error(`UNKNOWN_WORKFLOW:${input.workflowName}`);
  }

  const executionId = crypto.randomUUID();
  const idempotencyKey = input.idempotencyKey ?? `automation:${input.workflowName}:${executionId}`;

  const enqueued = await db.transaction(async (tx) => {
    await tx.insert(automationExecution).values({
      id: executionId,
      organizationId: input.organizationId ?? null,
      workflowName: input.workflowName,
      workflowVersion: 1,
      idempotencyKey,
      requestedByUserId: input.requestedByUserId ?? null,
      referenceId: input.referenceId ?? null,
    });

    return enqueueOutboxEvent(tx, {
      organizationId: input.organizationId ?? null,
      aggregateType: "automation_execution",
      aggregateId: executionId,
      eventType: "AUTOMATION_TRIGGER",
      payload: { automationExecutionId: executionId },
      idempotencyKey,
    });
  });

  return { executionId, created: enqueued.created };
}
