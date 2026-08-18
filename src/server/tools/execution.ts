import { db } from "@/server/db";
import { aiToolExecution } from "@/server/db/schema";
import { and, eq, sql } from "drizzle-orm";
import crypto from "node:crypto";
import type { ToolContext, AnyToolDefinition } from "./types";

const CONFIRMATION_TTL_MS = 10 * 60 * 1000;

function hashInput(input: unknown): string {
  const normalized = JSON.stringify(input, Object.keys(input as object).sort());
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function createSafePreview(input: unknown, allowedKeys: string[]): Record<string, unknown> {
  if (!input || typeof input !== "object") return {};
  const preview: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in (input as object)) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "string" && value.length > 200) {
        preview[key] = value.slice(0, 200) + "...";
      } else {
        preview[key] = value;
      }
    }
  }
  return preview;
}

export async function authorizeAndPropose(
  tool: AnyToolDefinition,
  context: ToolContext,
  input: unknown,
  conversationId: string,
  allowedPreviewKeys: string[] = []
): Promise<{ executionId: string; requiresConfirmation: boolean; preview: Record<string, unknown> }> {
  const parsedInput = tool.inputSchema.parse(input);
  const authResult = await tool.authorize(context, parsedInput);
  if (!authResult.allowed) {
    throw new Error(`Authorization failed: ${authResult.reason ?? "Insufficient permissions"}`);
  }

  const inputHash = hashInput(parsedInput);
  const safePreview = createSafePreview(parsedInput, allowedPreviewKeys);

  const requiresConfirmation = tool.riskLevel === "BUSINESS_WRITE" || tool.riskLevel === "SENSITIVE";

  if (requiresConfirmation) {
    const [execution] = await db
      .insert(aiToolExecution)
      .values({
        id: crypto.randomUUID(),
        conversationId,
        userId: context.userId,
        toolName: tool.name,
        riskLevel: tool.riskLevel,
        inputHash,
        safeInputPreview: safePreview,
        status: "PROPOSED",
        requestedAt: new Date(),
      })
      .returning({ id: aiToolExecution.id });

    return {
      executionId: execution.id,
      requiresConfirmation: true,
      preview: safePreview,
    };
  }

  return {
    executionId: "",
    requiresConfirmation: false,
    preview: safePreview,
  };
}

export async function confirmAndExecute(
  tool: AnyToolDefinition,
  context: ToolContext,
  executionId: string,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const parsedInput = tool.inputSchema.parse(input);
  const inputHash = hashInput(parsedInput);

  const [claimed] = await db
    .update(aiToolExecution)
    .set({
      status: "CONFIRMED",
      confirmedAt: new Date(),
    })
    .where(
      and(
        eq(aiToolExecution.id, executionId),
        eq(aiToolExecution.userId, context.userId),
        eq(aiToolExecution.status, "PROPOSED"),
        eq(aiToolExecution.inputHash, inputHash),
        sql`${aiToolExecution.requestedAt} + interval '10 minutes' > now()`
      )
    )
    .returning({
      id: aiToolExecution.id,
      toolName: aiToolExecution.toolName,
      riskLevel: aiToolExecution.riskLevel,
      conversationId: aiToolExecution.conversationId,
    });

  if (!claimed) {
    const [execution] = await db
      .select({
        status: aiToolExecution.status,
        inputHash: aiToolExecution.inputHash,
        requestedAt: aiToolExecution.requestedAt,
        userId: aiToolExecution.userId,
      })
      .from(aiToolExecution)
      .where(eq(aiToolExecution.id, executionId))
      .limit(1);

    if (!execution) {
      throw new Error("Execution not found or access denied");
    }

    if (execution.userId !== context.userId) {
      throw new Error("Execution not found or access denied");
    }

    if (execution.status !== "PROPOSED") {
      throw new Error(`Execution cannot be confirmed: current status is ${execution.status}`);
    }

    if (execution.inputHash !== inputHash) {
      throw new Error("Input hash mismatch: the confirmed action does not match the proposed action");
    }

    if (execution.requestedAt.getTime() + CONFIRMATION_TTL_MS < Date.now()) {
      await db
        .update(aiToolExecution)
        .set({ status: "EXPIRED", errorMessage: "Confirmation expired" })
        .where(eq(aiToolExecution.id, executionId));
      throw new Error("Confirmation expired");
    }

    throw new Error("Execution could not be claimed for confirmation");
  }

  const authResult = await tool.authorize(context, parsedInput);
  if (!authResult.allowed) {
    await db
      .update(aiToolExecution)
      .set({ status: "FAILED", errorMessage: `Authorization failed: ${authResult.reason}`, executedAt: new Date() })
      .where(eq(aiToolExecution.id, executionId));
    throw new Error(`Authorization failed: ${authResult.reason}`);
  }

  try {
    const result = await tool.execute(context, parsedInput);

    await db
      .update(aiToolExecution)
      .set({ status: "EXECUTED", executedAt: new Date(), resultCode: "SUCCESS" })
      .where(and(eq(aiToolExecution.id, executionId), eq(aiToolExecution.status, "CONFIRMED")));

    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await db
      .update(aiToolExecution)
      .set({ status: "FAILED", executedAt: new Date(), errorMessage: message.slice(0, 500) })
      .where(and(eq(aiToolExecution.id, executionId), eq(aiToolExecution.status, "CONFIRMED")));
    return { success: false, error: message };
  }
}

export async function rejectExecution(executionId: string, userId: string): Promise<void> {
  const [execution] = await db
    .select()
    .from(aiToolExecution)
    .where(and(eq(aiToolExecution.id, executionId), eq(aiToolExecution.userId, userId)))
    .limit(1);

  if (!execution) {
    throw new Error("Execution not found or access denied");
  }

  if (execution.status !== "PROPOSED") {
    throw new Error(`Execution cannot be rejected: current status is ${execution.status}`);
  }

  await db
    .update(aiToolExecution)
    .set({ status: "REJECTED" })
    .where(eq(aiToolExecution.id, executionId));
}

export async function executeReadTool(
  tool: AnyToolDefinition,
  context: ToolContext,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const parsedInput = tool.inputSchema.parse(input);
  const authResult = await tool.authorize(context, parsedInput);
  if (!authResult.allowed) {
    throw new Error(`Authorization failed: ${authResult.reason}`);
  }

  try {
    const result = await tool.execute(context, parsedInput);
    return { success: true, data: result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Executes an auto-authorized LOW_RISK_WRITE tool after a fresh
 * authorization pass (same boundary as executeReadTool). Author/actor always
 * comes from the server-provided context — never from model-supplied input.
 */
export async function executeLowRiskWriteTool(
  tool: AnyToolDefinition,
  context: ToolContext,
  input: unknown
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  if (tool.riskLevel !== "LOW_RISK_WRITE") {
    throw new Error(`Tool ${tool.name} is not a LOW_RISK_WRITE tool`);
  }
  return executeReadTool(tool, context, input);
}